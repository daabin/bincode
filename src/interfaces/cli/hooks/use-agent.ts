/**
 * React hook for managing agent lifecycle in CLI
 *
 * Key design choices:
 * - Streaming tokens accumulate in a ref (pendingContentRef), flushed to state
 *   at most once per STREAM_THROTTLE_MS → caps Ink redraws to ~20/sec
 * - Tool calls are grouped with their results in ToolGroup[]
 * - Completed turns go into completedTurns[] where ChatView prints them
 *   permanently to terminal scrollback (zero flashing for history)
 */

import { useState, useCallback, useRef } from 'react';
import { Agent } from '../../../core/agent.js';
import type { AgentEvent, ToolGroup, CompletedTurn } from '../../../types/agent.js';
import type { LLMProvider } from '../../../llm/types.js';
import type { ServiceContainer } from '../../../services/index.js';
import type { AgentConfig } from '../../../types/agent.js';

const STREAM_THROTTLE_MS = 50;

export interface AgentState {
  isRunning: boolean;
  toolGroups: ToolGroup[];
  currentContent: string;
  completedTurns: CompletedTurn[];
  error: string | null;
}

export function useAgent(
  provider: LLMProvider,
  services: ServiceContainer,
  config: AgentConfig
) {
  const [state, setState] = useState<AgentState>({
    isRunning: false,
    toolGroups: [],
    currentContent: '',
    completedTurns: [],
    error: null
  });

  const agentRef = useRef<Agent | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<string>('');

  const start = useCallback(async (input: string) => {
    if (state.isRunning) return;

    const agent = new Agent({ config, provider, services });
    agentRef.current = agent;
    abortRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isRunning: true,
      toolGroups: [],
      currentContent: '',
      error: null,
      completedTurns: [...prev.completedTurns, { role: 'user', content: input }]
    }));

    const scheduleContentUpdate = () => {
      if (streamTimerRef.current === null) {
        streamTimerRef.current = setTimeout(() => {
          streamTimerRef.current = null;
          setState(prev => ({ ...prev, currentContent: pendingContentRef.current }));
        }, STREAM_THROTTLE_MS);
      }
    };

    const flushAndClearTimer = () => {
      if (streamTimerRef.current !== null) {
        clearTimeout(streamTimerRef.current);
        streamTimerRef.current = null;
      }
    };

    let accumulatedContent = '';
    let currentToolGroups: ToolGroup[] = [];

    const drainContent = (): string => {
      const c = accumulatedContent;
      accumulatedContent = '';
      pendingContentRef.current = '';
      return c;
    };

    try {
      for await (const event of agent.run(input)) {
        if (abortRef.current?.signal.aborted) break;

        switch (event.type) {
          case 'assistant':
            accumulatedContent += event.content;
            pendingContentRef.current = accumulatedContent;
            scheduleContentUpdate();
            break;

          case 'reasoning':
            // Show reasoning as dimmed quoted block during streaming
            accumulatedContent += `\n> *${event.content}*\n`;
            pendingContentRef.current = accumulatedContent;
            scheduleContentUpdate();
            break;

          case 'tool_call': {
            flushAndClearTimer();
            const content = drainContent();
            const newGroup: ToolGroup = {
              call: { name: event.name, args: event.args, category: event.category },
              expanded: false
            };
            currentToolGroups = [...currentToolGroups, newGroup];
            setState(prev => ({
              ...prev,
              currentContent: '',
              toolGroups: currentToolGroups,
              completedTurns: content
                ? [...prev.completedTurns, { role: 'assistant', content }]
                : prev.completedTurns
            }));
            break;
          }

          case 'tool_result': {
            const lastIdx = currentToolGroups.length - 1;
            if (lastIdx >= 0) {
              currentToolGroups = currentToolGroups.map((g, i) =>
                i === lastIdx ? { ...g, result: event.result } : g
              );
              setState(prev => ({ ...prev, toolGroups: currentToolGroups }));
            }
            break;
          }

          case 'done': {
            flushAndClearTimer();
            const content = drainContent();
            currentToolGroups = [];
            setState(prev => ({
              ...prev,
              isRunning: false,
              currentContent: '',
              toolGroups: [],
              completedTurns: content
                ? [...prev.completedTurns, { role: 'assistant', content }]
                : prev.completedTurns
            }));
            break;
          }

          case 'error': {
            flushAndClearTimer();
            const content = drainContent();
            setState(prev => ({
              ...prev,
              error: event.message,
              completedTurns: content
                ? [...prev.completedTurns, { role: 'assistant', content }]
                : prev.completedTurns
            }));
            break;
          }
        }
      }
    } catch (error) {
      flushAndClearTimer();
      const content = drainContent();
      const errorMsg = error instanceof Error ? error.message : String(error);
      setState(prev => ({
        ...prev,
        isRunning: false,
        currentContent: '',
        error: errorMsg,
        completedTurns: content
          ? [...prev.completedTurns, { role: 'assistant', content }]
          : prev.completedTurns
      }));
    } finally {
      flushAndClearTimer();
      // Safety net: ensure we always exit running state
      setState(prev => {
        if (!prev.isRunning) return prev;
        const content = pendingContentRef.current;
        pendingContentRef.current = '';
        return {
          ...prev,
          isRunning: false,
          currentContent: '',
          completedTurns: content
            ? [...prev.completedTurns, { role: 'assistant', content }]
            : prev.completedTurns
        };
      });
    }
  }, [config, provider, services, state.isRunning]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    if (streamTimerRef.current !== null) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setState(prev => ({ ...prev, isRunning: false }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isRunning: false,
      toolGroups: [],
      currentContent: '',
      completedTurns: [],
      error: null
    });
  }, []);

  const toggleToolGroup = useCallback((idx: number) => {
    setState(prev => ({
      ...prev,
      toolGroups: prev.toolGroups.map((g, i) =>
        i === idx ? { ...g, expanded: !g.expanded } : g
      )
    }));
  }, []);

  return { state, start, abort, reset, toggleToolGroup };
}

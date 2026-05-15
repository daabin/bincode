/**
 * React hook for managing agent lifecycle in CLI
 *
 * Key design choices:
 * - All output (user messages, streaming content, completed turns) is written
 *   directly to terminal scrollback via the `write` callback (from Ink's
 *   useStdout). Ink only manages the thin bottom region (tool rows + input bar).
 * - Completed paragraphs are flushed to stdout as soon as a blank-line boundary
 *   is detected (outside code blocks), so Ink never holds large amounts of text.
 * - The "current paragraph" preview (the incomplete paragraph being streamed) is
 *   held in state so the user sees content arriving in real time.
 * - Streaming tokens accumulate in a ref; state updates are throttled to
 *   STREAM_THROTTLE_MS to cap Ink redraws.
 */

import { useState, useCallback, useRef } from 'react';
import { Agent } from '../../../core/agent.js';
import type { ToolGroup } from '../../../types/agent.js';
import type { LLMProvider } from '../../../llm/types.js';
import type { ServiceContainer } from '../../../services/index.js';
import type { AgentConfig } from '../../../types/agent.js';
import { renderMarkdownToTerminal } from '../../../utils/terminalMarkdownRenderer.js';

const STREAM_THROTTLE_MS = 50;
const RENDER_OPTS = { enableHighlight: true, enableColor: true, escapeHtml: false };

/**
 * Returns the position just after the last paragraph break (\n\n) that is
 * NOT inside an unclosed fenced code block. Returns -1 if none found.
 */
function findFlushPoint(content: string): number {
  let pos = content.lastIndexOf('\n\n');
  while (pos >= 0) {
    const before = content.slice(0, pos + 2);
    const fences = before.match(/```/g);
    if (!fences || fences.length % 2 === 0) return pos + 2;
    pos = content.lastIndexOf('\n\n', pos - 1);
  }
  return -1;
}

export interface AgentState {
  isRunning: boolean;
  toolGroups: ToolGroup[];
  /** Raw text of the current (incomplete) streaming paragraph shown in Ink */
  currentContent: string;
  /** Total messages sent/received, for the status bar */
  messageCount: number;
  error: string | null;
}

export function useAgent(
  provider: LLMProvider,
  services: ServiceContainer,
  config: AgentConfig,
  /** Ink's useStdout().write — places text above Ink's managed region */
  write: (text: string) => void
) {
  const [state, setState] = useState<AgentState>({
    isRunning: false,
    toolGroups: [],
    currentContent: '',
    messageCount: 0,
    error: null
  });

  const agentRef = useRef<Agent | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Full accumulated raw content for the current assistant turn */
  const pendingContentRef = useRef<string>('');
  /** How many raw chars of pendingContent have already been written to stdout */
  const flushedRawLengthRef = useRef<number>(0);
  /** Always points to the latest `write` function (avoids stale closures) */
  const writeRef = useRef(write);
  writeRef.current = write;

  /** Flush all pending content to stdout immediately and reset tracking refs. */
  const flushPending = useCallback(() => {
    if (streamTimerRef.current !== null) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    const content = pendingContentRef.current;
    const remaining = content.slice(flushedRawLengthRef.current);
    if (remaining.trim()) {
      writeRef.current(renderMarkdownToTerminal(remaining, RENDER_OPTS).trimEnd() + '\n\n');
    }
    pendingContentRef.current = '';
    flushedRawLengthRef.current = 0;
  }, []);

  const start = useCallback(async (input: string) => {
    if (state.isRunning) return;

    pendingContentRef.current = '';
    flushedRawLengthRef.current = 0;

    const agent = new Agent({ config, provider, services });
    agentRef.current = agent;
    abortRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isRunning: true,
      toolGroups: [],
      currentContent: '',
      error: null,
      messageCount: prev.messageCount + 1
    }));

    let accumulatedContent = '';
    let currentToolGroups: ToolGroup[] = [];

    /** Schedule a throttled flush: write completed paragraphs to stdout,
     *  update Ink state with the remaining incomplete paragraph. */
    const scheduleFlush = () => {
      if (streamTimerRef.current === null) {
        streamTimerRef.current = setTimeout(() => {
          streamTimerRef.current = null;
          const content = pendingContentRef.current;
          const flushedLen = flushedRawLengthRef.current;
          const flushPoint = findFlushPoint(content);

          if (flushPoint > flushedLen) {
            const chunk = content.slice(flushedLen, flushPoint);
            writeRef.current(renderMarkdownToTerminal(chunk, RENDER_OPTS).trimEnd() + '\n\n');
            flushedRawLengthRef.current = flushPoint;
          }

          // Show only the current (incomplete) paragraph in Ink
          setState(prev => ({
            ...prev,
            currentContent: content.slice(flushedRawLengthRef.current)
          }));
        }, STREAM_THROTTLE_MS);
      }
    };

    const flushTurn = () => {
      if (streamTimerRef.current !== null) {
        clearTimeout(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      const remaining = accumulatedContent.slice(flushedRawLengthRef.current);
      if (remaining.trim()) {
        writeRef.current(renderMarkdownToTerminal(remaining, RENDER_OPTS).trimEnd() + '\n\n');
      }
      accumulatedContent = '';
      pendingContentRef.current = '';
      flushedRawLengthRef.current = 0;
    };

    try {
      for await (const event of agent.run(input)) {
        if (abortRef.current?.signal.aborted) break;

        switch (event.type) {
          case 'assistant':
            accumulatedContent += event.content;
            pendingContentRef.current = accumulatedContent;
            scheduleFlush();
            break;

          case 'reasoning':
            accumulatedContent += `\n> *${event.content}*\n`;
            pendingContentRef.current = accumulatedContent;
            scheduleFlush();
            break;

          case 'tool_call': {
            flushTurn();
            const newGroup: ToolGroup = {
              call: { name: event.name, args: event.args, category: event.category },
              expanded: false
            };
            currentToolGroups = [...currentToolGroups, newGroup];
            setState(prev => ({
              ...prev,
              currentContent: '',
              toolGroups: currentToolGroups,
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
            flushTurn();
            currentToolGroups = [];
            setState(prev => ({
              ...prev,
              isRunning: false,
              currentContent: '',
              toolGroups: [],
              messageCount: prev.messageCount + 1
            }));
            break;
          }

          case 'error': {
            flushTurn();
            setState(prev => ({
              ...prev,
              isRunning: false,
              currentContent: '',
              error: event.message,
            }));
            break;
          }
        }
      }
    } catch (error) {
      flushTurn();
      const errorMsg = error instanceof Error ? error.message : String(error);
      setState(prev => ({
        ...prev,
        isRunning: false,
        currentContent: '',
        error: errorMsg,
      }));
    } finally {
      // Safety net: always exit running state
      if (streamTimerRef.current !== null) {
        clearTimeout(streamTimerRef.current);
        streamTimerRef.current = null;
      }
      setState(prev => {
        if (!prev.isRunning) return prev;
        return { ...prev, isRunning: false, currentContent: '' };
      });
    }
  }, [config, provider, services, state.isRunning]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    flushPending();
    setState(prev => ({ ...prev, isRunning: false, currentContent: '' }));
  }, [flushPending]);

  const reset = useCallback(() => {
    pendingContentRef.current = '';
    flushedRawLengthRef.current = 0;
    setState({
      isRunning: false,
      toolGroups: [],
      currentContent: '',
      messageCount: 0,
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

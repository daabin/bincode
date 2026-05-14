/**
 * React hook for managing agent lifecycle in CLI
 */

import { useState, useCallback, useRef } from 'react';
import { Agent } from '../../core/agent.js';
import type { AgentEvent } from '../../types/agent.js';
import type { LLMProvider } from '../../llm/types.js';
import type { ServiceContainer } from '../../services/index.js';
import type { AgentConfig } from '../../types/agent.js';

const STREAM_THROTTLE_MS = 50;

export interface AgentState {
  isRunning: boolean;
  events: AgentEvent[];
  currentContent: string;
  error: string | null;
}

export function useAgent(
  provider: LLMProvider,
  services: ServiceContainer,
  config: AgentConfig
) {
  const [state, setState] = useState<AgentState>({
    isRunning: false,
    events: [],
    currentContent: '',
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
      events: [],
      currentContent: '',
      error: null
    }));

    // Throttled flush of accumulated streaming content to React state.
    // Tokens are buffered in a ref and pushed at most once per STREAM_THROTTLE_MS,
    // keeping Ink redraws under control during fast LLM streaming.
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

    // Track accumulated content for the current LLM turn.
    // Must be reset to '' whenever we finalize it into state.events.
    let accumulatedContent = '';

    // Flush buffered streaming content into state.events as a single assistant event,
    // then reset tracking state. Returns the event added (or null if nothing to flush).
    const finalizeAssistantContent = (): AgentEvent | null => {
      if (!accumulatedContent) return null;
      const event: AgentEvent = { type: 'assistant', content: accumulatedContent };
      accumulatedContent = '';
      pendingContentRef.current = '';
      return event;
    };

    try {
      for await (const event of agent.run(input)) {
        if (abortRef.current?.signal.aborted) break;

        if (event.type === 'assistant') {
          // Accumulate in local var + ref; only flush to state throttled
          accumulatedContent += event.content;
          pendingContentRef.current = accumulatedContent;
          scheduleContentUpdate();
        } else {
          // Non-streaming event: finalize any buffered assistant content first,
          // then add this event — all in one setState to avoid stale closures.
          flushAndClearTimer();
          const assistantEvent = finalizeAssistantContent();
          setState(prev => {
            const newEvents = assistantEvent
              ? [...prev.events, assistantEvent, event]
              : [...prev.events, event];
            return {
              ...prev,
              currentContent: '',
              events: newEvents
              // error events are rendered by EventRow — no need to also set state.error
            };
          });
        }
      }
    } catch (error) {
      flushAndClearTimer();
      const assistantEvent = finalizeAssistantContent();
      const errorMsg = error instanceof Error ? error.message : String(error);
      setState(prev => {
        const events = assistantEvent ? [...prev.events, assistantEvent] : prev.events;
        return { ...prev, events, error: errorMsg };
      });
    } finally {
      flushAndClearTimer();
      // Flush any remaining assistant content that wasn't followed by a non-assistant event
      const assistantEvent = finalizeAssistantContent();
      setState(prev => {
        const events = assistantEvent ? [...prev.events, assistantEvent] : prev.events;
        return { ...prev, isRunning: false, currentContent: '', events };
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
      events: [],
      currentContent: '',
      error: null
    });
  }, []);

  return { state, start, abort, reset };
}

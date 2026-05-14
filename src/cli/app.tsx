/**
 * Main CLI application — DeepSeek only
 *
 * UX improvements over the previous version:
 *   • /clear, /help slash commands
 *   • Ctrl+C: first press aborts current run; second press within 1s exits
 *   • Escape: abort current run
 *   • ↑/↓ input history navigation
 *   • Spinner glyph while running
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Text, Box, useInput } from 'ink';
import { ChatView } from './components/chat-view.js';
import { StatusBar } from './components/status-bar.js';
import { useAgent } from './hooks/use-agent.js';
import { createProvider } from '../llm/index.js';
import { createServiceContainer } from '../services/index.js';
import { getApiKey, getBaseUrl, getModel } from '../config/index.js';

const PROVIDER = 'deepseek' as const;

const HELP_TEXT = [
  '',
  'bincode — AI code agent (powered by DeepSeek)',
  '',
  'Commands:',
  '  /clear   Clear conversation history',
  '  /help    Show this help',
  '',
  'Shortcuts:',
  '  Enter    Submit message',
  '  Ctrl+C   Abort current run (press twice within 1s to exit)',
  '  Escape   Abort current run',
  '  ↑ / ↓   Navigate input history',
  '',
].join('\n');

interface AppProps {
  initialInput?: string;
  cwd?: string;
}

export function App({ initialInput, cwd = process.cwd() }: AppProps) {
  const apiKey = getApiKey() || '';
  const baseUrl = getBaseUrl();
  const model = getModel();

  const [input, setInput] = useState(initialInput || '');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const ctrlCCountRef = useRef(0);
  const ctrlCTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const services = React.useMemo(() => createServiceContainer(cwd), [cwd]);

  const provider = React.useMemo(
    () => createProvider(PROVIDER, { name: PROVIDER, apiKey }),
    [apiKey]
  );

  const agentConfig = React.useMemo(() => ({
    cwd,
    apiKey,
    baseUrl,
    model,
    maxIterations: 100,
    provider: PROVIDER
  }), [cwd, apiKey, baseUrl, model]);

  const agent = useAgent(provider, services, agentConfig);

  const handleSubmit = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed === '/clear') {
      agent.reset();
      setInput('');
      setHistory([]);
      setHistoryIndex(-1);
      return;
    }

    if (trimmed === '/help') {
      process.stdout.write(HELP_TEXT);
      setInput('');
      return;
    }

    if (agent.state.isRunning) return;

    setHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInput('');
    agent.start(trimmed);
  }, [agent]);

  useInput((inputChar, key) => {
    if (key.return) {
      if (input.trim()) handleSubmit(input);
      return;
    }

    if (key.ctrl && inputChar === 'c') {
      ctrlCCountRef.current += 1;
      if (ctrlCCountRef.current === 1) {
        agent.abort();
        if (ctrlCTimerRef.current) clearTimeout(ctrlCTimerRef.current);
        ctrlCTimerRef.current = setTimeout(() => {
          ctrlCCountRef.current = 0;
        }, 1000);
      } else {
        process.exit(0);
      }
      return;
    }

    if (key.escape) {
      agent.abort();
      return;
    }

    if (key.upArrow) {
      if (history.length > 0) {
        const newIndex = historyIndex === -1
          ? history.length - 1
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
      return;
    }

    if (key.downArrow) {
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    if (inputChar && !key.ctrl && !key.meta) {
      setInput(prev => prev + inputChar);
    }
  });

  useEffect(() => {
    if (initialInput) handleSubmit(initialInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spinner = agent.state.isRunning ? '⠋' : '';

  return (
    <Box flexDirection="column">
      {/* Bounded active-turn area — completed turns are on scrollback above */}
      <ChatView
        completedTurns={agent.state.completedTurns}
        toolGroups={agent.state.toolGroups}
        currentContent={agent.state.currentContent}
        error={agent.state.error}
        isRunning={agent.state.isRunning}
        onToggleTool={agent.toggleToolGroup}
      />

      {/* Input line */}
      <Box>
        <Text color="green" bold>{spinner || '❯'} </Text>
        <Text>{input}</Text>
        {!agent.state.isRunning && <Text color="green">▊</Text>}
      </Box>

      {/* Status bar */}
      <StatusBar
        provider={PROVIDER}
        model={model}
        isRunning={agent.state.isRunning}
        messageCount={agent.state.completedTurns.length}
      />
    </Box>
  );
}

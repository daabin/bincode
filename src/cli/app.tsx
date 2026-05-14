/**
 * Main CLI application component
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Text, Box, useInput } from 'ink';
import { ChatView } from './components/chat-view.js';
import { StatusBar } from './components/status-bar.js';
import { useAgent } from './hooks/use-agent.js';
import { useConfig } from './hooks/use-config.js';
import { createProvider, detectAvailableProviders } from '../llm/index.js';
import { createServiceContainer } from '../services/index.js';
import { loadConfig } from '../config/index.js';
import type { ProviderType } from '../llm/types.js';

interface AppProps {
  initialInput?: string;
  cwd?: string;
}

export function App({ initialInput, cwd = process.cwd() }: AppProps) {
  const configState = useConfig();
  const [input, setInput] = useState(initialInput || '');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Create services
  const services = React.useMemo(
    () => createServiceContainer(cwd),
    [cwd]
  );

  // Create provider
  const provider = React.useMemo(
    () => createProvider(configState.provider, {
      name: configState.provider,
      apiKey: configState.apiKey
    }),
    [configState.provider, configState.apiKey]
  );

  // Agent hook
  const agent = useAgent(provider, services, {
    cwd,
    apiKey: configState.apiKey,
    baseUrl: configState.baseUrl,
    model: configState.model,
    maxIterations: 100,
    provider: configState.provider
  });

  // Handle input
  const handleSubmit = useCallback((text: string) => {
    if (!text.trim() || agent.state.isRunning) return;

    setHistory(prev => [...prev, text]);
    setHistoryIndex(-1);
    setInput('');
    agent.start(text);
  }, [agent]);

  // Keyboard input
  useInput((inputChar, key) => {
    if (key.return && input.trim()) {
      handleSubmit(input);
      return;
    }

    if (key.upArrow) {
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
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

    if (key.escape) {
      agent.abort();
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

  // Auto-submit initial input
  useEffect(() => {
    if (initialInput) {
      handleSubmit(initialInput);
    }
  }, []);

  return (
    <Box flexDirection="column" height="100%">
      {/* Chat area */}
      <Box flexGrow={1} flexDirection="column" marginBottom={1}>
        <ChatView
          events={agent.state.events}
          currentContent={agent.state.currentContent}
          error={agent.state.error}
          isRunning={agent.state.isRunning}
        />
      </Box>

      {/* Input area */}
      <Box>
        <Text color="green">❯ </Text>
        <Text>{input}</Text>
        {!agent.state.isRunning && <Text color="green">▊</Text>}
      </Box>

      {/* Status bar */}
      <StatusBar
        provider={configState.provider}
        model={configState.model}
        isRunning={agent.state.isRunning}
        messageCount={agent.state.events.length}
      />
    </Box>
  );
}

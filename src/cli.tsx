#!/usr/bin/env node
import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { Box, render, Text, useApp, useInput, Static } from 'ink';
import { Agent } from './agent.js';
import type { AgentEvent } from './types.js';
import { getApiKey, getBaseUrl, getModel, setApiKey, getConfigPath, getProvider, setProvider } from './config.js';
import { detectAvailableProviders, type ProviderType } from './llm/index.js';
import { Markdown } from './markdown.js';

type Line =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; streaming?: boolean }
  | { kind: 'tool'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'system'; text: string };

const STREAM_THROTTLE_MS = 60;
const MAX_TOOL_OUTPUT_LINES = 50;
const SPINNER_INTERVAL_MS = 150;

function Spinner({ active }: { active: boolean }) {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, SPINNER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active]);

  if (!active) return null;

  return <Text color="yellow">{frames[frame]} Thinking...</Text>;
}

function StatusBar({ provider, model, busy }: { provider: string; model: string; busy: boolean }) {
  return (
    <Box borderStyle="single" borderColor={busy ? 'yellow' : 'green'} paddingX={1}>
      <Text dimColor>Provider: </Text>
      <Text color="cyan">{provider}</Text>
      <Text dimColor> | Model: </Text>
      <Text color="cyan">{model}</Text>
      {busy && <Text color="yellow"> ⏳</Text>}
    </Box>
  );
}

function truncateText(text: string, maxLines: number): { text: string; truncated: boolean; hiddenLines: number } {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return { text, truncated: false, hiddenLines: 0 };
  }
  const hiddenLines = lines.length - maxLines;
  const truncatedLines = lines.slice(-maxLines);
  return {
    text: `... ${hiddenLines} lines hidden ...\n${truncatedLines.join('\n')}`,
    truncated: true,
    hiddenLines
  };
}

function InputBox({ text, cursor, busy }: { text: string; cursor: number; busy: boolean }) {
  const handleCursorChange = useCallback((newCursor: number) => {
    return Math.max(0, Math.min(text.length, newCursor));
  }, [text.length]);

  if (busy) {
    return <Text>thinking</Text>;
  }

  if (text.length === 0) {
    return (
      <Box>
        <Text backgroundColor="white" color="black">
          {' '}
        </Text>
      </Box>
    );
  }

  const before = text.slice(0, cursor);
  const at = text[cursor] ?? ' ';
  const after = text.slice(cursor + 1);

  return (
    <Box>
      <Text>{before}</Text>
      <Text backgroundColor="white" color="black">
        {at}
      </Text>
      <Text>{after}</Text>
    </Box>
  );
}

function LineView({ line }: { line: Line }) {
  if (line.kind === 'user') {
    return (
      <Box>
        <Text color="cyan" bold>
          you:{' '}
        </Text>
        <Markdown streaming={false}>{line.text}</Markdown>
      </Box>
    );
  }
  if (line.kind === 'assistant') {
    return (
      <Box>
        <Text bold>agent: </Text>
        <Markdown streaming={line.streaming ?? false}>{line.text}</Markdown>
      </Box>
    );
  }
  if (line.kind === 'tool') {
    return <Text color="gray">{line.text}</Text>;
  }
  if (line.kind === 'error') {
    return <Text color="red">error: {line.text}</Text>;
  }
  return <Text color="gray">{line.text}</Text>;
}

function eventToLine(event: AgentEvent): Line {
  if (event.type === 'assistant') {
    return { kind: 'assistant', text: event.content };
  }

  if (event.type === 'tool_call') {
    return { kind: 'tool', text: `tool: ${event.name} ${JSON.stringify(event.args)}` };
  }

  if (event.type === 'tool_result') {
    const { text: truncatedText, truncated, hiddenLines } = truncateText(event.result, MAX_TOOL_OUTPUT_LINES);
    const firstLine = truncatedText.split('\n')[0] ?? '';
    const suffix = truncated ? `\n... ${hiddenLines} more lines` : (event.result.includes('\n') ? ' ...' : '');
    return { kind: 'tool', text: `tool result: ${event.name}: ${firstLine}${suffix}` };
  }

  return { kind: 'error', text: event.message };
}

function App({ initialPrompt }: { initialPrompt?: string }) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const currentProvider = getProvider();

  const initialLines = useMemo<Line[]>(() => [
    { kind: 'system', text: 'bincode code agent. Type /exit to quit.' },
    { kind: 'system', text: `Current provider: ${currentProvider}` },
    { kind: 'system', text: 'Commands: /setkey <api-key> | /setprovider <provider> | /stats | /config | /clear' }
  ], [currentProvider]);

  const [staticLines, setStaticLines] = useState<Line[]>([]);
  const [dynamicLines, setDynamicLines] = useState<Line[]>([]);
  const [allLines, setAllLines] = useState<Line[]>(initialLines);

  const [agent, setAgent] = useState<Agent | null>(() => {
    const apiKey = getApiKey();
    const provider = getProvider();

    if (!apiKey && provider !== 'ollama') {
      return null;
    }

    return new Agent({
      cwd: process.cwd(),
      apiKey: apiKey || '',
      baseUrl: getBaseUrl(),
      model: getModel(),
      provider,
      maxIterations: 30
    });
  });

  const inputBufferRef = useRef<{ value: string; cursor: number }>({ value: '', cursor: 0 });
  const inputUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingInputRef = useRef<{ value: string; cursor: number } | null>(null);

  const flushInputBuffer = useCallback(() => {
    if (pendingInputRef.current) {
      setInput(pendingInputRef.current.value);
      setCursor(pendingInputRef.current.cursor);
      pendingInputRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!agent) {
      const provider = getProvider();
      setAllLines(previous => [
        ...previous,
        { kind: 'error', text: `Missing API key for provider: ${provider}` },
        { kind: 'system', text: `Please set it via:` },
        { kind: 'system', text: `  1. Type: /setkey <your-api-key>` },
        { kind: 'system', text: `  2. Or set environment variable` },
        { kind: 'system', text: `  3. Or edit config file: ${getConfigPath()}` },
        { kind: 'system', text: `` },
        { kind: 'system', text: `Supported providers: deepseek, openai, anthropic, ollama` },
        { kind: 'system', text: `Use /setprovider <provider> to switch providers` }
      ]);
      return;
    }

    if (initialPrompt) {
      void submit(initialPrompt);
    }
  }, [agent, initialPrompt]);

  useInput((value, key) => {
    if (busy) {
      return;
    }

    if (key.ctrl && value === 'c') {
      exit();
      return;
    }

    if (key.return) {
      const trimmed = inputBufferRef.current.value.trim();
      inputBufferRef.current = { value: '', cursor: 0 };
      flushInputBuffer();

      if (trimmed === '/exit') {
        exit();
        return;
      }
      if (trimmed.startsWith('/setkey ')) {
        const newApiKey = trimmed.slice(8).trim();
        if (newApiKey.length > 0) {
          try {
            setApiKey(newApiKey);
            const provider = getProvider();
            const newAgent = new Agent({
              cwd: process.cwd(),
              apiKey: newApiKey,
              baseUrl: getBaseUrl(),
              model: getModel(),
              provider,
              maxIterations: 30
            });
            setAgent(newAgent);
            setAllLines(previous => [
              ...previous,
              { kind: 'user', text: '/setkey ***' },
              { kind: 'system', text: `✓ API key saved to ${getConfigPath()}` },
              { kind: 'system', text: `✓ Provider: ${provider}` },
              { kind: 'system', text: '✓ Agent initialized successfully. You can start chatting now!' }
            ]);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setAllLines(previous => [
              ...previous,
              { kind: 'user', text: trimmed },
              { kind: 'error', text: `Failed to save API key: ${message}` }
            ]);
          }
        } else {
          setAllLines(previous => [
            ...previous,
            { kind: 'user', text: trimmed },
            { kind: 'error', text: 'Usage: /setkey <your-api-key>' },
            { kind: 'system', text: 'Example: /setkey sk-abc123...' }
          ]);
        }
        return;
      }

      if (trimmed.startsWith('/setprovider ')) {
        const newProvider = trimmed.slice(13).trim() as ProviderType;
        const validProviders = ['deepseek', 'openai', 'anthropic', 'ollama', 'custom'];

        if (validProviders.includes(newProvider)) {
          try {
            setProvider(newProvider);
            const apiKey = getApiKey();

            if (!apiKey && newProvider !== 'ollama') {
              setAgent(null);
              setAllLines(previous => [
                ...previous,
                { kind: 'user', text: trimmed },
                { kind: 'system', text: `✓ Provider switched to: ${newProvider}` },
                { kind: 'error', text: `Please set API key for ${newProvider} using /setkey` }
              ]);
            } else {
              const newAgent = new Agent({
                cwd: process.cwd(),
                apiKey: apiKey || '',
                baseUrl: getBaseUrl(),
                model: getModel(),
                provider: newProvider,
                maxIterations: 30
              });
              setAgent(newAgent);
              setAllLines(previous => [
                ...previous,
                { kind: 'user', text: trimmed },
                { kind: 'system', text: `✓ Provider switched to: ${newProvider}` },
                { kind: 'system', text: `✓ Model: ${getModel()}` },
                { kind: 'system', text: '✓ Agent initialized successfully!' }
              ]);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setAllLines(previous => [
              ...previous,
              { kind: 'user', text: trimmed },
              { kind: 'error', text: `Failed to switch provider: ${message}` }
            ]);
          }
        } else {
          setAllLines(previous => [
            ...previous,
            { kind: 'user', text: trimmed },
            { kind: 'error', text: `Invalid provider: ${newProvider}` },
            { kind: 'system', text: `Valid providers: ${validProviders.join(', ')}` }
          ]);
        }
        return;
      }

      if (trimmed === '/stats') {
        void (async () => {
          const { globalTokenCounter } = await import('./tokens.js');
          const total = globalTokenCounter.getTotalUsage();
          const today = globalTokenCounter.getTodayUsage();
          const records = globalTokenCounter.getRecords(5);

          setAllLines(previous => [
            ...previous,
            { kind: 'user', text: '/stats' },
            { kind: 'system', text: '📊 Token Usage Statistics' },
            { kind: 'system', text: '' },
            { kind: 'system', text: `Total: ${total.totalTokens.toLocaleString()} tokens (${total.promptTokens.toLocaleString()} prompt + ${total.completionTokens.toLocaleString()} completion)` },
            { kind: 'system', text: `Today: ${today.totalTokens.toLocaleString()} tokens` },
            { kind: 'system', text: '' },
            { kind: 'system', text: `Recent requests (${records.length} shown):` },
            ...records.map(r => ({
              kind: 'system' as const,
              text: `  ${new Date(r.timestamp).toLocaleString()} - ${r.provider}/${r.model}: ${r.usage.totalTokens} tokens`
            }))
          ]);
        })();
        return;
      }

      if (trimmed === '/clear') {
        setAllLines(initialLines);
        setStaticLines([]);
        setDynamicLines([]);
        return;
      }

      if (trimmed === '/config') {
        void (async () => {
          const { showConfig } = await import('./configWatcher.js');
          const configInfo = showConfig();
          setAllLines(previous => [
            ...previous,
            { kind: 'user', text: '/config' },
            { kind: 'system', text: configInfo }
          ]);
        })();
        return;
      }

      if (trimmed.length > 0) {
        void submit(trimmed);
      }
      return;
    }

    if (key.backspace || key.delete) {
      if (inputBufferRef.current.cursor > 0) {
        const current = inputBufferRef.current.value;
        const cursor = inputBufferRef.current.cursor;
        inputBufferRef.current = {
          value: current.slice(0, cursor - 1) + current.slice(cursor),
          cursor: cursor - 1
        };
        scheduleInputUpdate();
      }
      return;
    }

    if (key.leftArrow) {
      inputBufferRef.current.cursor = Math.max(0, inputBufferRef.current.cursor - 1);
      scheduleInputUpdate();
      return;
    }
    if (key.rightArrow) {
      inputBufferRef.current.cursor = Math.min(inputBufferRef.current.value.length, inputBufferRef.current.cursor + 1);
      scheduleInputUpdate();
      return;
    }
    if (value === '\x1b[H' || value === '\x1bOH') {
      inputBufferRef.current.cursor = 0;
      scheduleInputUpdate();
      return;
    }
    if (value === '\x1b[F' || value === '\x1bOF') {
      inputBufferRef.current.cursor = inputBufferRef.current.value.length;
      scheduleInputUpdate();
      return;
    }

    if (value && !key.ctrl && !key.meta) {
      const current = inputBufferRef.current.value;
      const cursor = inputBufferRef.current.cursor;
      inputBufferRef.current = {
        value: current.slice(0, cursor) + value + current.slice(cursor),
        cursor: cursor + value.length
      };
      scheduleInputUpdate();
    }
  });

  function scheduleInputUpdate() {
    if (inputUpdateTimerRef.current) {
      return;
    }
    pendingInputRef.current = {
      value: inputBufferRef.current.value,
      cursor: inputBufferRef.current.cursor
    };
    inputUpdateTimerRef.current = setTimeout(() => {
      flushInputBuffer();
      inputUpdateTimerRef.current = null;
    }, STREAM_THROTTLE_MS);
  }

  async function submit(prompt: string) {
    if (!agent) {
      setAllLines(previous => [
        ...previous,
        { kind: 'user', text: prompt },
        { kind: 'error', text: 'No agent available. Please set your API key and restart the CLI.' }
      ]);
      return;
    }

    setBusy(true);
    setAllLines(previous => [...previous, { kind: 'user', text: prompt }]);
    setDynamicLines([{ kind: 'assistant', text: '', streaming: true }]);

    let assistantContent = '';
    let assistantLineIndex = dynamicLines.length;
    let lastFlushTime = Date.now();
    let pendingContent = '';
    let flushTimer: NodeJS.Timeout | null = null;

    const flushPendingContent = () => {
      if (pendingContent !== '') {
        assistantContent = pendingContent;
        setDynamicLines([{ kind: 'assistant', text: assistantContent, streaming: true }]);
        pendingContent = '';
      }
      lastFlushTime = Date.now();
    };

    const scheduleFlush = () => {
      if (flushTimer) return;
      const timeSinceLastFlush = Date.now() - lastFlushTime;
      const delay = Math.max(0, STREAM_THROTTLE_MS - timeSinceLastFlush);
      flushTimer = setTimeout(() => {
        flushPendingContent();
        flushTimer = null;
      }, delay);
    };

    const finalizeAssistantLine = () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushPendingContent();
      setDynamicLines([{ kind: 'assistant', text: assistantContent, streaming: false }]);
      setAllLines(previous => {
        const completedLine = { kind: 'assistant' as const, text: assistantContent, streaming: false };
        const linesToMove = [...previous];
        linesToMove.push(completedLine);
        setStaticLines(linesToMove);
        return linesToMove;
      });
    };

    try {
      for await (const event of agent.run(prompt)) {
        if (event.type === 'assistant') {
          pendingContent += event.content;
          scheduleFlush();
        } else {
          if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
          }
          flushPendingContent();
          finalizeAssistantLine();
          assistantLineIndex = allLines.length;
          const newLine = eventToLine(event);
          setDynamicLines([newLine]);
          setAllLines(previous => [...previous, newLine]);
        }
      }

      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushPendingContent();
      finalizeAssistantLine();
      setDynamicLines([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDynamicLines([]);
      setAllLines(previous => [...previous, { kind: 'error', text: message }]);
    } finally {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      setBusy(false);
    }
  }

  const currentInput = input;
  const currentCursor = cursor;
  const isBusy = busy;

  return (
    <Box flexDirection="column">
      <Static items={allLines}>
        {(line) => (
          <LineView key={`static-${line.kind}-${line.text.slice(0, 20)}`} line={line} />
        )}
      </Static>
      {dynamicLines.map((line, index) => (
        <LineView key={`dynamic-${index}-${line.kind}`} line={line} />
      ))}
      {busy && (
        <Box marginBottom={1}>
          <Spinner active={busy} />
        </Box>
      )}
      <StatusBar provider={currentProvider} model={getModel()} busy={isBusy} />
      <Box
        borderStyle="round"
        borderColor={isBusy ? 'yellow' : 'green'}
        paddingX={1}
        paddingY={0}
        marginTop={1}
      >
        <Text color={isBusy ? 'yellow' : 'green'}>{isBusy ? '···' : '>'}</Text>
        <Text> </Text>
        <InputBox text={currentInput} cursor={currentCursor} busy={isBusy} />
      </Box>
    </Box>
  );
}

const initialPrompt = process.argv.slice(2).join(' ').trim() || undefined;
render(<App initialPrompt={initialPrompt} />);

#!/usr/bin/env node
import React, { useState, useRef, useEffect } from 'react';
import { Box, render, Text, useApp, useInput } from 'ink';
import { Agent } from './agent.js';
import type { AgentEvent } from './types.js';
import { getApiKey, getBaseUrl, getModel, setApiKey, getConfigPath, getProvider, setProvider } from './config.js';
import { detectAvailableProviders, type ProviderType } from './llm/index.js';
import { Markdown } from './markdown.js';

// How often (ms) to flush streamed tokens to the React state.
// Batching renders at this rate eliminates per-token full-screen redraws.
const STREAM_THROTTLE_MS = 50;

type Line =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'system'; text: string };

// Loading spinner component
function Spinner({ active }: { active: boolean }) {
  const [frame, setFrame] = useState(0);
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % frames.length);
    }, 80);
    return () => clearInterval(timer);
  }, [active]);
  
  if (!active) return null;
  
  return <Text color="yellow">{frames[frame]} Thinking...</Text>;
}

// Status bar component
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

function App({ initialPrompt }: { initialPrompt?: string }) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const currentProvider = getProvider();
  const [lines, setLines] = useState<Line[]>([
    { kind: 'system', text: 'bincode code agent. Type /exit to quit.' },
    { kind: 'system', text: `Current provider: ${currentProvider}` },
    { kind: 'system', text: 'Commands: /setkey <api-key> | /setprovider <provider> | /stats | /config | /clear' }
  ]);

  // Active streaming content – kept separate from `lines` so completed history
  // is never mutated during streaming (prevents full Ink redraws per token).
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<string>('');

  const [agent, setAgent] = useState<Agent | null>(() => {
    const apiKey = getApiKey();
    const provider = getProvider();
    
    // Ollama doesn't require API key
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

  React.useEffect(() => {
    if (!agent) {
      const provider = getProvider();
      setLines(previous => [
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInput((value, key) => {
    if (busy) {
      return;
    }

    if (key.ctrl && value === 'c') {
      exit();
      return;
    }

    if (key.return) {
      const trimmed = input.trim();
      setInput('');
      setCursor(0);
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
            // 重新初始化 agent
            const newAgent = new Agent({
              cwd: process.cwd(),
              apiKey: newApiKey,
              baseUrl: getBaseUrl(),
              model: getModel(),
              provider,
              maxIterations: 30
            });
            setAgent(newAgent);
            setLines(previous => [
              ...previous,
              { kind: 'user', text: '/setkey ***' },
              { kind: 'system', text: `✓ API key saved to ${getConfigPath()}` },
              { kind: 'system', text: `✓ Provider: ${provider}` },
              { kind: 'system', text: '✓ Agent initialized successfully. You can start chatting now!' }
            ]);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setLines(previous => [
              ...previous,
              { kind: 'user', text: trimmed },
              { kind: 'error', text: `Failed to save API key: ${message}` }
            ]);
          }
        } else {
          setLines(previous => [
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
            
            // Ollama doesn't require API key
            if (!apiKey && newProvider !== 'ollama') {
              setAgent(null);
              setLines(previous => [
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
              setLines(previous => [
                ...previous,
                { kind: 'user', text: trimmed },
                { kind: 'system', text: `✓ Provider switched to: ${newProvider}` },
                { kind: 'system', text: `✓ Model: ${getModel()}` },
                { kind: 'system', text: '✓ Agent initialized successfully!' }
              ]);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setLines(previous => [
              ...previous,
              { kind: 'user', text: trimmed },
              { kind: 'error', text: `Failed to switch provider: ${message}` }
            ]);
          }
        } else {
          setLines(previous => [
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

          setLines(previous => [
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
        setLines([
          { kind: 'system', text: 'bincode code agent. Type /exit to quit.' },
          { kind: 'system', text: `Current provider: ${getProvider()}` },
          { kind: 'system', text: 'Commands: /setkey <api-key> | /setprovider <provider> | /stats | /config | /clear' }
        ]);
        return;
      }

      if (trimmed === '/config') {
        void (async () => {
          const { showConfig } = await import('./configWatcher.js');
          const configInfo = showConfig();
          setLines(previous => [
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
      if (cursor > 0) {
        setInput(current => current.slice(0, cursor - 1) + current.slice(cursor));
        setCursor(c => c - 1);
      }
      return;
    }

    // Arrow keys for cursor movement
    if (key.leftArrow) {
      setCursor(c => Math.max(0, c - 1));
      return;
    }
    if (key.rightArrow) {
      setCursor(c => Math.min(input.length, c + 1));
      return;
    }
    // Home and End keys are not in the Key type, but can be detected via input value
    if (value === '\x1b[H' || value === '\x1bOH') {
      // Home key
      setCursor(0);
      return;
    }
    if (value === '\x1b[F' || value === '\x1bOF') {
      // End key
      setCursor(input.length);
      return;
    }

    if (value && !key.ctrl && !key.meta) {
      setInput(current => current.slice(0, cursor) + value + current.slice(cursor));
      setCursor(c => c + value.length);
    }
  });

  async function submit(prompt: string) {
    if (!agent) {
      setLines(previous => [
        ...previous,
        { kind: 'user', text: prompt },
        { kind: 'error', text: 'No agent available. Please set your API key and restart the CLI.' }
      ]);
      return;
    }

    setBusy(true);
    setLines(previous => [...previous, { kind: 'user', text: prompt }]);

    let assistantContent = '';

    // Throttle streaming state updates: accumulate tokens in a ref and flush to
    // React state at most once per STREAM_THROTTLE_MS.  This batches Ink redraws
    // from potentially 100+/sec down to ≤20/sec, eliminating the visible flash.
    const scheduleStreamingUpdate = () => {
      pendingContentRef.current = assistantContent;
      if (streamingTimerRef.current === null) {
        streamingTimerRef.current = setTimeout(() => {
          streamingTimerRef.current = null;
          setStreamingText(pendingContentRef.current);
        }, STREAM_THROTTLE_MS);
      }
    };

    // Flush any pending throttle timer and push completed assistant text to lines.
    const finalizeStreaming = () => {
      if (streamingTimerRef.current !== null) {
        clearTimeout(streamingTimerRef.current);
        streamingTimerRef.current = null;
      }
      if (assistantContent) {
        setLines(prev => [...prev, { kind: 'assistant', text: assistantContent }]);
        assistantContent = '';
      }
      setStreamingText(null);
    };

    try {
      for await (const event of agent.run(prompt)) {
        if (event.type === 'assistant') {
          assistantContent += event.content;
          scheduleStreamingUpdate();
        } else {
          // Tool call / result / error: commit any buffered assistant text first.
          finalizeStreaming();
          setLines(previous => [...previous, eventToLine(event)]);
        }
      }
      finalizeStreaming();
    } catch (error) {
      if (streamingTimerRef.current !== null) {
        clearTimeout(streamingTimerRef.current);
        streamingTimerRef.current = null;
      }
      setStreamingText(null);
      const message = error instanceof Error ? error.message : String(error);
      setLines(previous => [...previous, { kind: 'error', text: message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" marginBottom={1}>
        {lines.map((line, index) => (
          <LineView key={`${index}-${line.kind}`} line={line} />
        ))}
        {/* Streaming content lives outside `lines` so completed history is never
            mutated during token delivery.  Plain <Text> avoids costly markdown
            parsing on every batched update; <Markdown> is applied once the full
            response is moved into `lines` upon completion. */}
        {streamingText !== null && streamingText.length > 0 && (
          <Box>
            <Text bold>agent: </Text>
            <Text>{streamingText}</Text>
          </Box>
        )}
      </Box>
      {busy && streamingText === null && (
        <Box marginBottom={1}>
          <Spinner active={true} />
        </Box>
      )}
      <StatusBar provider={currentProvider} model={getModel()} busy={busy} />
      <Box
        borderStyle="round"
        borderColor={busy ? 'yellow' : 'green'}
        paddingX={1}
        paddingY={0}
        marginTop={1}
      >
        <Text color={busy ? 'yellow' : 'green'}>{busy ? '···' : '>'}</Text>
        <Text> </Text>
        <InputBox text={input} cursor={cursor} busy={busy} />
      </Box>
    </Box>
  );
}

function InputBox({ text, cursor, busy }: { text: string; cursor: number; busy: boolean }) {
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
        <Markdown streaming={false}>{line.text}</Markdown>
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
    const firstLine = event.result.split('\n')[0] ?? '';
    const suffix = event.result.includes('\n') ? ' ...' : '';
    return { kind: 'tool', text: `tool result: ${event.name}: ${firstLine}${suffix}` };
  }

  return { kind: 'error', text: event.message };
}

const initialPrompt = process.argv.slice(2).join(' ').trim() || undefined;
render(<App initialPrompt={initialPrompt} />);
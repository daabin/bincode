#!/usr/bin/env node
import React, { useState, useRef } from 'react';
import { Box, render, Text, useApp, useInput } from 'ink';
import { Agent } from './agent.js';
import type { AgentEvent } from './types.js';
import { getApiKey, getBaseUrl, getModel, setApiKey, getConfigPath } from './config.js';
import { Markdown } from './markdown.js';

type Line =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string; streaming?: boolean }
  | { kind: 'tool'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'system'; text: string };

function App({ initialPrompt }: { initialPrompt?: string }) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    { kind: 'system', text: 'bincode code agent. Type /exit to quit.' },
    { kind: 'system', text: 'Commands: /setkey <api-key> - Save your DeepSeek API key' }
  ]);
  const [agent, setAgent] = useState<Agent | null>(() => {
    const apiKey = getApiKey();
    if (!apiKey) {
      return null;
    }

    return new Agent({
      cwd: process.cwd(),
      apiKey,
      baseUrl: getBaseUrl(),
      model: getModel(),
      maxIterations: 30
    });
  });

  React.useEffect(() => {
    if (!agent) {
      setLines(previous => [
        ...previous,
        { kind: 'error', text: `Missing DEEPSEEK_API_KEY. Please set it via:` },
        { kind: 'system', text: `  1. Type: /setkey sk-your-api-key` },
        { kind: 'system', text: `  2. Or set environment variable: export DEEPSEEK_API_KEY="sk-..."` },
        { kind: 'system', text: `  3. Or edit config file: ${getConfigPath()}` },
        { kind: 'system', text: `` },
        { kind: 'system', text: `Get your API key at: https://platform.deepseek.com/api_keys` }
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
            // 重新初始化 agent
            const newAgent = new Agent({
              cwd: process.cwd(),
              apiKey: newApiKey,
              baseUrl: getBaseUrl(),
              model: getModel(),
              maxIterations: 30
            });
            setAgent(newAgent);
            setLines(previous => [
              ...previous,
              { kind: 'user', text: '/setkey ***' },
              { kind: 'system', text: `✓ API key saved to ${getConfigPath()}` },
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
            { kind: 'system', text: 'Example: /setkey sk-abc123...' },
            { kind: 'system', text: 'Get your key at: https://platform.deepseek.com/api_keys' }
          ]);
        }
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

    // 用于累积 assistant 的内容
    let assistantContent = '';
    let assistantLineIndex = -1;

    try {
      for await (const event of agent.run(prompt)) {
        if (event.type === 'assistant') {
          // 累积 assistant 内容
          assistantContent += event.content;

          if (assistantLineIndex === -1) {
            // 首次收到 assistant 内容，创建新行
            setLines(previous => {
              assistantLineIndex = previous.length;
              return [...previous, { kind: 'assistant', text: assistantContent, streaming: true }];
            });
          } else {
            // 更新现有行（流式渲染）
            setLines(previous => {
              const newLines = [...previous];
              newLines[assistantLineIndex] = {
                kind: 'assistant',
                text: assistantContent,
                streaming: true
              };
              return newLines;
            });
          }
        } else {
          // 其他事件（tool_call, tool_result 等）
          // 如果有正在流式的 assistant 内容，标记为完成
          if (assistantLineIndex !== -1) {
            setLines(previous => {
              const newLines = [...previous];
              newLines[assistantLineIndex] = {
                kind: 'assistant',
                text: assistantContent,
                streaming: false
              };
              return newLines;
            });
            assistantLineIndex = -1;
          }

          // 添加工具调用/结果
          setLines(previous => [...previous, eventToLine(event)]);
        }
      }

      // 确保最后的 assistant 内容标记为完成
      if (assistantLineIndex !== -1) {
        setLines(previous => {
          const newLines = [...previous];
          newLines[assistantLineIndex] = {
            kind: 'assistant',
            text: assistantContent,
            streaming: false
          };
          return newLines;
        });
      }
    } catch (error) {
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
      </Box>
      <Box
        borderStyle="round"
        borderColor={busy ? 'yellow' : 'green'}
        paddingX={1}
        paddingY={0}
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
    const firstLine = event.result.split('\n')[0] ?? '';
    const suffix = event.result.includes('\n') ? ' ...' : '';
    return { kind: 'tool', text: `tool result: ${event.name}: ${firstLine}${suffix}` };
  }

  return { kind: 'error', text: event.message };
}

const initialPrompt = process.argv.slice(2).join(' ').trim() || undefined;
render(<App initialPrompt={initialPrompt} />);

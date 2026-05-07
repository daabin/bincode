#!/usr/bin/env node
import React, { useMemo, useState } from 'react';
import { Box, render, Text, useApp, useInput } from 'ink';
import { Agent } from './agent.js';
import type { AgentEvent } from './types.js';

type Line =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'system'; text: string };

function App({ initialPrompt }: { initialPrompt?: string }) {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([
    { kind: 'system', text: 'bincode code agent. Type /exit to quit.' }
  ]);

  const agent = useMemo(() => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return null;
    }

    return new Agent({
      cwd: process.cwd(),
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-v4-flash',
      maxIterations: 10
    });
  }, []);

  React.useEffect(() => {
    if (!agent) {
      setLines(previous => [
        ...previous,
        { kind: 'error', text: 'Missing DEEPSEEK_API_KEY. Set it and restart the CLI.' }
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
      return;
    }

    setBusy(true);
    setLines(previous => [...previous, { kind: 'user', text: prompt }]);

    try {
      for await (const event of agent.run(prompt)) {
        setLines(previous => [...previous, eventToLine(event)]);
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
    return <Text color="cyan">you: {line.text}</Text>;
  }
  if (line.kind === 'assistant') {
    return <Text>agent: {line.text}</Text>;
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

/**
 * Main CLI application — DeepSeek only
 *
 * UX improvements over the previous version:
 *   • /clear, /help, /sessions, /resume slash commands
 *   • Ctrl+C: first press aborts current run; second press within 1s exits
 *   • Escape: abort current run
 *   • ↑/↓ input history navigation
 *   • Spinner glyph while running
 *   • Session persistence to ~/.bincode/sessions/
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Text, Box, useInput, useStdout } from 'ink';
import chalk from 'chalk';
import { ChatView } from './components/chat-view.js';
import { StatusBar } from './components/status-bar.js';
import { useAgent } from './hooks/use-agent.js';
import { DeepSeekProvider } from '../../llm/index.js';
import { createServiceContainer } from '../../services/index.js';
import { getApiKey, getBaseUrl, getModel } from '../../config/index.js';

const PROVIDER = 'deepseek' as const;

const HELP_TEXT = [
  '',
  'bincode — AI code agent (powered by DeepSeek)',
  '',
  'Commands:',
  '  /clear          Clear conversation (start a new session)',
  '  /help           Show this help',
  '  /sessions       List recent sessions',
  '  /resume <id>    Resume a previous session by ID (or ID prefix)',
  '',
  'Shortcuts:',
  '  Enter    Submit message',
  '  Ctrl+C   Abort current run (press twice within 1s to exit)',
  '  Escape   Abort current run',
  '  ↑ / ↓   Navigate input history',
  '',
].join('\n');

/** Format a timestamp as a human-readable relative time */
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface AppProps {
  initialInput?: string;
  cwd?: string;
}

export function App({ initialInput, cwd = process.cwd() }: AppProps) {
  const apiKey = getApiKey() || '';
  const baseUrl = getBaseUrl();
  const model = getModel();

  const { write } = useStdout();

  const [input, setInput] = useState(initialInput || '');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const ctrlCCountRef = useRef(0);
  const ctrlCTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const services = React.useMemo(() => createServiceContainer(cwd), [cwd]);

  const provider = React.useMemo(
    () => new DeepSeekProvider(),
    []
  );

  const agentConfig = React.useMemo(() => ({
    cwd,
    apiKey,
    baseUrl,
    model,
    maxIterations: 100,
    provider: PROVIDER
  }), [cwd, apiKey, baseUrl, model]);

  const agent = useAgent(provider, services, agentConfig, write);

  const handleSubmit = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed === '/clear') {
      agent.reset();
      setInput('');
      setHistory([]);
      setHistoryIndex(-1);
      write(chalk.dim('\n— new session —\n\n'));
      return;
    }

    if (trimmed === '/help') {
      write(HELP_TEXT);
      setInput('');
      return;
    }

    if (trimmed === '/sessions') {
      const sessions = agent.getSessions();
      if (sessions.length === 0) {
        write(chalk.dim('\nNo sessions found.\n\n'));
      } else {
        const header = chalk.bold('\nRecent sessions:\n');
        const rows = sessions.slice(0, 15).map(s => {
          const id = chalk.cyan(s.id.slice(0, 8));
          const title = chalk.white(s.title.slice(0, 40).padEnd(40));
          const msgs = chalk.dim(`${s.messageCount} msgs`);
          const time = chalk.dim(relativeTime(s.updatedAt));
          return `  ${id}  ${title}  ${msgs}  ${time}`;
        });
        write(header + rows.join('\n') + chalk.dim('\n\nUse /resume <id> to continue a session.\n\n'));
      }
      setInput('');
      return;
    }

    if (trimmed.startsWith('/resume ')) {
      const prefix = trimmed.slice(8).trim();
      if (!prefix) {
        write(chalk.red('\nUsage: /resume <session-id>\n\n'));
        setInput('');
        return;
      }
      // Allow prefix matching (at least 4 chars)
      const sessions = agent.getSessions();
      const match = sessions.find(s => s.id.startsWith(prefix));
      if (!match) {
        write(chalk.red(`\nNo session matching "${prefix}".\n`) +
              chalk.dim('Use /sessions to list available sessions.\n\n'));
        setInput('');
        return;
      }
      const err = agent.resumeSession(match.id);
      if (err) {
        write(chalk.red(`\n✖ ${err}\n\n`));
      } else {
        write(chalk.green(`\n✔ Resumed session ${chalk.cyan(match.id.slice(0, 8))}: `) +
              chalk.bold(match.title) + '\n' +
              chalk.dim(`  ${match.messageCount} messages  ·  ${relativeTime(match.updatedAt)}\n\n`));
      }
      setInput('');
      return;
    }

    if (agent.state.isRunning) return;

    // Write user message to scrollback before starting the agent
    write(chalk.bold.green('\n❯ ') + chalk.bold(trimmed) + '\n\n');

    setHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInput('');
    agent.start(trimmed);
  }, [agent, write]);

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
      {/* Bounded active-turn area — all completed output is in scrollback above */}
      <ChatView
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
        messageCount={agent.state.messageCount}
        sessionId={agent.state.sessionId}
      />
    </Box>
  );
}

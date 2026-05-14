/**
 * Chat view — renders the active (bounded) conversation area.
 *
 * Completed turns are written permanently to terminal scrollback via
 * useStdout().write(), so Ink never re-renders them → zero flashing for history.
 *
 * The Ink-managed area only contains:
 *   • Active tool groups (collapsible, 1 line each when collapsed)
 *   • Live streaming content: last MAX_STREAMING_LINES lines  ← bounded
 *   • Error display
 */

import React, { useRef, useEffect } from 'react';
import { Text, Box, useStdout } from 'ink';
import type { ToolGroup, CompletedTurn } from '../../types/agent.js';
import { Markdown } from '../../markdown.js';
import { ToolSection } from './tool-section.js';
import { renderMarkdownToTerminal } from '../../utils/terminalMarkdownRenderer.js';
import chalk from 'chalk';

/** Max lines of streaming content shown inside Ink's managed area */
const MAX_STREAMING_LINES = 20;
const RENDER_OPTS = { enableHighlight: true, enableColor: true, escapeHtml: false };

interface ChatViewProps {
  completedTurns: CompletedTurn[];
  toolGroups: ToolGroup[];
  currentContent: string;
  error: string | null;
  isRunning: boolean;
  onToggleTool: (idx: number) => void;
}

export function ChatView({
  completedTurns,
  toolGroups,
  currentContent,
  error,
  isRunning,
  onToggleTool
}: ChatViewProps) {
  const { stdout } = useStdout();
  const printedRef = useRef(0);

  // Permanently write new completed turns to terminal scrollback.
  // Runs after each render — content is above Ink's managed region and never re-rendered.
  useEffect(() => {
    const newTurns = completedTurns.slice(printedRef.current);
    for (const turn of newTurns) {
      if (turn.role === 'user') {
        stdout.write(chalk.bold.green('\n❯ ') + chalk.bold(turn.content) + '\n\n');
      } else if (turn.content.trim()) {
        const rendered = renderMarkdownToTerminal(turn.content, RENDER_OPTS);
        stdout.write(rendered.trimEnd() + '\n\n');
      }
    }
    printedRef.current = completedTurns.length;
  }, [completedTurns, stdout]);

  // Bound the streaming area to prevent Ink from managing too many lines
  const streamingPreview = currentContent
    ? currentContent.split('\n').slice(-MAX_STREAMING_LINES).join('\n')
    : '';

  return (
    <Box flexDirection="column">
      {/* Active tool groups */}
      {toolGroups.map((group, i) => (
        <ToolSection key={i} group={group} index={i} onToggle={onToggleTool} />
      ))}

      {/* Live streaming preview */}
      {isRunning && streamingPreview && (
        <Box flexDirection="column">
          <Markdown streaming>{streamingPreview}</Markdown>
          <Text color="green">▊</Text>
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">✖ Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}

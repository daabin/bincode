/**
 * Chat view — renders ONLY the active (bounded) in-flight state.
 *
 * All output (user messages, completed paragraphs, finished assistant turns)
 * is written directly to terminal scrollback by use-agent via Ink's write()
 * callback. This component never touches stdout itself.
 *
 * Ink-managed area contains only:
 *   • Active tool groups (collapsible, 1 line each when collapsed)
 *   • Current incomplete streaming paragraph (small, bounded)
 *   • Error display
 */

import React from 'react';
import { Text, Box } from 'ink';
import type { ToolGroup } from '../../../types/agent.js';
import { ToolSection } from './tool-section.js';

interface ChatViewProps {
  toolGroups: ToolGroup[];
  currentContent: string;
  error: string | null;
  isRunning: boolean;
  onToggleTool: (idx: number) => void;
}

export function ChatView({
  toolGroups,
  currentContent,
  error,
  isRunning,
  onToggleTool
}: ChatViewProps) {
  return (
    <Box flexDirection="column">
      {/* Active tool groups */}
      {toolGroups.map((group, i) => (
        <ToolSection key={i} group={group} index={i} onToggle={onToggleTool} />
      ))}

      {/* Current incomplete streaming paragraph — raw text, bounded height */}
      {isRunning && currentContent && (
        <Box flexDirection="column">
          <Text dimColor>{currentContent}</Text>
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

/**
 * ToolSection — collapsible tool call display
 *
 * Collapsed (default):
 *   ⚡ tool_name(args…)  ✔  (when result is ready)
 *
 * Expanded (press Enter / T to toggle — see app.tsx):
 *   ▼ ⚡ tool_name
 *     Args: { ... }
 *     ─────
 *     result text…
 */

import React from 'react';
import { Text, Box } from 'ink';
import type { ToolGroup } from '../../types/agent.js';

interface ToolSectionProps {
  group: ToolGroup;
  index: number;
  onToggle: (idx: number) => void;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '…';
}

export function ToolSection({ group, index, onToggle }: ToolSectionProps) {
  const { call, result, expanded } = group;
  const argsStr = truncate(JSON.stringify(call.args), 60);

  if (!expanded) {
    return (
      <Box>
        <Text color="yellow">⚡ </Text>
        <Text color="yellow" bold>{call.name}</Text>
        <Text color="gray">({argsStr})</Text>
        {result !== undefined
          ? <Text color="green"> ✔</Text>
          : <Text color="yellow"> …</Text>
        }
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="yellow">▼ ⚡ </Text>
        <Text color="yellow" bold>{call.name}</Text>
      </Box>
      <Box marginLeft={2} flexDirection="column">
        <Text color="gray">Args: {JSON.stringify(call.args, null, 2)}</Text>
        {result !== undefined && (
          <Box flexDirection="column">
            <Text color="gray">─────</Text>
            <Text color="gray">{truncate(result, 500)}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

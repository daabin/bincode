/**
 * Status bar component
 */

import React from 'react';
import { Text, Box } from 'ink';
import type { ProviderType } from '../../../llm/types.js';

interface StatusBarProps {
  provider: ProviderType;
  model: string;
  isRunning: boolean;
  messageCount: number;
  sessionId?: string | null;
}

export function StatusBar({ provider, model, isRunning, messageCount, sessionId }: StatusBarProps) {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Box>
        <Text color="cyan">bincode</Text>
        <Text color="gray"> | </Text>
        <Text color="yellow">{provider}</Text>
        <Text color="gray">/{model}</Text>
        {sessionId && (
          <>
            <Text color="gray"> | </Text>
            <Text color="gray">sess:</Text>
            <Text color="cyan">{sessionId.slice(0, 8)}</Text>
          </>
        )}
      </Box>

      <Box>
        <Text color="gray">msgs: {messageCount}</Text>
        <Text color="gray"> | </Text>
        {isRunning ? (
          <Text color="green">● running</Text>
        ) : (
          <Text color="gray">○ idle</Text>
        )}
      </Box>
    </Box>
  );
}

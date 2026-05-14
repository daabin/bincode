/**
 * Chat view component for displaying agent conversation
 */

import React from 'react';
import { Text, Box } from 'ink';
import type { AgentEvent } from '../../types/agent.js';
import { Markdown } from '../../markdown.js';

interface ChatViewProps {
  events: AgentEvent[];
  currentContent: string;
  error: string | null;
  isRunning: boolean;
}

export function ChatView({ events, currentContent, error, isRunning }: ChatViewProps) {
  // Show only the last few events for a compact view
  const visibleEvents = events.slice(-20);

  return (
    <Box flexDirection="column" marginBottom={1}>
      {visibleEvents.map((event, i) => (
        <EventRow key={i} event={event} />
      ))}

      {isRunning && currentContent && (
        <Box>
          <Text color="cyan">┃ </Text>
          <Text>{currentContent}</Text>
          <Text color="green">▊</Text>
        </Box>
      )}

      {error && (
        <Box>
          <Text color="red">✖ Error: {error}</Text>
        </Box>
      )}
    </Box>
  );
}

function EventRow({ event }: { event: AgentEvent }) {
  switch (event.type) {
    case 'assistant':
      return (
        <Box flexDirection="column">
          <Markdown>{event.content}</Markdown>
        </Box>
      );

    case 'tool_call':
      return (
        <Box>
          <Text color="yellow">⚡ </Text>
          <Text color="yellow">{event.name}</Text>
          <Text color="gray">({JSON.stringify(event.args).substring(0, 80)})</Text>
        </Box>
      );

    case 'tool_result': {
      const preview = event.result.substring(0, 200);
      return (
        <Box flexDirection="column">
          <Box>
            <Text color="green">✔ </Text>
            <Text color="green">{event.name}</Text>
            <Text color="gray"> completed</Text>
          </Box>
          {preview && (
            <Box marginLeft={2}>
              <Text color="gray">{preview}</Text>
              {event.result.length > 200 && <Text color="gray">...</Text>}
            </Box>
          )}
        </Box>
      );
    }

    case 'reasoning':
      return (
        <Box>
          <Text color="gray">💭 {event.content}</Text>
        </Box>
      );

    case 'error':
      return (
        <Box>
          <Text color="red">✖ {event.message}</Text>
        </Box>
      );

    case 'done':
      return (
        <Box>
          <Text color="green">✔ Done</Text>
        </Box>
      );

    default:
      return null;
  }
}

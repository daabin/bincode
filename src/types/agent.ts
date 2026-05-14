/** Agent-related types */

import type { ToolCategory } from './core.js';

export type AgentEvent =
  | { type: 'assistant'; content: string }
  | { type: 'tool_call'; name: string; args: unknown; category?: ToolCategory }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'error'; message: string }
  | { type: 'reasoning'; content: string }
  | { type: 'done' };

export type AgentConfig = {
  cwd: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxIterations: number;
  provider?: string;
  systemPrompt?: string;
};

/** A tool call paired with its result, displayed as a collapsible row */
export interface ToolGroup {
  call: { name: string; args: unknown; category?: ToolCategory };
  result?: string;
  expanded: boolean;
}

/** A completed conversation turn, printed permanently to terminal scrollback */
export interface CompletedTurn {
  role: 'user' | 'assistant';
  content: string;
}

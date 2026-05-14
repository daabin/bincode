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

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type ChatMessage = {
  role: Role;
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
  reasoning_content?: string;
};

export type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type ToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };
  };
};

export type AgentEvent =
  | { type: 'assistant'; content: string }
  | { type: 'tool_call'; name: string; args: unknown }
  | { type: 'tool_result'; name: string; result: string }
  | { type: 'error'; message: string };

export type AgentConfig = {
  cwd: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  maxIterations: number;
};
/**
 * Types - Backward-compatible wrapper
 *
 * Re-exports types from the new types/ module.
 * New code should import from './types/index.js' directly.
 */

export type {
  Role,
  ChatMessage,
  ToolCall,
  ToolDefinition,
  AgentEvent,
  AgentConfig
} from './types/index.js';

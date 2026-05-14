import { describe, it, expect } from 'vitest';
import type { Role, ChatMessage, ToolCall, ToolDefinition, ToolCategory } from './types/index.js';

describe('types', () => {
  describe('Role', () => {
    it('should accept valid roles', () => {
      const roles: Role[] = ['system', 'user', 'assistant', 'tool'];
      expect(roles).toHaveLength(4);
    });
  });

  describe('ChatMessage', () => {
    it('should create a valid user message', () => {
      const msg: ChatMessage = { role: 'user', content: 'Hello' };
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello');
    });

    it('should create a valid assistant message with tool calls', () => {
      const msg: ChatMessage = {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'test', arguments: '{}' }
        }]
      };
      expect(msg.tool_calls).toHaveLength(1);
      expect(msg.tool_calls![0].function.name).toBe('test');
    });

    it('should create a valid tool result message', () => {
      const msg: ChatMessage = {
        role: 'tool',
        content: 'Result',
        tool_call_id: 'call_1'
      };
      expect(msg.tool_call_id).toBe('call_1');
    });
  });

  describe('ToolDefinition', () => {
    it('should create a valid tool definition', () => {
      const tool: ToolDefinition = {
        type: 'function',
        function: {
          name: 'test_tool',
          description: 'A test tool',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          }
        }
      };
      expect(tool.function.name).toBe('test_tool');
      expect(tool.function.parameters.required).toContain('name');
    });
  });

  describe('ToolCategory', () => {
    it('should accept valid categories', () => {
      const categories: ToolCategory[] = ['file', 'git', 'search', 'web', 'code', 'system'];
      expect(categories).toHaveLength(6);
    });
  });
});

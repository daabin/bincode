import { describe, it, expect } from 'vitest';
import type { ChatMessage, ToolCall, ToolDefinition, AgentEvent, AgentConfig } from './types.js';

describe('types', () => {
  describe('ChatMessage', () => {
    it('should create a valid user message', () => {
      const message: ChatMessage = {
        role: 'user',
        content: 'Hello, world!',
      };
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
    });

    it('should create a valid assistant message with tool_calls', () => {
      const toolCall: ToolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'read_file',
          arguments: '{"file_path": "/test.txt"}',
        },
      };

      const message: ChatMessage = {
        role: 'assistant',
        content: null,
        tool_calls: [toolCall],
      };

      expect(message.role).toBe('assistant');
      expect(message.tool_calls).toHaveLength(1);
      expect(message.tool_calls?.[0].function.name).toBe('read_file');
    });

    it('should create a valid tool response message', () => {
      const message: ChatMessage = {
        role: 'tool',
        content: 'File content here',
        tool_call_id: 'call_123',
      };

      expect(message.role).toBe('tool');
      expect(message.tool_call_id).toBe('call_123');
    });

    it('should support reasoning_content for DeepSeek', () => {
      const message: ChatMessage = {
        role: 'assistant',
        content: 'Final answer',
        reasoning_content: 'Step 1: Analyze the problem...',
      };

      expect(message.reasoning_content).toBe('Step 1: Analyze the problem...');
    });
  });

  describe('ToolCall', () => {
    it('should have correct structure', () => {
      const toolCall: ToolCall = {
        id: 'call_456',
        type: 'function',
        function: {
          name: 'write_file',
          arguments: '{"file_path": "/test.txt", "content": "hello"}',
        },
      };

      expect(toolCall.id).toBe('call_456');
      expect(toolCall.type).toBe('function');
      expect(toolCall.function.name).toBe('write_file');
      expect(typeof toolCall.function.arguments).toBe('string');
    });
  });

  describe('ToolDefinition', () => {
    it('should define a valid tool schema', () => {
      const toolDef: ToolDefinition = {
        type: 'function',
        function: {
          name: 'list_directory',
          description: 'List directory contents',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Directory path',
              },
            },
            required: ['path'],
          },
        },
      };

      expect(toolDef.type).toBe('function');
      expect(toolDef.function.name).toBe('list_directory');
      expect(toolDef.function.parameters.type).toBe('object');
      expect(toolDef.function.parameters.required).toContain('path');
    });
  });

  describe('AgentEvent', () => {
    it('should create assistant content event', () => {
      const event: AgentEvent = {
        type: 'assistant',
        content: 'Hello!',
      };
      expect(event.type).toBe('assistant');
    });

    it('should create tool_call event', () => {
      const event: AgentEvent = {
        type: 'tool_call',
        name: 'read_file',
        args: { file_path: '/test.txt' },
      };
      expect(event.type).toBe('tool_call');
    });

    it('should create tool_result event', () => {
      const event: AgentEvent = {
        type: 'tool_result',
        name: 'read_file',
        result: 'File contents',
      };
      expect(event.type).toBe('tool_result');
    });

    it('should create error event', () => {
      const event: AgentEvent = {
        type: 'error',
        message: 'Something went wrong',
      };
      expect(event.type).toBe('error');
    });
  });

  describe('AgentConfig', () => {
    it('should have all required fields', () => {
      const config: AgentConfig = {
        cwd: '/workspace',
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        model: 'gpt-4',
        maxIterations: 30,
      };

      expect(config.cwd).toBe('/workspace');
      expect(config.apiKey).toBe('test-key');
      expect(config.baseUrl).toBe('https://api.example.com');
      expect(config.model).toBe('gpt-4');
      expect(config.maxIterations).toBe(30);
    });
  });
});

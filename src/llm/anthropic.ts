import type { ChatMessage, ToolDefinition, ToolCall } from '../types/core.js';
import type { LLMProvider } from './types.js';

type AnthropicResponse = {
  content?: Array<{
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  error?: {
    message?: string;
  };
};

type StreamChunk = {
  type: string;
  delta?: {
    type?: string;
    text?: string;
    partial_json?: string;
  };
  content_block?: {
    type: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
  index?: number;
};

/**
 * Convert our ChatMessage format to Anthropic format
 */
function convertMessages(messages: ChatMessage[]): { system?: string; messages: Array<{ role: string; content: string }> } {
  const systemMsg = messages.find(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');
  
  return {
    system: systemMsg?.content || undefined,
    messages: otherMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || ''
    }))
  };
}

/**
 * Convert our ToolDefinition format to Anthropic format
 */
function convertTools(tools: ToolDefinition[]): Array<{ name: string; description: string; input_schema: unknown }> {
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters
  }));
}

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly defaultModel = 'claude-3-5-sonnet-20241022';
  readonly defaultBaseUrl = 'https://api.anthropic.com/v1';

  async *createChatCompletionStream(options: {
    apiKey: string;
    baseUrl: string;
    model: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
  }): AsyncGenerator<{
    content?: string;
    tool_calls?: ToolCall[];
    reasoning_content?: string;
    done: boolean;
  }> {
    const { system, messages: anthropicMessages } = convertMessages(options.messages);
    const anthropicTools = options.tools.length > 0 ? convertTools(options.tools) : undefined;

    const response = await fetch(`${options.baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: 4096,
        system,
        messages: anthropicMessages,
        tools: anthropicTools,
        stream: true
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error((error as AnthropicResponse).error?.message ?? `Anthropic request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const contentBlocks: Map<number, { type: string; text?: string; toolUse?: { id: string; name: string; input: string } }> = new Map();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6)) as StreamChunk;
            
            if (json.type === 'content_block_delta' && json.delta) {
              const index = json.index ?? 0;
              
              if (json.delta.type === 'text' && json.delta.text) {
                if (!contentBlocks.has(index)) {
                  contentBlocks.set(index, { type: 'text', text: '' });
                }
                const block = contentBlocks.get(index)!;
                block.text = (block.text || '') + json.delta.text;
                
                yield {
                  content: json.delta.text,
                  done: false
                };
              }
              
              if (json.delta.type === 'input_json_delta' && json.delta.partial_json) {
                if (!contentBlocks.has(index)) {
                  contentBlocks.set(index, { type: 'tool_use', toolUse: { id: '', name: '', input: '' } });
                }
                const block = contentBlocks.get(index)!;
                if (block.toolUse) {
                  block.toolUse.input += json.delta.partial_json;
                }
              }
            }
            
            if (json.type === 'content_block_start' && json.content_block) {
              const index = json.index ?? 0;
              if (json.content_block.type === 'tool_use') {
                contentBlocks.set(index, {
                  type: 'tool_use',
                  toolUse: {
                    id: json.content_block.id || '',
                    name: json.content_block.name || '',
                    input: ''
                  }
                });
              }
            }

            if (json.type === 'message_stop') {
              const toolCalls: ToolCall[] = [];
              for (const block of contentBlocks.values()) {
                if (block.type === 'tool_use' && block.toolUse) {
                  toolCalls.push({
                    id: block.toolUse.id,
                    type: 'function',
                    function: {
                      name: block.toolUse.name,
                      arguments: block.toolUse.input || '{}'
                    }
                  });
                }
              }

              if (toolCalls.length > 0) {
                yield {
                  tool_calls: toolCalls,
                  done: true
                };
              } else {
                yield {
                  done: true
                };
              }
            }
          } catch (error) {
            console.error('[Anthropic] Failed to parse SSE chunk:', trimmed, error);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async createChatCompletion(options: {
    apiKey: string;
    baseUrl: string;
    model: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
  }): Promise<{ content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string }> {
    const { system, messages: anthropicMessages } = convertMessages(options.messages);
    const anthropicTools = options.tools.length > 0 ? convertTools(options.tools) : undefined;

    const response = await fetch(`${options.baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: 4096,
        system,
        messages: anthropicMessages,
        tools: anthropicTools
      })
    });

    const payload = (await response.json().catch(() => ({}))) as AnthropicResponse;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? `Anthropic request failed: ${response.status}`);
    }

    const content = payload.content || [];
    const textContent = content.filter(c => c.type === 'text').map(c => c.text).join('');
    const toolCalls = content
      .filter(c => c.type === 'tool_use')
      .map(c => ({
        id: c.id || `call_${Date.now()}`,
        type: 'function' as const,
        function: {
          name: c.name || '',
          arguments: JSON.stringify(c.input || {})
        }
      }));

    return {
      content: textContent || null,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }
}
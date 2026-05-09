import type { ChatMessage, ToolDefinition, ToolCall } from '../types.js';
import type { LLMProvider } from './types.js';

type OllamaResponse = {
  message?: {
    content?: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  };
  done?: boolean;
  error?: string;
};

type OllamaModel = {
  name: string;
  model?: string;
};

/**
 * Filter out system messages and tool-related messages for Ollama
 * Ollama has limited tool support depending on the model
 */
function convertMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
  return messages
    .filter(m => m.role !== 'tool')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || ''
    }));
}

export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama';
  readonly defaultModel = 'llama3.2';
  readonly defaultBaseUrl = 'http://localhost:11434';

  /**
   * Check if Ollama is available and list models
   */
  async listModels(baseUrl: string): Promise<string[]> {
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, {
        method: 'GET'
      });
      
      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { models?: OllamaModel[] };
      return (data.models || []).map(m => m.name);
    } catch {
      return [];
    }
  }

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
    const ollamaMessages = convertMessages(options.messages);
    
    // Ollama tool format (limited support)
    const tools = options.tools.length > 0 ? options.tools.map(t => ({
      type: 'function',
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }
    })) : undefined;

    const response = await fetch(`${options.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model,
        messages: ollamaMessages,
        tools,
        stream: true,
        options: {
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let toolCalls: ToolCall[] | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const json = JSON.parse(trimmed) as OllamaResponse;
            
            if (json.error) {
              throw new Error(`Ollama error: ${json.error}`);
            }

            const content = json.message?.content;
            if (content) {
              fullContent += content;
              yield {
                content,
                done: false
              };
            }

            // Check for tool calls in the final message
            if (json.done && json.message?.tool_calls) {
              toolCalls = json.message.tool_calls.map((tc, i) => ({
                id: `call_${Date.now()}_${i}`,
                type: 'function' as const,
                function: {
                  name: tc.function.name,
                  arguments: JSON.stringify(tc.function.arguments)
                }
              }));
            }

            if (json.done) {
              if (toolCalls && toolCalls.length > 0) {
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
            if (error instanceof SyntaxError) continue;
            throw error;
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
    const ollamaMessages = convertMessages(options.messages);
    
    const tools = options.tools.length > 0 ? options.tools.map(t => ({
      type: 'function',
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters
      }
    })) : undefined;

    const response = await fetch(`${options.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model,
        messages: ollamaMessages,
        tools,
        stream: false,
        options: {
          temperature: 0.2
        }
      })
    });

    const payload = (await response.json().catch(() => ({}))) as OllamaResponse;

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const toolCalls = payload.message?.tool_calls?.map((tc, i) => ({
      id: `call_${Date.now()}_${i}`,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: JSON.stringify(tc.function.arguments)
      }
    }));

    return {
      content: payload.message?.content || null,
      tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined
    };
  }
}

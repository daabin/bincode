import type { ChatMessage, ToolDefinition, ToolCall } from '../types/core.js';
import type { LLMProvider } from './types.js';
import { 
  withRetry, 
  fetchWithTimeout, 
  createAPIErrorFromResponse, 
  createAPIErrorFromNetworkError,
  type APIError 
} from '../retry.js';

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: ToolCall[];
      reasoning_content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

type StreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
      reasoning_content?: string;
    };
    finish_reason?: string | null;
  }>;
};

export class DeepSeekProvider implements LLMProvider {
  readonly name = 'deepseek';
  readonly defaultModel = 'deepseek-chat';
  readonly defaultBaseUrl = 'https://api.deepseek.com';

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
    const response = await withRetry(
      async () => {
        const res = await fetchWithTimeout(
          `${options.baseUrl.replace(/\/$/, '')}/chat/completions`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${options.apiKey}`
            },
            body: JSON.stringify({
              model: options.model,
              messages: options.messages,
              tools: options.tools,
              tool_choice: 'auto',
              temperature: 0.2,
              max_tokens: 4096,
              stream: true
            })
          },
          60000 // 60 second timeout for streaming start
        );

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}));
          throw createAPIErrorFromResponse(res, errorBody as DeepSeekResponse);
        }

        return res;
      },
      { maxRetries: 3 },
      (attempt, error, delayMs) => {
        console.error(`[DeepSeek] Attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs}ms...`);
      }
    );

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';
    let accumulatedToolCalls: Array<{
      index: number;
      id?: string;
      type?: string;
      function?: { name?: string; arguments?: string };
    }> = [];
    let accumulatedReasoning = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6)) as StreamChunk;
            const delta = json.choices?.[0]?.delta;
            const finishReason = json.choices?.[0]?.finish_reason;

            if (delta?.content) {
              accumulatedContent += delta.content;
              yield {
                content: delta.content,
                done: false
              };
            }

            if (delta?.reasoning_content) {
              accumulatedReasoning += delta.reasoning_content;
            }

            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                const index = toolCall.index ?? 0;
                if (!accumulatedToolCalls[index]) {
                  accumulatedToolCalls[index] = {
                    index,
                    id: toolCall.id,
                    type: toolCall.type,
                    function: { name: '', arguments: '' }
                  };
                }

                if (toolCall.function?.name) {
                  accumulatedToolCalls[index].function!.name = toolCall.function.name;
                }
                if (toolCall.function?.arguments) {
                  accumulatedToolCalls[index].function!.arguments =
                    (accumulatedToolCalls[index].function!.arguments || '') +
                    toolCall.function.arguments;
                }
              }
            }

            if (finishReason) {
              if (accumulatedToolCalls.length > 0) {
                const toolCalls: ToolCall[] = accumulatedToolCalls.map(tc => ({
                  id: tc.id || `call_${Date.now()}`,
                  type: 'function' as const,
                  function: {
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || '{}'
                  }
                }));

                yield {
                  tool_calls: toolCalls,
                  reasoning_content: accumulatedReasoning || undefined,
                  done: true
                };
              } else {
                yield {
                  reasoning_content: accumulatedReasoning || undefined,
                  done: true
                };
              }
            }
          } catch (error) {
            console.error('[DeepSeek] Failed to parse SSE chunk:', trimmed, error);
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
    return withRetry(
      async () => {
        const response = await fetchWithTimeout(
          `${options.baseUrl.replace(/\/$/, '')}/chat/completions`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${options.apiKey}`
            },
            body: JSON.stringify({
              model: options.model,
              messages: options.messages,
              tools: options.tools,
              tool_choice: 'auto',
              temperature: 0.2,
              max_tokens: 4096
            })
          },
          30000 // 30 second timeout
        );

        const payload = (await response.json().catch(() => ({}))) as DeepSeekResponse;

        if (!response.ok) {
          throw createAPIErrorFromResponse(response, payload);
        }

        const message = payload.choices?.[0]?.message;
        if (!message) {
          throw new Error('DeepSeek response did not include a message.');
        }

        return {
          content: message.content ?? null,
          tool_calls: message.tool_calls,
          reasoning_content: message.reasoning_content
        };
      },
      { maxRetries: 3 },
      (attempt, error, delayMs) => {
        console.error(`[DeepSeek] Attempt ${attempt} failed: ${error.message}. Retrying in ${delayMs}ms...`);
      }
    );
  }
}
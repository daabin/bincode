import type { ChatMessage, ToolDefinition, ToolCall } from './types.js';

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

/**
 * 流式 Chat Completion
 * 使用 SSE (Server-Sent Events) 逐 token 返回结果
 */
export async function* createChatCompletionStream(options: {
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
  const response = await fetch(`${options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
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
      stream: true  // 启用流式响应
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as DeepSeekResponse).error?.message ?? `DeepSeek request failed: ${response.status}`);
  }

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
            // 流结束，返回完整的工具调用
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

/**
 * 非流式 Chat Completion（向后兼容）
 */
export async function createChatCompletion(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
}): Promise<{ content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string }> {
  const response = await fetch(`${options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
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
  });

  const payload = (await response.json().catch(() => ({}))) as DeepSeekResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `DeepSeek request failed: ${response.status}`);
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
}
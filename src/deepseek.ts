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
      // deepseek-v4-flash 支持更长的上下文，启用 max_tokens 限制防止无限输出
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

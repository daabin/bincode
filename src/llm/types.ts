import type { ChatMessage, ToolDefinition, ToolCall } from '../types.js';

/**
 * LLM Provider 统一接口
 */
export interface LLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  readonly defaultBaseUrl: string;
  
  /**
   * 流式对话完成
   */
  createChatCompletionStream(options: {
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
  }>;

  /**
   * 非流式对话完成
   */
  createChatCompletion(options: {
    apiKey: string;
    baseUrl: string;
    model: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
  }): Promise<{
    content: string | null;
    tool_calls?: ToolCall[];
    reasoning_content?: string;
  }>;
}

/**
 * Provider 配置
 */
export interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * 支持的 Provider 类型
 */
export type ProviderType = 'deepseek';
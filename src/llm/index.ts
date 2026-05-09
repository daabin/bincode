import type { LLMProvider, ProviderConfig, ProviderType } from './types.js';
import { DeepSeekProvider } from './deepseek.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';

export type { LLMProvider, ProviderConfig, ProviderType } from './types.js';
export { DeepSeekProvider } from './deepseek.js';
export { OpenAIProvider } from './openai.js';
export { AnthropicProvider } from './anthropic.js';
export { OllamaProvider } from './ollama.js';

/**
 * Provider 工厂
 */
export function createProvider(type: ProviderType, config: ProviderConfig): LLMProvider {
  switch (type) {
    case 'deepseek':
      return new DeepSeekProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    case 'ollama':
      return new OllamaProvider();
    case 'custom':
      // Custom uses OpenAI-compatible API
      return new OpenAIProvider();
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * 获取所有支持的 Provider 类型
 */
export function getSupportedProviders(): ProviderType[] {
  return ['deepseek', 'openai', 'anthropic', 'ollama', 'custom'];
}

/**
 * 获取 Provider 的默认配置
 */
export function getProviderDefaults(type: ProviderType): {
  model: string;
  baseUrl: string;
  apiKeyEnvVar: string;
} {
  switch (type) {
    case 'deepseek':
      return {
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY'
      };
    case 'openai':
      return {
        model: 'gpt-4o',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEnvVar: 'OPENAI_API_KEY'
      };
    case 'anthropic':
      return {
        model: 'claude-3-5-sonnet-20241022',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY'
      };
    case 'ollama':
      return {
        model: 'llama3.2',
        baseUrl: 'http://localhost:11434',
        apiKeyEnvVar: '' // Ollama doesn't require API key
      };
    case 'custom':
      return {
        model: 'gpt-4',
        baseUrl: 'http://localhost:8000/v1',
        apiKeyEnvVar: 'CUSTOM_API_KEY'
      };
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

/**
 * 检测本地 Ollama 是否可用
 */
export async function detectOllama(): Promise<{ available: boolean; models: string[] }> {
  const ollama = new OllamaProvider();
  try {
    const models = await ollama.listModels(ollama.defaultBaseUrl);
    return { available: models.length > 0, models };
  } catch {
    return { available: false, models: [] };
  }
}

/**
 * 自动检测可用的 Provider
 */
export async function detectAvailableProviders(): Promise<ProviderType[]> {
  const available: ProviderType[] = [];
  
  // Check environment variables for cloud providers
  if (process.env.DEEPSEEK_API_KEY) available.push('deepseek');
  if (process.env.OPENAI_API_KEY) available.push('openai');
  if (process.env.ANTHROPIC_API_KEY) available.push('anthropic');
  
  // Check for local Ollama
  const ollama = await detectOllama();
  if (ollama.available) available.push('ollama');
  
  return available;
}

import type { LLMProvider, ProviderConfig, ProviderType } from './types.js';
import { DeepSeekProvider } from './deepseek.js';

export type { LLMProvider, ProviderConfig, ProviderType } from './types.js';
export { DeepSeekProvider } from './deepseek.js';

/**
 * Provider 工厂（仅支持 deepseek）
 */
export function createProvider(_type: ProviderType, _config: ProviderConfig): LLMProvider {
  return new DeepSeekProvider();
}

/**
 * 获取所有支持的 Provider 类型
 */
export function getSupportedProviders(): ProviderType[] {
  return ['deepseek'];
}

/**
 * 获取 Provider 的默认配置
 */
export function getProviderDefaults(_type: ProviderType): {
  model: string;
  baseUrl: string;
  apiKeyEnvVar: string;
} {
  return {
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY'
  };
}
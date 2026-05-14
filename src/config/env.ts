/**
 * Environment variable configuration
 */

import type { ProviderType } from '../llm/types.js';

const ENV_VAR_MAP: Record<ProviderType, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  ollama: 'OLLAMA_API_KEY',
  custom: 'BINCODE_API_KEY'
};

const BASE_URL_MAP: Record<ProviderType, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  ollama: 'http://localhost:11434',
  custom: ''
};

const MODEL_MAP: Record<ProviderType, string> = {
  deepseek: 'deepseek-chat',
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  ollama: 'llama3.2',
  custom: ''
};

/**
 * Get the environment variable name for a provider's API key
 */
export function getEnvVarName(provider: ProviderType): string {
  return ENV_VAR_MAP[provider] || 'DEEPSEEK_API_KEY';
}

/**
 * Get API key from environment variables
 */
export function getApiKeyFromEnv(provider: ProviderType): string | undefined {
  const envVar = getEnvVarName(provider);
  return process.env[envVar] || process.env.BINCODE_API_KEY;
}

/**
 * Get default base URL for a provider
 */
export function getDefaultBaseUrl(provider: ProviderType): string {
  return BASE_URL_MAP[provider] || 'https://api.deepseek.com';
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: ProviderType): string {
  return MODEL_MAP[provider] || 'deepseek-chat';
}

/**
 * Get provider from environment variable
 */
export function getProviderFromEnv(): ProviderType | undefined {
  const provider = process.env.BINCODE_PROVIDER;
  if (provider && ['deepseek', 'openai', 'anthropic', 'ollama'].includes(provider)) {
    return provider as ProviderType;
  }
  return undefined;
}

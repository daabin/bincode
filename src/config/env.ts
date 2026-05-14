/**
 * Environment variable configuration (DeepSeek only)
 */

import type { ProviderType } from '../llm/types.js';

/**
 * Get the environment variable name for DeepSeek API key
 */
export function getEnvVarName(_provider?: ProviderType): string {
  return 'DEEPSEEK_API_KEY';
}

/**
 * Get API key from environment variables
 */
export function getApiKeyFromEnv(_provider?: ProviderType): string | undefined {
  return process.env.DEEPSEEK_API_KEY || process.env.BINCODE_API_KEY;
}

/**
 * Get default base URL for DeepSeek
 */
export function getDefaultBaseUrl(_provider?: ProviderType): string {
  return 'https://api.deepseek.com';
}

/**
 * Get default model for DeepSeek
 */
export function getDefaultModel(_provider?: ProviderType): string {
  return 'deepseek-chat';
}

/**
 * Get provider from environment variable (always returns 'deepseek')
 */
export function getProviderFromEnv(): ProviderType {
  return 'deepseek';
}

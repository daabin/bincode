/**
 * Configuration module
 * Unified API for reading/writing configuration
 */

import type { Config } from '../types/config.js';
import type { ProviderType } from '../llm/types.js';
import { loadConfigFile, saveConfigFile } from './loader.js';
import { getApiKeyFromEnv, getDefaultBaseUrl, getDefaultModel, getProviderFromEnv } from './env.js';

export { ConfigWatcher } from './watcher.js';
export type { ConfigChangeCallback } from './watcher.js';

/**
 * Load configuration (file + env overrides)
 */
export function loadConfig(): Config {
  return loadConfigFile();
}

/**
 * Save configuration
 */
export function saveConfig(config: Config): void {
  saveConfigFile(config);
}

/**
 * Get current provider
 * Priority: env var > config file > default
 */
export function getProvider(): ProviderType {
  return getProviderFromEnv() || loadConfigFile().provider || 'deepseek';
}

/**
 * Set provider
 */
export function setProvider(provider: ProviderType): void {
  const config = loadConfigFile();
  config.provider = provider;
  saveConfigFile(config);
}

/**
 * Get API key for current provider
 * Priority: env var > config file
 */
export function getApiKey(): string | undefined {
  const provider = getProvider();
  return getApiKeyFromEnv(provider) || loadConfigFile().apiKey;
}

/**
 * Set API key
 */
export function setApiKey(apiKey: string): void {
  const config = loadConfigFile();
  config.apiKey = apiKey;
  saveConfigFile(config);
}

/**
 * Get base URL for current provider
 * Priority: config file > env var > default
 */
export function getBaseUrl(): string {
  const provider = getProvider();
  return loadConfigFile().baseUrl || getDefaultBaseUrl(provider);
}

/**
 * Set base URL
 */
export function setBaseUrl(baseUrl: string): void {
  const config = loadConfigFile();
  config.baseUrl = baseUrl;
  saveConfigFile(config);
}

/**
 * Get model for current provider
 * Priority: config file > env var > default
 */
export function getModel(): string {
  const provider = getProvider();
  return loadConfigFile().model || getDefaultModel(provider);
}

/**
 * Set model
 */
export function setModel(model: string): void {
  const config = loadConfigFile();
  config.model = model;
  saveConfigFile(config);
}

/**
 * Get complete LLM configuration
 */
export function getLLMConfig(): { provider: ProviderType; apiKey: string; baseUrl: string; model: string } {
  const provider = getProvider();
  return {
    provider,
    apiKey: getApiKey() || '',
    baseUrl: getBaseUrl(),
    model: getModel()
  };
}

/**
 * Check if a command is allowed
 */
export function isCommandAllowed(command: string): boolean {
  const config = loadConfigFile();
  const baseCommand = command.split('/').pop()?.split(' ')[0] || command;

  if (config.deniedCommands?.includes(baseCommand)) {
    return false;
  }

  if (config.allowedCommands) {
    return config.allowedCommands.includes(baseCommand);
  }

  // Default allowed commands
  const defaultAllowed = [
    'npm', 'git', 'node', 'tsc', 'eslint', 'npx', 'yarn', 'pnpm',
    'cat', 'ls', 'pwd', 'echo', 'head', 'tail', 'wc', 'sort', 'uniq',
    'rg', 'grep', 'find', 'sed', 'awk',
    'curl', 'wget',
    'python', 'python3',
    'mkdir', 'cp', 'mv', 'rm',
    'docker', 'make', 'cargo', 'go', 'rustc',
    'deno', 'bun'
  ];

  return defaultAllowed.includes(baseCommand);
}

/**
 * Get allowed commands list
 */
export function getAllowedCommands(): string[] {
  const config = loadConfigFile();
  return config.allowedCommands || [
    'npm', 'git', 'node', 'tsc', 'eslint', 'npx', 'yarn', 'pnpm',
    'cat', 'ls', 'pwd', 'echo', 'head', 'tail', 'wc', 'sort', 'uniq',
    'rg', 'grep', 'find', 'sed', 'awk',
    'curl', 'wget',
    'python', 'python3',
    'mkdir', 'cp', 'mv', 'rm',
    'docker', 'make', 'cargo', 'go', 'rustc',
    'deno', 'bun'
  ];
}

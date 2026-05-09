import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ProviderType } from './llm/index.js';

export interface Config {
  provider?: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.bincode');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * 确保配置目录存在
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { mode: 0o700, recursive: true });
  }
}

/**
 * 读取配置文件
 */
export function loadConfig(): Config {
  try {
    ensureConfigDir();
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }

    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content) as Config;
  } catch (error) {
    console.error('Failed to load config:', error);
    return {};
  }
}

/**
 * 保存配置文件
 */
export function saveConfig(config: Config): void {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
      mode: 0o600 // 仅用户可读写
    });
  } catch (error) {
    throw new Error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 获取 Provider 类型
 */
export function getProvider(): ProviderType {
  const config = loadConfig();
  return (config.provider || process.env.BINCODE_PROVIDER || 'deepseek') as ProviderType;
}

/**
 * 设置 Provider 类型
 */
export function setProvider(provider: ProviderType): void {
  const config = loadConfig();
  config.provider = provider;
  saveConfig(config);
}

/**
 * 获取 API Key，优先级：环境变量 > 配置文件
 * 根据当前 provider 获取对应的环境变量
 */
export function getApiKey(): string | undefined {
  const provider = getProvider();
  const envVarMap: Record<ProviderType, string> = {
    deepseek: 'DEEPSEEK_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    ollama: '', // Ollama doesn't require API key
    custom: 'CUSTOM_API_KEY'
  };
  
  const envVar = envVarMap[provider];
  const envKey = envVar ? process.env[envVar] : undefined;
  return envKey || loadConfig().apiKey;
}

/**
 * 更新 API Key
 */
export function setApiKey(apiKey: string): void {
  const config = loadConfig();
  config.apiKey = apiKey;
  saveConfig(config);
}

/**
 * 删除 API Key
 */
export function clearApiKey(): void {
  const config = loadConfig();
  delete config.apiKey;
  saveConfig(config);
}

/**
 * 获取 Base URL，优先级：环境变量 > 配置文件 > 默认值
 * 根据当前 provider 获取对应的环境变量
 */
export function getBaseUrl(): string {
  const provider = getProvider();
  const config = loadConfig();
  
  const envVarMap: Record<ProviderType, string> = {
    deepseek: 'DEEPSEEK_BASE_URL',
    openai: 'OPENAI_BASE_URL',
    anthropic: 'ANTHROPIC_BASE_URL',
    ollama: 'OLLAMA_BASE_URL',
    custom: 'CUSTOM_BASE_URL'
  };
  
  const envVar = envVarMap[provider];
  const envUrl = envVar ? process.env[envVar] : undefined;
  
  const defaultUrls: Record<ProviderType, string> = {
    deepseek: 'https://api.deepseek.com',
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
    ollama: 'http://localhost:11434',
    custom: 'http://localhost:8000/v1'
  };
  
  return envUrl || config.baseUrl || defaultUrls[provider];
}

/**
 * 获取模型名称，优先级：环境变量 > 配置文件 > 默认值
 * 根据当前 provider 获取对应的环境变量
 */
export function getModel(): string {
  const provider = getProvider();
  const config = loadConfig();
  
  const envVarMap: Record<ProviderType, string> = {
    deepseek: 'DEEPSEEK_MODEL',
    openai: 'OPENAI_MODEL',
    anthropic: 'ANTHROPIC_MODEL',
    ollama: 'OLLAMA_MODEL',
    custom: 'CUSTOM_MODEL'
  };
  
  const envVar = envVarMap[provider];
  const envModel = envVar ? process.env[envVar] : undefined;
  
  const defaultModels: Record<ProviderType, string> = {
    deepseek: 'deepseek-chat',
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    ollama: 'llama3.2',
    custom: 'gpt-4'
  };
  
  return envModel || config.model || defaultModels[provider];
}

/**
 * 获取配置文件路径（用于文档说明）
 */
export function getConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * 获取完整的 LLM 配置
 */
export function getLLMConfig() {
  return {
    provider: getProvider(),
    apiKey: getApiKey(),
    baseUrl: getBaseUrl(),
    model: getModel()
  };
}

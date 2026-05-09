import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ProviderType } from './llm/index.js';

export interface Config {
  provider?: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  allowedCommands?: string[];
  deniedCommands?: string[];
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

/**
 * 默认允许的命令
 */
const DEFAULT_ALLOWED_COMMANDS = [
  'npm', 'yarn', 'pnpm', 'bun',
  'node', 'tsx', 'ts-node', 'deno',
  'git',
  'eslint', 'tsc', 'prettier',
  'cat', 'ls', 'pwd', 'echo', 'which',
  'python', 'python3', 'pip',
  'cargo', 'rustc',
  'go', 'java', 'javac'
];

/**
 * 获取允许的命令列表
 */
export function getAllowedCommands(): Set<string> {
  const config = loadConfig();
  
  // 如果配置了自定义允许列表，使用它
  if (config.allowedCommands && config.allowedCommands.length > 0) {
    return new Set(config.allowedCommands);
  }
  
  // 否则使用默认列表
  return new Set(DEFAULT_ALLOWED_COMMANDS);
}

/**
 * 获取禁止的命令列表
 */
export function getDeniedCommands(): Set<string> {
  const config = loadConfig();
  return new Set(config.deniedCommands || []);
}

/**
 * 检查命令是否允许执行
 */
export function isCommandAllowed(command: string): boolean {
  const denied = getDeniedCommands();
  const allowed = getAllowedCommands();
  
  // 先检查黑名单
  if (denied.has(command)) {
    return false;
  }
  
  // 检查是否匹配通配符黑名单
  for (const deniedCmd of denied) {
    if (deniedCmd.endsWith('*') && command.startsWith(deniedCmd.slice(0, -1))) {
      return false;
    }
  }
  
  // 检查白名单
  if (allowed.has(command)) {
    return true;
  }
  
  // 检查是否匹配通配符白名单
  for (const allowedCmd of allowed) {
    if (allowedCmd.endsWith('*') && command.startsWith(allowedCmd.slice(0, -1))) {
      return true;
    }
  }
  
  return false;
}

/**
 * 设置允许的命令列表
 */
export function setAllowedCommands(commands: string[]): void {
  const config = loadConfig();
  config.allowedCommands = commands;
  saveConfig(config);
}

/**
 * 设置禁止的命令列表
 */
export function setDeniedCommands(commands: string[]): void {
  const config = loadConfig();
  config.deniedCommands = commands;
  saveConfig(config);
}

/**
 * 添加允许的命令
 */
export function addAllowedCommand(command: string): void {
  const config = loadConfig();
  config.allowedCommands = [...(config.allowedCommands || []), command];
  saveConfig(config);
}

/**
 * 添加禁止的命令
 */
export function addDeniedCommand(command: string): void {
  const config = loadConfig();
  config.deniedCommands = [...(config.deniedCommands || []), command];
  saveConfig(config);
}

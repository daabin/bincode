import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface Config {
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
      mode: 0o600
    });
  } catch (error) {
    throw new Error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 获取 API Key，优先级：环境变量 > 配置文件
 */
export function getApiKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY || loadConfig().apiKey;
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
 */
export function getBaseUrl(): string {
  return process.env.DEEPSEEK_BASE_URL || loadConfig().baseUrl || 'https://api.deepseek.com';
}

/**
 * 获取模型名称，优先级：环境变量 > 配置文件 > 默认值
 */
export function getModel(): string {
  return process.env.DEEPSEEK_MODEL || loadConfig().model || 'deepseek-chat';
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
    apiKey: getApiKey(),
    baseUrl: getBaseUrl(),
    model: getModel()
  };
}

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

export function getAllowedCommands(): Set<string> {
  const config = loadConfig();
  if (config.allowedCommands && config.allowedCommands.length > 0) {
    return new Set(config.allowedCommands);
  }
  return new Set(DEFAULT_ALLOWED_COMMANDS);
}

export function getDeniedCommands(): Set<string> {
  const config = loadConfig();
  return new Set(config.deniedCommands || []);
}

export function isCommandAllowed(command: string): boolean {
  const denied = getDeniedCommands();
  const allowed = getAllowedCommands();

  if (denied.has(command)) return false;

  for (const deniedCmd of denied) {
    if (deniedCmd.endsWith('*') && command.startsWith(deniedCmd.slice(0, -1))) {
      return false;
    }
  }

  if (allowed.has(command)) return true;

  for (const allowedCmd of allowed) {
    if (allowedCmd.endsWith('*') && command.startsWith(allowedCmd.slice(0, -1))) {
      return true;
    }
  }

  return false;
}

export function setAllowedCommands(commands: string[]): void {
  const config = loadConfig();
  config.allowedCommands = commands;
  saveConfig(config);
}

export function setDeniedCommands(commands: string[]): void {
  const config = loadConfig();
  config.deniedCommands = commands;
  saveConfig(config);
}

export function addAllowedCommand(command: string): void {
  const config = loadConfig();
  config.allowedCommands = [...(config.allowedCommands || []), command];
  saveConfig(config);
}

export function addDeniedCommand(command: string): void {
  const config = loadConfig();
  config.deniedCommands = [...(config.deniedCommands || []), command];
  saveConfig(config);
}

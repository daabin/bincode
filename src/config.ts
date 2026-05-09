import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface Config {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

/**
 * 获取配置目录（每次调用时读取环境变量以支持测试覆盖）
 */
function getConfigDir(): string {
  return process.env.BINCODE_CONFIG_DIR || path.join(os.homedir(), '.bincode');
}

function getConfigFile(): string {
  return path.join(getConfigDir(), 'config.json');
}

/**
 * 确保配置目录存在
 */
function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { mode: 0o700, recursive: true });
  }
}

/**
 * 读取配置文件
 */
export function loadConfig(): Config {
  try {
    ensureConfigDir();
    const configFile = getConfigFile();
    if (!fs.existsSync(configFile)) {
      return {};
    }

    const content = fs.readFileSync(configFile, 'utf-8');
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
    fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2), {
      mode: 0o600 // 仅用户可读写
    });
  } catch (error) {
    throw new Error(`Failed to save config: ${error instanceof Error ? error.message : String(error)}`);
  }
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
 * 获取 API Key，优先级：环境变量 > 配置文件
 */
export function getApiKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY || loadConfig().apiKey;
}

/**
 * 获取 Base URL，优先级：环境变量 > 配置文件 > 默认值
 */
export function getBaseUrl(): string {
  return (
    process.env.DEEPSEEK_BASE_URL ||
    loadConfig().baseUrl ||
    'https://api.deepseek.com'
  );
}

/**
 * 获取模型名称，优先级：环境变量 > 配置文件 > 默认值
 */
export function getModel(): string {
  return (
    process.env.DEEPSEEK_MODEL ||
    loadConfig().model ||
    'deepseek-v4-pro'
  );
}

/**
 * 获取配置文件路径（用于文档说明）
 */
export function getConfigPath(): string {
  return getConfigFile();
}

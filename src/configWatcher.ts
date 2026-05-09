import * as fs from 'node:fs';
import type { Config } from './config.js';
import { loadConfig, saveConfig, getConfigPath } from './config.js';

/**
 * 配置变更回调
 */
export type ConfigChangeCallback = (config: Config) => void;

/**
 * 配置错误回调
 */
export type ConfigErrorCallback = (error: Error) => void;

/**
 * 配置监听器
 */
class ConfigWatcher {
  private watcher: fs.FSWatcher | null = null;
  private callbacks: Set<ConfigChangeCallback> = new Set();
  private errorCallbacks: Set<ConfigErrorCallback> = new Set();
  private lastModified: number = 0;
  private debounceTimer: NodeJS.Timeout | null = null;

  /**
   * 开始监听配置文件变化
   */
  start(): void {
    if (this.watcher) {
      return;
    }

    const configPath = getConfigPath();
    const configDir = configPath.substring(0, configPath.lastIndexOf('/'));

    // 确保目录存在
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { mode: 0o700, recursive: true });
    }

    try {
      this.lastModified = this.getFileModified();
    } catch {
      this.lastModified = 0;
    }

    this.watcher = fs.watch(configPath, (eventType) => {
      if (eventType === 'change') {
        this.handleFileChange();
      }
    });

    // 处理文件不存在的情况
    this.watcher.on('error', () => {
      // 文件可能被删除，稍后重试
      this.stop();
      setTimeout(() => this.start(), 1000);
    });
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * 注册配置变更回调
   */
  onChange(callback: ConfigChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * 注册错误回调
   */
  onError(callback: ConfigErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  private getFileModified(): number {
    try {
      const stat = fs.statSync(getConfigPath());
      return stat.mtimeMs;
    } catch {
      return 0;
    }
  }

  private handleFileChange(): void {
    // 防抖处理
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      const currentModified = this.getFileModified();
      
      // 检查文件是否真的改变了
      if (currentModified > this.lastModified) {
        this.lastModified = currentModified;
        this.reloadConfig();
      }
    }, 100);
  }

  private reloadConfig(): void {
    try {
      const config = loadConfig();
      for (const callback of this.callbacks) {
        try {
          callback(config);
        } catch (error) {
          console.error('Config change callback error:', error);
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      for (const callback of this.errorCallbacks) {
        try {
          callback(err);
        } catch (e) {
          console.error('Config error callback error:', e);
        }
      }
    }
  }
}

// 全局配置监听器实例
export const configWatcher = new ConfigWatcher();

/**
 * 显示当前配置
 */
export function showConfig(): string {
  const config = loadConfig();
  const lines: string[] = ['📋 Current Configuration:', ''];
  
  lines.push(`  Provider: ${config.provider || 'deepseek (default)'}`);
  lines.push(`  API Key: ${config.apiKey ? '*** (set)' : '(not set)'}`);
  lines.push(`  Base URL: ${config.baseUrl || '(default)'}`);
  lines.push(`  Model: ${config.model || '(default)'}`);
  
  if (config.allowedCommands && config.allowedCommands.length > 0) {
    lines.push(`  Allowed Commands: ${config.allowedCommands.slice(0, 5).join(', ')}${config.allowedCommands.length > 5 ? '...' : ''}`);
  }
  
  if (config.deniedCommands && config.deniedCommands.length > 0) {
    lines.push(`  Denied Commands: ${config.deniedCommands.join(', ')}`);
  }
  
  lines.push('');
  lines.push(`Config file: ${getConfigPath()}`);
  
  return lines.join('\n');
}

/**
 * 初始化配置向导
 */
export function initConfigWizard(): string {
  const configPath = getConfigPath();
  const existingConfig = loadConfig();
  
  if (existingConfig.apiKey || existingConfig.provider) {
    return `Configuration already exists at ${configPath}\nUse /config to view current settings.`;
  }
  
  const defaultConfig: Config = {
    provider: 'deepseek',
    apiKey: '',
    baseUrl: '',
    model: ''
  };
  
  saveConfig(defaultConfig);
  
  return [
    '✓ Configuration file created!',
    '',
    `Location: ${configPath}`,
    '',
    'Next steps:',
    '1. Set your API key: /setkey <your-api-key>',
    '2. Or edit the config file directly',
    '',
    'Supported providers: deepseek, openai, anthropic, ollama'
  ].join('\n');
}

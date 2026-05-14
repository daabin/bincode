import * as fs from 'node:fs';
import type { Config } from './config.js';
import { loadConfig, saveConfig, getConfigPath } from './config.js';

export type ConfigChangeCallback = (config: Config) => void;
export type ConfigErrorCallback = (error: Error) => void;

class ConfigWatcher {
  private watcher: fs.FSWatcher | null = null;
  private callbacks: Set<ConfigChangeCallback> = new Set();
  private errorCallbacks: Set<ConfigErrorCallback> = new Set();
  private lastModified: number = 0;
  private debounceTimer: NodeJS.Timeout | null = null;

  start(): void {
    if (this.watcher) return;

    const configPath = getConfigPath();
    const configDir = configPath.substring(0, configPath.lastIndexOf('/'));

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { mode: 0o700, recursive: true });
    }

    try {
      this.lastModified = this.getFileModified();
    } catch {
      this.lastModified = 0;
    }

    this.watcher = fs.watch(configPath, (eventType) => {
      if (eventType === 'change') this.handleFileChange();
    });

    this.watcher.on('error', () => {
      this.stop();
      setTimeout(() => this.start(), 1000);
    });
  }

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

  onChange(callback: ConfigChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  onError(callback: ConfigErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  private getFileModified(): number {
    try {
      return fs.statSync(getConfigPath()).mtimeMs;
    } catch {
      return 0;
    }
  }

  private handleFileChange(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const currentModified = this.getFileModified();
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
        try { callback(config); } catch (error) { console.error('Config change callback error:', error); }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      for (const callback of this.errorCallbacks) {
        try { callback(err); } catch (e) { console.error('Config error callback error:', e); }
      }
    }
  }
}

export const configWatcher = new ConfigWatcher();

/**
 * 显示当前配置
 */
export function showConfig(): string {
  const config = loadConfig();
  const lines: string[] = ['📋 Current Configuration:', ''];

  lines.push(`  Provider: deepseek`);
  lines.push(`  API Key: ${config.apiKey ? '*** (set)' : '(not set)'}`);
  lines.push(`  Base URL: ${config.baseUrl || '(default: https://api.deepseek.com)'}`);
  lines.push(`  Model: ${config.model || '(default: deepseek-chat)'}`);

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

  if (existingConfig.apiKey) {
    return `Configuration already exists at ${configPath}\nUse /config to view current settings.`;
  }

  saveConfig({ apiKey: '', baseUrl: '', model: '' });

  return [
    '✓ Configuration file created!',
    '',
    `Location: ${configPath}`,
    '',
    'Next steps:',
    '1. Set your DeepSeek API key: /setkey <your-api-key>',
    '2. Or set DEEPSEEK_API_KEY environment variable'
  ].join('\n');
}

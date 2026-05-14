/**
 * Configuration file watcher
 * Provides hot-reload for configuration changes
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Config } from '../types/config.js';

const CONFIG_FILE = path.join(os.homedir(), '.bincode', 'config.json');

export type ConfigChangeCallback = (config: Config) => void;

export class ConfigWatcher {
  private watcher: fs.FSWatcher | null = null;
  private callbacks: Set<ConfigChangeCallback> = new Set();
  private currentConfig: Config = {};

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
        this.currentConfig = JSON.parse(content) as Config;
      }
    } catch {
      this.currentConfig = {};
    }
  }

  /**
   * Start watching config file for changes
   */
  start(): void {
    if (this.watcher) return;

    try {
      this.watcher = fs.watch(CONFIG_FILE, (eventType) => {
        if (eventType === 'change') {
          this.loadConfig();
          for (const callback of this.callbacks) {
            try {
              callback(this.currentConfig);
            } catch {
              // Ignore callback errors
            }
          }
        }
      });
    } catch {
      // File watching not supported (e.g., non-local filesystem)
    }
  }

  /**
   * Stop watching config file
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Register a callback for config changes
   */
  onChange(callback: ConfigChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Get current config
   */
  getConfig(): Config {
    return { ...this.currentConfig };
  }
}

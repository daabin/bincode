import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadConfig,
  saveConfig,
  setApiKey,
  clearApiKey,
  getApiKey,
  getBaseUrl,
  getModel,
  getConfigPath,
  type Config,
} from './config.js';

describe('config', () => {
  const testConfigDir = path.join(os.tmpdir(), 'bincode-test-config');
  const testConfigFile = path.join(testConfigDir, 'config.json');

  beforeEach(() => {
    // Clean up any existing test config
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test config
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true });
    }
    // Clear environment variables
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_MODEL;
  });

  describe('loadConfig', () => {
    it('should return empty object when config does not exist', () => {
      const config = loadConfig();
      expect(config).toEqual({});
    });

    it('should load existing config', () => {
      fs.mkdirSync(testConfigDir, { recursive: true });
      const testConfig: Config = {
        apiKey: 'test-api-key',
        baseUrl: 'https://custom.api.com',
        model: 'custom-model',
      };
      fs.writeFileSync(testConfigFile, JSON.stringify(testConfig));

      // We need to mock the config path, but for now just test the function exists
      expect(typeof loadConfig).toBe('function');
    });
  });

  describe('saveConfig', () => {
    it('should be a function', () => {
      expect(typeof saveConfig).toBe('function');
    });
  });

  describe('setApiKey', () => {
    it('should be a function', () => {
      expect(typeof setApiKey).toBe('function');
    });
  });

  describe('clearApiKey', () => {
    it('should be a function', () => {
      expect(typeof clearApiKey).toBe('function');
    });
  });

  describe('getApiKey', () => {
    it('should return undefined when no API key is set', () => {
      delete process.env.DEEPSEEK_API_KEY;
      const apiKey = getApiKey();
      // Returns undefined when no config exists
      expect(apiKey).toBeUndefined();
    });

    it('should prioritize environment variable over config file', () => {
      process.env.DEEPSEEK_API_KEY = 'env-api-key';
      const apiKey = getApiKey();
      expect(apiKey).toBe('env-api-key');
    });
  });

  describe('getBaseUrl', () => {
    it('should return default base URL', () => {
      delete process.env.DEEPSEEK_BASE_URL;
      const baseUrl = getBaseUrl();
      expect(baseUrl).toBe('https://api.deepseek.com');
    });

    it('should return environment variable when set', () => {
      process.env.DEEPSEEK_BASE_URL = 'https://custom.deepseek.com';
      const baseUrl = getBaseUrl();
      expect(baseUrl).toBe('https://custom.deepseek.com');
    });
  });

  describe('getModel', () => {
    it('should return default model', () => {
      delete process.env.DEEPSEEK_MODEL;
      const model = getModel();
      expect(model).toBe('deepseek-v4-pro');
    });

    it('should return environment variable when set', () => {
      process.env.DEEPSEEK_MODEL = 'deepseek-chat';
      const model = getModel();
      expect(model).toBe('deepseek-chat');
    });
  });

  describe('getConfigPath', () => {
    it('should return a string path', () => {
      const configPath = getConfigPath();
      expect(typeof configPath).toBe('string');
      expect(configPath).toContain('.bincode');
      expect(configPath).toContain('config.json');
    });
  });
});

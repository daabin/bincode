import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadConfig,
  saveConfig,
  setApiKey,
  getApiKey,
  getBaseUrl,
  getModel,
  getProvider,
  setProvider,
  getLLMConfig,
} from './config/index.js';

describe('config', () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.BINCODE_PROVIDER;
  });

  describe('loadConfig', () => {
    it('should return empty object when config does not exist', () => {
      const config = loadConfig();
      expect(config).toEqual({});
    });

    it('should be a function', () => {
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

  describe('getApiKey', () => {
    it('should return undefined when no API key is set', () => {
      delete process.env.DEEPSEEK_API_KEY;
      const apiKey = getApiKey();
      expect(apiKey).toBeUndefined();
    });

    it('should prioritize environment variable over config file', () => {
      process.env.DEEPSEEK_API_KEY = 'env-api-key';
      const apiKey = getApiKey();
      expect(apiKey).toBe('env-api-key');
    });
  });

  describe('getBaseUrl', () => {
    it('should return default base URL for deepseek', () => {
      const baseUrl = getBaseUrl();
      expect(baseUrl).toBe('https://api.deepseek.com');
    });
  });

  describe('getModel', () => {
    it('should return default model for deepseek', () => {
      const model = getModel();
      expect(model).toBe('deepseek-chat');
    });
  });

  describe('getProvider', () => {
    it('should return deepseek as default', () => {
      const provider = getProvider();
      expect(provider).toBe('deepseek');
    });

    it('should read from environment variable', () => {
      process.env.BINCODE_PROVIDER = 'openai';
      const provider = getProvider();
      expect(provider).toBe('openai');
    });
  });

  describe('setProvider', () => {
    it('should be a function', () => {
      expect(typeof setProvider).toBe('function');
    });
  });

  describe('getLLMConfig', () => {
    it('should return complete LLM configuration', () => {
      process.env.DEEPSEEK_API_KEY = 'test-key';
      const config = getLLMConfig();
      expect(config).toHaveProperty('provider');
      expect(config).toHaveProperty('apiKey');
      expect(config).toHaveProperty('baseUrl');
      expect(config).toHaveProperty('model');
      expect(config.apiKey).toBe('test-key');
    });
  });
});

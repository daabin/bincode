import { describe, it, expect, beforeEach } from 'vitest';
import {
  TokenCounter,
  getContextWindowSize,
  estimateTokens,
  estimateMessagesTokens,
  checkContextLimit,
  compressMessages,
  type TokenUsage
} from './tokens.js';

describe('tokens', () => {
  describe('TokenCounter', () => {
    let counter: TokenCounter;

    beforeEach(() => {
      counter = new TokenCounter(100);
    });

    it('should record token usage', () => {
      counter.record('deepseek', 'deepseek-chat', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      });

      const records = counter.getRecords();
      expect(records).toHaveLength(1);
      expect(records[0].provider).toBe('deepseek');
      expect(records[0].usage.totalTokens).toBe(150);
    });

    it('should calculate total usage', () => {
      counter.record('deepseek', 'deepseek-chat', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      });
      counter.record('openai', 'gpt-4o', {
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300
      });

      const total = counter.getTotalUsage();
      expect(total.promptTokens).toBe(300);
      expect(total.completionTokens).toBe(150);
      expect(total.totalTokens).toBe(450);
    });

    it('should limit records to maxRecords', () => {
      const smallCounter = new TokenCounter(3);

      for (let i = 0; i < 5; i++) {
        smallCounter.record('test', 'model', {
          promptTokens: i,
          completionTokens: i,
          totalTokens: i * 2
        });
      }

      expect(smallCounter.getRecords()).toHaveLength(3);
    });

    it('should export and import JSON', () => {
      counter.record('deepseek', 'deepseek-chat', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      });

      const json = counter.toJSON();
      const restored = TokenCounter.fromJSON(json);

      expect(restored.getRecords()).toHaveLength(1);
    });

    it('should clear all records', () => {
      counter.record('test', 'model', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      });

      counter.clear();
      expect(counter.getRecords()).toHaveLength(0);
    });
  });

  describe('getContextWindowSize', () => {
    it('should return correct size for known models', () => {
      expect(getContextWindowSize('gpt-4o')).toBe(128000);
      expect(getContextWindowSize('gpt-4')).toBe(8192);
      expect(getContextWindowSize('deepseek-chat')).toBe(64000);
      expect(getContextWindowSize('claude-3-5-sonnet-20241022')).toBe(200000);
    });

    it('should return default for unknown models', () => {
      expect(getContextWindowSize('unknown-model')).toBe(8192);
    });

    it('should do fuzzy matching', () => {
      expect(getContextWindowSize('gpt-4o-2024-05-13')).toBe(128000);
      expect(getContextWindowSize('claude-3-sonnet')).toBe(200000);
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for English text', () => {
      // "Hello world" = 11 chars, ~3 tokens
      const tokens = estimateTokens('Hello world');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it('should estimate tokens for Chinese text', () => {
      // "你好世界" = 4 Chinese chars, ~2 tokens
      const tokens = estimateTokens('你好世界');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(5);
    });

    it('should handle empty text', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens(null as unknown as string)).toBe(0);
      expect(estimateTokens(undefined as unknown as string)).toBe(0);
    });
  });

  describe('estimateMessagesTokens', () => {
    it('should estimate tokens for messages', () => {
      const messages = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      const tokens = estimateMessagesTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    it('should handle messages with null content', () => {
      const messages = [
        { role: 'assistant', content: null }
      ];

      const tokens = estimateMessagesTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('checkContextLimit', () => {
    it('should return correct limit status', () => {
      const messages = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello!' }
      ];

      const status = checkContextLimit(messages, 'gpt-4o');

      expect(status.currentTokens).toBeGreaterThan(0);
      expect(status.maxTokens).toBe(128000);
      expect(status.percentage).toBeLessThan(0.1);
      expect(status.isNearLimit).toBe(false);
    });

    it('should detect near limit', () => {
      // Create a large message
      const largeContent = 'x'.repeat(100000);
      const messages = [
        { role: 'user', content: largeContent }
      ];

      const status = checkContextLimit(messages, 'gpt-4', 0.5);

      expect(status.percentage).toBeGreaterThan(0.5);
      expect(status.isNearLimit).toBe(true);
    });
  });

  describe('compressMessages', () => {
    it('should not compress if within limit', () => {
      const messages = [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello!' },
        { role: 'assistant', content: 'Hi!' }
      ];

      const compressed = compressMessages(messages, 'gpt-4o');

      expect(compressed).toHaveLength(3);
    });

    it('should preserve system messages', () => {
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'x'.repeat(50000) },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'New question' }
      ];

      const compressed = compressMessages(messages, 'gpt-4', 0.3);

      expect(compressed[0].role).toBe('system');
      expect(compressed[0].content).toBe('System prompt');
    });

    it('should add summary message when compressing', () => {
      const messages = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'x'.repeat(50000) },
        { role: 'assistant', content: 'y'.repeat(50000) },
        { role: 'user', content: 'New question' }
      ];

      const compressed = compressMessages(messages, 'gpt-4', 0.1);

      // Should have system + summary + some messages
      expect(compressed.length).toBeLessThan(messages.length);
      expect(compressed.some(m => m.content?.includes('compressed'))).toBe(true);
    });
  });
});

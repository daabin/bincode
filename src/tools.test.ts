import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { runTool } from './tools/runner.js';

describe('tools', () => {
  describe('edit_file', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bincode-test-'));
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should replace first occurrence by default', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'hello world hello world', 'utf8');

      const result = await runTool(testDir, 'edit_file', {
        path: 'test.txt',
        old_text: 'hello',
        new_text: 'hi',
      });

      expect(result).toContain('Replaced 1 occurrence');
      expect(result).toContain('found 2 total');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('hi world hello world');
    });

    it('should replace all occurrences when replace_all is true', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'hello world hello world', 'utf8');

      const result = await runTool(testDir, 'edit_file', {
        path: 'test.txt',
        old_text: 'hello',
        new_text: 'hi',
        replace_all: true,
      });

      expect(result).toContain('Replaced 2 occurrence(s)');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('hi world hi world');
    });

    it('should replace specific occurrence with occurrence parameter', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'A A A A', 'utf8');

      const result = await runTool(testDir, 'edit_file', {
        path: 'test.txt',
        old_text: 'A',
        new_text: 'B',
        occurrence: 2,
      });

      expect(result).toContain('Replaced 1 occurrence');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('A B A A');
    });

    it('should replace last occurrence', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'A A A A', 'utf8');

      await runTool(testDir, 'edit_file', {
        path: 'test.txt',
        old_text: 'A',
        new_text: 'B',
        occurrence: 4,
      });

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('A A A B');
    });

    it('should throw error when text not found', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'hello world', 'utf8');

      await expect(
        runTool(testDir, 'edit_file', {
          path: 'test.txt',
          old_text: 'notfound',
          new_text: 'replacement',
        })
      ).rejects.toThrow('Text not found in file');
    });

    it('should throw error when occurrence is out of range', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'A A', 'utf8');

      await expect(
        runTool(testDir, 'edit_file', {
          path: 'test.txt',
          old_text: 'A',
          new_text: 'B',
          occurrence: 5,
        })
      ).rejects.toThrow('Invalid occurrence 5');
    });

    it('should throw error when occurrence is less than 1', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'A A', 'utf8');

      await expect(
        runTool(testDir, 'edit_file', {
          path: 'test.txt',
          old_text: 'A',
          new_text: 'B',
          occurrence: 0,
        })
      ).rejects.toThrow('Invalid occurrence 0');
    });

    it('should handle multiline text replacement', async () => {
      const testFile = path.join(testDir, 'test.txt');
      const originalContent = 'line1\nline2\nline1\nline2';
      await fs.writeFile(testFile, originalContent, 'utf8');

      await runTool(testDir, 'edit_file', {
        path: 'test.txt',
        old_text: 'line1',
        new_text: 'newLine',
        replace_all: true,
      });

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('newLine\nline2\nnewLine\nline2');
    });

    it('should handle special regex characters in old_text', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'price: $10.00', 'utf8');

      await runTool(testDir, 'edit_file', {
        path: 'test.txt',
        old_text: '$10.00',
        new_text: '$20.00',
      });

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('price: $20.00');
    });
  });

  describe('read_file', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bincode-test-'));
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should read file content', async () => {
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'hello world', 'utf8');

      const result = await runTool(testDir, 'read_file', { path: 'test.txt' });
      expect(result).toBe('hello world');
    });

    it('should throw error for non-existent file', async () => {
      await expect(
        runTool(testDir, 'read_file', { path: 'nonexistent.txt' })
      ).rejects.toThrow();
    });
  });

  describe('write_file', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bincode-test-'));
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    it('should write file content', async () => {
      const result = await runTool(testDir, 'write_file', {
        path: 'test.txt',
        content: 'hello world',
      });

      expect(result).toContain('Wrote 11 characters');

      const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf8');
      expect(content).toBe('hello world');
    });

    it('should create parent directories', async () => {
      await runTool(testDir, 'write_file', {
        path: 'subdir/nested/test.txt',
        content: 'nested content',
      });

      const content = await fs.readFile(path.join(testDir, 'subdir/nested/test.txt'), 'utf8');
      expect(content).toBe('nested content');
    });
  });
});
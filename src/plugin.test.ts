import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateManifest,
  scanPlugins,
  createExamplePlugin,
  ensurePluginsDir
} from './plugin.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('plugin', () => {
  describe('validateManifest', () => {
    it('should validate a correct manifest', () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        main: 'index.js'
      };
      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject manifest without name', () => {
      const manifest = { version: '1.0.0', main: 'index.js' };
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plugin name is required');
    });

    it('should reject manifest without version', () => {
      const manifest = { name: 'test', main: 'index.js' };
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
    });

    it('should reject manifest without main', () => {
      const manifest = { name: 'test', version: '1.0.0' };
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid name format', () => {
      const manifest = { name: 'test plugin!', version: '1.0.0', main: 'index.js' };
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
    });

    it('should reject non-object manifest', () => {
      expect(validateManifest(null).valid).toBe(false);
      expect(validateManifest('string').valid).toBe(false);
    });
  });

  describe('createExamplePlugin', () => {
    const testDir = path.join(os.tmpdir(), 'bincode-plugin-test');

    beforeEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
      process.env.BINCODE_PLUGINS_DIR = testDir;
    });

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
      delete process.env.BINCODE_PLUGINS_DIR;
    });

    it('should create an example plugin', () => {
      const pluginPath = createExamplePlugin('my-plugin');
      
      expect(fs.existsSync(pluginPath)).toBe(true);
      expect(fs.existsSync(path.join(pluginPath, 'plugin.json'))).toBe(true);
      expect(fs.existsSync(path.join(pluginPath, 'index.js'))).toBe(true);
    });

    it('should throw if plugin already exists', () => {
      createExamplePlugin('dup-plugin');
      expect(() => createExamplePlugin('dup-plugin')).toThrow('already exists');
    });

    it('should create valid plugin.json', () => {
      createExamplePlugin('valid-plugin');
      const manifestPath = path.join(testDir, 'valid-plugin', 'plugin.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      expect(manifest.name).toBe('valid-plugin');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.main).toBe('index.js');
    });
  });
});
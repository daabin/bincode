import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  detectLanguage,
  extractSymbols,
  contentHash,
  indexWorkspace,
  loadIndex,
  searchSymbols
} from './indexer.js';

describe('indexer', () => {
  describe('detectLanguage', () => {
    it('should detect TypeScript', () => {
      expect(detectLanguage('file.ts')).toBe('typescript');
      expect(detectLanguage('file.tsx')).toBe('typescript');
    });

    it('should detect JavaScript', () => {
      expect(detectLanguage('file.js')).toBe('javascript');
      expect(detectLanguage('file.jsx')).toBe('javascript');
    });

    it('should detect Python', () => {
      expect(detectLanguage('file.py')).toBe('python');
    });

    it('should detect Rust', () => {
      expect(detectLanguage('file.rs')).toBe('rust');
    });

    it('should detect Go', () => {
      expect(detectLanguage('file.go')).toBe('go');
    });

    it('should return unknown for unrecognized extensions', () => {
      expect(detectLanguage('file.xyz')).toBe('unknown');
    });
  });

  describe('extractSymbols', () => {
    it('should extract TypeScript functions', () => {
      const code = `
function hello(name: string): string {
  return 'Hello ' + name;
}

export async function fetchData(url: string) {
  const response = await fetch(url);
  return response.json();
}`;
      const symbols = extractSymbols(code, 'typescript');
      
      const fnNames = symbols.filter(s => s.kind === 'function').map(s => s.name);
      expect(fnNames).toContain('hello');
      expect(fnNames).toContain('fetchData');
    });

    it('should extract TypeScript classes and interfaces', () => {
      const code = `
class MyClass {
  constructor() {}
}

interface MyInterface {
  name: string;
}

type MyType = string | number;

enum Status {
  Active,
  Inactive
}`;
      const symbols = extractSymbols(code, 'typescript');
      
      expect(symbols.find(s => s.name === 'MyClass' && s.kind === 'class')).toBeDefined();
      expect(symbols.find(s => s.name === 'MyInterface' && s.kind === 'interface')).toBeDefined();
      expect(symbols.find(s => s.name === 'MyType' && s.kind === 'type')).toBeDefined();
      expect(symbols.find(s => s.name === 'Status' && s.kind === 'enum')).toBeDefined();
    });

    it('should extract Python functions and classes', () => {
      const code = `
def hello(name):
    return f"Hello {name}"

class MyClass:
    pass

async def fetch_data():
    pass`;
      const symbols = extractSymbols(code, 'python');
      
      expect(symbols.find(s => s.name === 'hello' && s.kind === 'function')).toBeDefined();
      expect(symbols.find(s => s.name === 'MyClass' && s.kind === 'class')).toBeDefined();
      expect(symbols.find(s => s.name === 'fetch_data' && s.kind === 'function')).toBeDefined();
    });

    it('should extract Rust functions and structs', () => {
      const code = `
pub fn main() {
    println!("Hello");
}

pub struct MyStruct {
    pub field: i32,
}

pub trait MyTrait {
    fn do_something(&self);
}`;
      const symbols = extractSymbols(code, 'rust');
      
      expect(symbols.find(s => s.name === 'main' && s.kind === 'function')).toBeDefined();
      expect(symbols.find(s => s.name === 'MyStruct' && s.kind === 'class')).toBeDefined();
      expect(symbols.find(s => s.name === 'MyTrait' && s.kind === 'interface')).toBeDefined();
    });

    it('should return empty for unknown language', () => {
      const symbols = extractSymbols('some code', 'unknown');
      expect(symbols).toHaveLength(0);
    });
  });

  describe('contentHash', () => {
    it('should return consistent hash for same content', () => {
      const hash1 = contentHash('hello world');
      const hash2 = contentHash('hello world');
      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different content', () => {
      const hash1 = contentHash('hello');
      const hash2 = contentHash('world');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('searchSymbols', () => {
    it('should find symbols by exact name', () => {
      const entries = [{
        file: 'test.ts',
        language: 'typescript',
        symbols: [
          { name: 'hello', kind: 'function' as const, line: 1, column: 0 },
          { name: 'world', kind: 'function' as const, line: 5, column: 0 }
        ],
        hash: 'abc',
        size: 100,
        lastModified: Date.now()
      }];

      const results = searchSymbols(entries, 'hello');
      expect(results).toHaveLength(1);
      expect(results[0].symbol).toBe('hello');
    });

    it('should find symbols by partial name', () => {
      const entries = [{
        file: 'test.ts',
        language: 'typescript',
        symbols: [
          { name: 'getUser', kind: 'function' as const, line: 1, column: 0 },
          { name: 'setData', kind: 'function' as const, line: 5, column: 0 }
        ],
        hash: 'abc',
        size: 100,
        lastModified: Date.now()
      }];

      const results = searchSymbols(entries, 'User');
      expect(results).toHaveLength(1);
      expect(results[0].symbol).toBe('getUser');
    });

    it('should filter by kind', () => {
      const entries = [{
        file: 'test.ts',
        language: 'typescript',
        symbols: [
          { name: 'MyClass', kind: 'class' as const, line: 1, column: 0 },
          { name: 'myFunction', kind: 'function' as const, line: 5, column: 0 }
        ],
        hash: 'abc',
        size: 100,
        lastModified: Date.now()
      }];

      const results = searchSymbols(entries, 'My', { kind: 'class' });
      expect(results).toHaveLength(1);
      expect(results[0].kind).toBe('class');
    });

    it('should return empty for no matches', () => {
      const results = searchSymbols([], 'nothing');
      expect(results).toHaveLength(0);
    });
  });
});
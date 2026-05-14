/**
 * Search service abstraction
 * Supports ripgrep with fallback to Node.js native search
 */

import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface SearchMatch {
  file: string;
  line: number;
  column: number;
  content: string;
}

export interface SearchOptions {
  path?: string;
  caseSensitive?: boolean;
  maxResults?: number;
}

export interface ISearchService {
  searchText(query: string, options?: SearchOptions): Promise<SearchMatch[]>;
}

export class RipgrepSearchService implements ISearchService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly ignoreDirs: string[] = ['.git', 'node_modules', 'dist']
  ) {}

  async searchText(query: string, options?: SearchOptions): Promise<SearchMatch[]> {
    const searchPath = options?.path
      ? path.resolve(this.workspaceRoot, options.path)
      : this.workspaceRoot;

    // Try ripgrep first
    try {
      return await this.searchWithRipgrep(query, searchPath, options);
    } catch {
      // Fallback to native search
      return this.searchWithNative(query, searchPath, options);
    }
  }

  private async searchWithRipgrep(query: string, searchPath: string, options?: SearchOptions): Promise<SearchMatch[]> {
    const args = [
      '--line-number',
      '--column',
      '--with-filename',
      '--no-heading',
      '--color', 'never',
      ...this.ignoreDirs.flatMap(d => ['-g', `!${d}/**`]),
    ];

    if (!options?.caseSensitive) {
      args.push('-i');
    }

    if (options?.maxResults) {
      args.push('-m', String(options.maxResults));
    }

    args.push('--', query, searchPath);

    const result = execSync(
      `rg ${args.map(a => `"${a}"`).join(' ')}`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );

    return result.trim().split('\n').filter(Boolean).map(line => {
      const parts = line.split(':');
      return {
        file: path.relative(this.workspaceRoot, parts[0]),
        line: parseInt(parts[1], 10),
        column: parseInt(parts[2], 10),
        content: parts.slice(3).join(':')
      };
    });
  }

  private async searchWithNative(query: string, searchPath: string, options?: SearchOptions): Promise<SearchMatch[]> {
    const results: SearchMatch[] = [];
    const maxResults = options?.maxResults ?? 100;
    const caseSensitive = options?.caseSensitive ?? true;

    const walkDir = async (dir: string): Promise<void> => {
      if (results.length >= maxResults) return;

      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (results.length >= maxResults) return;
        if (this.ignoreDirs.includes(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.') continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.isFile()) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              const lineContent = lines[i];
              const matchIndex = caseSensitive
                ? lineContent.indexOf(query)
                : lineContent.toLowerCase().indexOf(query.toLowerCase());

              if (matchIndex !== -1) {
                results.push({
                  file: path.relative(this.workspaceRoot, fullPath),
                  line: i + 1,
                  column: matchIndex + 1,
                  content: lineContent.trim()
                });
                if (results.length >= maxResults) return;
              }
            }
          } catch {
            // Skip binary or unreadable files
          }
        }
      }
    };

    await walkDir(searchPath);
    return results;
  }
}

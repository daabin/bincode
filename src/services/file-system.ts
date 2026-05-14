/**
 * File system service abstraction
 * Can be replaced with remote/virtual file system implementations
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory' | 'symlink';
  modifiedAt: Date;
}

export interface DirEntry {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
}

export interface EditOptions {
  replaceAll?: boolean;
  occurrence?: number;
}

export interface ListOptions {
  recursive?: boolean;
  maxDepth?: number;
}

export interface IFileSystemService {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  editFile(filePath: string, oldText: string, newText: string, options?: EditOptions): Promise<{ replacedCount: number; totalCount: number }>;
  listDirectory(dirPath: string, options?: ListOptions): Promise<DirEntry[]>;
  getFileInfo(filePath: string): Promise<FileInfo>;
  findFiles(pattern: string): Promise<string[]>;
  deleteFile(filePath: string, recursive?: boolean): Promise<void>;
  moveFile(source: string, destination: string): Promise<void>;
  readMultipleFiles(paths: string[], maxFiles?: number): Promise<Array<{ path: string; content: string; error?: string }>>;
}

export class LocalFileSystemService implements IFileSystemService {
  constructor(private readonly workspaceRoot: string) {}

  private resolvePath(filePath: string): string {
    // Prevent path traversal
    const resolved = path.resolve(this.workspaceRoot, filePath);
    if (!resolved.startsWith(this.workspaceRoot)) {
      throw new Error(`Path traversal detected: ${filePath}`);
    }
    return resolved;
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    return fs.readFile(fullPath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async editFile(filePath: string, oldText: string, newText: string, options?: EditOptions): Promise<{ replacedCount: number; totalCount: number }> {
    const content = await this.readFile(filePath);
    let result: string;
    let replacedCount = 0;
    let totalCount = 0;

    const escapedText = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const allMatches = content.match(new RegExp(escapedText, 'g'));
    totalCount = allMatches ? allMatches.length : 0;

    if (options?.replaceAll) {
      replacedCount = totalCount;
      result = content.replaceAll(oldText, newText);
    } else if (options?.occurrence != null) {
      const occurrence = options.occurrence;
      if (occurrence < 1) {
        throw new Error(`Invalid occurrence ${occurrence}: must be >= 1`);
      }
      if (occurrence > totalCount) {
        throw new Error(`Invalid occurrence ${occurrence}: only ${totalCount} occurrence(s) found`);
      }
      let count = 0;
      result = content.replace(new RegExp(escapedText, 'g'), (match) => {
        count++;
        if (count === occurrence) {
          replacedCount = 1;
          return newText;
        }
        return match;
      });
    } else {
      result = content.replace(oldText, newText);
      replacedCount = result !== content ? 1 : 0;
    }

    if (result === content) {
      throw new Error(`Text not found in file: ${oldText}`);
    }

    await this.writeFile(filePath, result);
    return { replacedCount, totalCount };
  }

  async listDirectory(dirPath: string, options?: ListOptions): Promise<DirEntry[]> {
    const fullPath = this.resolvePath(dirPath);
    const entries: DirEntry[] = [];

    const readDir = async (currentPath: string, depth: number): Promise<void> => {
      if (options?.maxDepth !== undefined && depth > options.maxDepth) return;

      const dir = await fs.opendir(currentPath);
      for await (const entry of dir) {
        if (entry.name.startsWith('.') && entry.name !== '.') continue;
        if (entry.name === 'node_modules') continue;

        const entryPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(this.workspaceRoot, entryPath);
        let stats: Awaited<ReturnType<typeof fs.stat>>;

        try {
          stats = await fs.stat(entryPath);
        } catch {
          continue;
        }

        entries.push({
          name: entry.name,
          path: relativePath,
          type: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file',
          size: stats.size
        });

        if (entry.isDirectory() && options?.recursive) {
          await readDir(entryPath, depth + 1);
        }
      }
    };

    await readDir(fullPath, 0);
    return entries;
  }

  async getFileInfo(filePath: string): Promise<FileInfo> {
    const fullPath = this.resolvePath(filePath);
    const stats = await fs.stat(fullPath);

    return {
      name: path.basename(filePath),
      path: filePath,
      size: stats.size,
      type: stats.isDirectory() ? 'directory' : stats.isSymbolicLink() ? 'symlink' : 'file',
      modifiedAt: stats.mtime
    };
  }

  async findFiles(pattern: string): Promise<string[]> {
    // Use ripgrep for glob matching when available
    try {
      const { execSync } = await import('node:child_process');
      const result = execSync(
        `rg --files -g "${pattern}" "${this.workspaceRoot}"`,
        { encoding: 'utf-8', maxBuffer: 1024 * 1024 }
      );
      return result.trim().split('\n').filter(Boolean).map(f => path.relative(this.workspaceRoot, f));
    } catch {
      // Fallback: simple glob matching
      const matches: string[] = [];
      const walkDir = async (dir: string): Promise<void> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            await walkDir(fullPath);
          } else {
            const relativePath = path.relative(this.workspaceRoot, fullPath);
            if (this.matchGlob(relativePath, pattern)) {
              matches.push(relativePath);
            }
          }
        }
      };
      await walkDir(this.workspaceRoot);
      return matches;
    }
  }

  private matchGlob(filePath: string, pattern: string): boolean {
    // Simple glob matching (supports *, **, ?)
    const regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '___DOUBLESTAR___')
      .replace(/\*/g, '[^/]*')
      .replace(/___DOUBLESTAR___/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexStr}$`).test(filePath);
  }

  async deleteFile(filePath: string, recursive?: boolean): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: recursive ?? false, force: true });
    } else {
      await fs.unlink(fullPath);
    }
  }

  async moveFile(source: string, destination: string): Promise<void> {
    const srcPath = this.resolvePath(source);
    const destPath = this.resolvePath(destination);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.rename(srcPath, destPath);
  }

  async readMultipleFiles(
    paths: string[],
    maxFiles: number = 10
  ): Promise<Array<{ path: string; content: string; error?: string }>> {
    const results: Array<{ path: string; content: string; error?: string }> = [];
    const toRead = paths.slice(0, maxFiles);

    for (const filePath of toRead) {
      try {
        const content = await this.readFile(filePath);
        results.push({ path: filePath, content });
      } catch (error) {
        results.push({
          path: filePath,
          content: '',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }
}

/**
 * Git service abstraction
 * Can be replaced with different Git implementations (libgit2, isomorphic-git, etc.)
 */

import { execSync, type ExecSyncOptions } from 'node:child_process';

export interface GitStatus {
  branch: string;
  modified: string[];
  staged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface DiffOptions {
  path?: string;
  staged?: boolean;
}

export interface LogOptions {
  limit?: number;
  path?: string;
}

export interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface CommitOptions {
  message?: string;
  all?: boolean;
}

export type BranchAction = 'list' | 'create' | 'delete' | 'current';

export type StashAction = 'push' | 'pop' | 'list' | 'drop';

export interface BlameEntry {
  line: number;
  hash: string;
  author: string;
  date: string;
  content: string;
}

export interface IGitService {
  status(): Promise<GitStatus>;
  diff(options?: DiffOptions): Promise<string>;
  log(options?: LogOptions): Promise<CommitInfo[]>;
  branch(action: BranchAction, name?: string, all?: boolean): Promise<string[]>;
  checkout(target: string, createBranch?: boolean): Promise<string>;
  commit(options?: CommitOptions): Promise<string>;
  add(path: string): Promise<void>;
  stash(action: StashAction, message?: string): Promise<string>;
  blame(filePath: string): Promise<BlameEntry[]>;
}

export class LocalGitService implements IGitService {
  constructor(private readonly cwd: string) {}

  private exec(args: string[], options?: ExecSyncOptions): string {
    try {
      return (execSync(
        `git ${args.join(' ')}`,
        {
          cwd: this.cwd,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
          ...options
        }
      ) as string).trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Git command failed: ${error.message}`);
      }
      throw error;
    }
  }

  async status(): Promise<GitStatus> {
    const branch = this.exec(['rev-parse', '--abbrev-ref', 'HEAD']);
    const statusOutput = this.exec(['status', '--porcelain']);

    const modified: string[] = [];
    const staged: string[] = [];
    const untracked: string[] = [];

    for (const line of statusOutput.split('\n')) {
      if (!line.trim()) continue;
      const xy = line.substring(0, 2);
      const filePath = line.substring(3);

      if (xy === '??') {
        untracked.push(filePath);
      } else if (xy[0] !== ' ') {
        staged.push(filePath);
      } else {
        modified.push(filePath);
      }
    }

    // Get ahead/behind info
    let ahead = 0;
    let behind = 0;
    try {
      const branchInfo = this.exec(['rev-list', '--left-right', '--count', `HEAD...@{upstream}`], { stdio: ['pipe', 'pipe', 'ignore'] });
      if (branchInfo) {
        const [a, b] = branchInfo.split('\t').map(Number);
        ahead = a || 0;
        behind = b || 0;
      }
    } catch {
      // No upstream branch
    }

    return { branch, modified, staged, untracked, ahead, behind };
  }

  async diff(options?: DiffOptions): Promise<string> {
    const args = ['diff'];
    if (options?.staged) args.push('--staged');
    if (options?.path) args.push('--', options.path);
    return this.exec(args);
  }

  async log(options?: LogOptions): Promise<CommitInfo[]> {
    const limit = options?.limit ?? 10;
    const format = '--format=%H|%an|%ad|%s';
    const args = ['log', `-${limit}`, format, '--date=short'];
    if (options?.path) args.push('--', options.path);

    const output = this.exec(args);
    if (!output) return [];

    return output.split('\n').filter(Boolean).map(line => {
      const [hash, author, date, ...messageParts] = line.split('|');
      return { hash, author, date, message: messageParts.join('|') };
    });
  }

  async branch(action: BranchAction, name?: string, all?: boolean): Promise<string[]> {
    switch (action) {
      case 'list': {
        const args = ['branch'];
        if (all) args.push('--all');
        const output = this.exec(args);
        return output.split('\n').filter(Boolean).map(b => b.trim());
      }
      case 'create': {
        if (!name) throw new Error('Branch name required for create');
        this.exec(['checkout', '-b', name]);
        return [name];
      }
      case 'delete': {
        if (!name) throw new Error('Branch name required for delete');
        this.exec(['branch', '-D', name]);
        return [];
      }
      case 'current': {
        const current = this.exec(['rev-parse', '--abbrev-ref', 'HEAD']);
        return [current];
      }
    }
  }

  async checkout(target: string, createBranch?: boolean): Promise<string> {
    const args = ['checkout'];
    if (createBranch) args.push('-b');
    args.push(target);
    return this.exec(args);
  }

  async commit(options?: CommitOptions): Promise<string> {
    if (options?.all) {
      this.exec(['add', '.']);
    }

    // Check if there's anything to commit
    const status = this.exec(['status', '--porcelain']);
    if (!status.trim()) {
      throw new Error('Nothing to commit');
    }

    if (options?.message) {
      return this.exec(['commit', '-m', options.message]);
    }

    // Show staged changes for message generation
    const diffOutput = this.exec(['diff', '--staged']);
    return diffOutput;
  }

  async add(filePath: string): Promise<void> {
    this.exec(['add', filePath]);
  }

  async stash(action: StashAction, message?: string): Promise<string> {
    switch (action) {
      case 'push': {
        const args = ['stash', 'push'];
        if (message) args.push('-m', message);
        return this.exec(args);
      }
      case 'pop':
        return this.exec(['stash', 'pop']);
      case 'list':
        return this.exec(['stash', 'list']);
      case 'drop':
        return this.exec(['stash', 'drop']);
    }
  }

  async blame(filePath: string): Promise<BlameEntry[]> {
    const output = this.exec(['blame', '--porcelain', filePath]);
    const lines: BlameEntry[] = [];
    let currentHash = '';
    let currentAuthor = '';
    let currentDate = '';
    let lineNum = 0;

    for (const line of output.split('\n')) {
      if (!line.trim()) continue;

      if (line.startsWith('\t')) {
        lineNum++;
        lines.push({
          line: lineNum,
          hash: currentHash,
          author: currentAuthor,
          date: currentDate,
          content: line.substring(1)
        });
      } else if (line.includes(' ')) {
        const parts = line.split(' ');
        if (parts.length >= 4) {
          currentHash = parts[0];
          // Skip the line number and other metadata
        }
      } else if (line.startsWith('author ')) {
        currentAuthor = line.substring(7);
      } else if (line.startsWith('author-time ')) {
        currentDate = new Date(parseInt(line.substring(12)) * 1000).toISOString();
      }
    }

    return lines;
  }
}

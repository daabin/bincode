import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { ToolDefinition } from './types.js';

const ignoredDirs = new Set(['.git', 'node_modules', 'dist']);
const rgIgnoreArgs = ['-g', '!node_modules/**', '-g', '!dist/**', '-g', '!.git/**'];

export const toolDefinitions: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file inside the current workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to the workspace root.' }
        },
        required: ['path'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write UTF-8 text to a file inside the current workspace, creating parent directories as needed.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to the workspace root.' },
          content: { type: 'string', description: 'Full file content to write.' }
        },
        required: ['path', 'content'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'find_files',
      description: 'Find files in the workspace by glob-like pattern. Uses ripgrep when available.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'File glob, for example "*.ts" or "src/**/*.tsx".' }
        },
        required: ['pattern'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_text',
      description: 'Search text in workspace files. Uses ripgrep when available.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Text or regex query to search for.' },
          path: { type: 'string', description: 'Optional relative directory or file to search within.' }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  }
];

type ToolArgs = Record<string, unknown>;

export async function runTool(cwd: string, name: string, args: ToolArgs): Promise<string> {
  if (name === 'read_file') {
    const target = resolveWorkspacePath(cwd, stringArg(args, 'path'));
    return limitOutput(await fs.readFile(target, 'utf8'));
  }

  if (name === 'write_file') {
    const target = resolveWorkspacePath(cwd, stringArg(args, 'path'));
    const content = stringArg(args, 'content');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
    return `Wrote ${content.length} characters to ${path.relative(cwd, target)}.`;
  }

  if (name === 'find_files') {
    const pattern = stringArg(args, 'pattern');
    try {
      return limitOutput(await runCommand('rg', ['--files', ...rgIgnoreArgs, '-g', pattern], cwd));
    } catch (error) {
      if (!isMissingCommand(error)) {
        throw error;
      }
      return limitOutput((await findFilesFallback(cwd, pattern)).join('\n') || '(no matches)');
    }
  }

  if (name === 'search_text') {
    const query = stringArg(args, 'query');
    const targetPath = typeof args.path === 'string' && args.path.length > 0 ? args.path : '.';
    const target = targetPath === '.' ? cwd : resolveWorkspacePath(cwd, targetPath);
    try {
      return limitOutput(await runCommand('rg', ['--line-number', '--hidden', ...rgIgnoreArgs, query, target], cwd));
    } catch (error) {
      if (!isMissingCommand(error)) {
        throw error;
      }
      return limitOutput((await searchTextFallback(cwd, target, query)).join('\n') || '(no matches)');
    }
  }

  throw new Error(`Unknown tool: ${name}`);
}

function stringArg(args: ToolArgs, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Tool argument "${key}" must be a non-empty string.`);
  }
  return value;
}

function resolveWorkspacePath(cwd: string, input: string): string {
  const resolved = path.resolve(cwd, input);
  const root = path.resolve(cwd);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Path escapes workspace: ${input}`);
  }
  return resolved;
}

function runCommand(command: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0 || code === 1) {
        resolve(stdout.trim() || '(no matches)');
        return;
      }
      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

async function findFilesFallback(cwd: string, pattern: string): Promise<string[]> {
  const matcher = globToRegExp(pattern);
  const files = await walkFiles(cwd, cwd);
  return files.filter(file => matcher.test(file));
}

async function searchTextFallback(cwd: string, target: string, query: string): Promise<string[]> {
  const regex = safeRegExp(query);
  const stat = await fs.stat(target);
  const files = stat.isDirectory() ? await walkFiles(cwd, target) : [path.relative(cwd, target)];
  const matches: string[] = [];

  for (const file of files) {
    const absolute = path.join(cwd, file);
    let content: string;
    try {
      content = await fs.readFile(absolute, 'utf8');
    } catch {
      continue;
    }

    content.split('\n').forEach((line, index) => {
      if (regex.test(line)) {
        matches.push(`${file}:${index + 1}:${line}`);
      }
    });
  }

  return matches;
}

async function walkFiles(cwd: string, start: string): Promise<string[]> {
  const entries = await fs.readdir(start, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const absolute = path.join(start, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(cwd, absolute)));
    } else if (entry.isFile()) {
      files.push(path.relative(cwd, absolute));
    }
  }

  return files;
}

function globToRegExp(pattern: string): RegExp {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];
    if (char === '*' && next === '*') {
      source += '.*';
      index += 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else {
      source += escapeRegExp(char);
    }
  }
  return new RegExp(`^${source}$`);
}

function safeRegExp(query: string): RegExp {
  try {
    return new RegExp(query);
  } catch {
    return new RegExp(escapeRegExp(query));
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isMissingCommand(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function limitOutput(value: string, maxChars = 12_000): string {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, maxChars)}\n\n[truncated ${value.length - maxChars} chars]`;
}

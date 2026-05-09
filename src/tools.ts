import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { ToolDefinition } from './types.js';

const ignoredDirs = new Set(['.git', 'node_modules', 'dist']);
const rgIgnoreArgs = ['-g', '!node_modules/**', '-g', '!dist/**', '-g', '!.git/**'];

// 允许的命令白名单
const ALLOWED_COMMANDS = new Set([
  'npm', 'yarn', 'pnpm', 'bun',
  'node', 'tsx', 'ts-node', 'deno',
  'git',
  'eslint', 'tsc', 'prettier',
  'cat', 'ls', 'pwd', 'echo', 'which',
  'python', 'python3', 'pip',
  'cargo', 'rustc',
  'go', 'java', 'javac'
]);

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
      name: 'edit_file',
      description: 'Edit a specific part of a file by replacing old text with new text. More efficient than write_file for small changes.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to the workspace root.' },
          old_text: { type: 'string', description: 'The exact text to find and replace. Must match exactly including whitespace.' },
          new_text: { type: 'string', description: 'The new text to replace with.' },
          replace_all: { type: 'boolean', description: 'Replace all occurrences. Default false.' },
          occurrence: { type: 'number', description: 'Replace a specific occurrence (1-indexed).' }
        },
        required: ['path', 'old_text', 'new_text'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'List files and subdirectories in a directory with file types and sizes.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to workspace root. Empty or "." for root directory.' },
          recursive: { type: 'boolean', description: 'Whether to list recursively. Default false.' },
          max_depth: { type: 'number', description: 'Maximum recursion depth. Default 2.' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_file_info',
      description: 'Get file metadata including size, modification time, and type without reading contents.',
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
          path: { type: 'string', description: 'Optional relative directory or file to search within.' },
          case_sensitive: { type: 'boolean', description: 'Whether search is case-sensitive. Default true.' }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_multiple_files',
      description: 'Read multiple files at once. More efficient than calling read_file multiple times.',
      parameters: {
        type: 'object',
        properties: {
          paths: { type: 'array', items: { type: 'string' }, description: 'Array of file paths relative to workspace root.' },
          max_files: { type: 'number', description: 'Maximum number of files to read. Default 10.' }
        },
        required: ['paths'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_file',
      description: 'Delete a file or directory. Use with caution.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to the workspace root.' },
          recursive: { type: 'boolean', description: 'Whether to recursively delete directories. Default false.' }
        },
        required: ['path'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'move_file',
      description: 'Move or rename a file or directory.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source path relative to workspace root.' },
          destination: { type: 'string', description: 'Destination path relative to workspace root.' }
        },
        required: ['source', 'destination'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Execute a shell command and return output. Only whitelisted commands are allowed for security.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute (must be in whitelist: npm, git, node, tsc, eslint, etc).' },
          args: { type: 'array', items: { type: 'string' }, description: 'Command arguments.' },
          timeout: { type: 'number', description: 'Timeout in seconds. Default 30.' }
        },
        required: ['command'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_status',
      description: 'Show git repository status including modified, staged, and untracked files.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_diff',
      description: 'Show git diff for modified files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Optional file path to show diff for specific file.' },
          staged: { type: 'boolean', description: 'Show staged changes instead of unstaged. Default false.' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_log',
      description: 'Show recent git commit history.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of commits to show. Default 10.' },
          path: { type: 'string', description: 'Optional file path to show history for specific file.' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_and_replace',
      description: 'Search and replace text across multiple files matching a pattern.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'File glob pattern (e.g., "src/**/*.ts").' },
          search: { type: 'string', description: 'Text or regex to search for.' },
          replace: { type: 'string', description: 'Replacement text.' },
          dry_run: { type: 'boolean', description: 'Preview changes without applying. Default true.' }
        },
        required: ['pattern', 'search', 'replace'],
        additionalProperties: false
      }
    }
  }
];

type ToolArgs = Record<string, unknown>;

export async function runTool(cwd: string, name: string, args: ToolArgs): Promise<string> {
  // 基础文件操作
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

  if (name === 'edit_file') {
    const target = resolveWorkspacePath(cwd, stringArg(args, 'path'));
    const oldText = stringArg(args, 'old_text');
    const newText = stringArg(args, 'new_text');
    const replaceAll = args.replace_all === true;
    const occurrence = typeof args.occurrence === 'number' ? args.occurrence : undefined;

    const content = await fs.readFile(target, 'utf8');
    const totalOccurrences = (content.match(new RegExp(escapeRegExp(oldText), 'g')) || []).length;

    if (totalOccurrences === 0) {
      throw new Error(`Text not found in file. Make sure the old_text matches exactly including whitespace.`);
    }

    let newContent: string;

    if (occurrence !== undefined) {
      // Replace specific occurrence (1-indexed)
      if (occurrence < 1 || occurrence > totalOccurrences) {
        throw new Error(`Invalid occurrence ${occurrence}. Valid range: 1 to ${totalOccurrences}.`);
      }

      const escaped = escapeRegExp(oldText);
      const regex = new RegExp(escaped, 'g');
      let count = 0;
      newContent = content.replace(regex, (match) => {
        count++;
        return count === occurrence ? newText : match;
      });
      await fs.writeFile(target, newContent, 'utf8');
      return `Replaced 1 occurrence in ${path.relative(cwd, target)}.`;
    }

    if (replaceAll) {
      const escaped = escapeRegExp(oldText);
      const regex = new RegExp(escaped, 'g');
      newContent = content.replace(regex, newText);
      await fs.writeFile(target, newContent, 'utf8');
      return `Replaced ${totalOccurrences} occurrence(s) in ${path.relative(cwd, target)}.`;
    }

    // Default: replace first occurrence only
    if (totalOccurrences > 1) {
      const escaped = escapeRegExp(oldText);
      const regex = new RegExp(escaped, 'g');
      let count = 0;
      newContent = content.replace(regex, (match) => {
        count++;
        return count === 1 ? newText : match;
      });
      await fs.writeFile(target, newContent, 'utf8');
      return `Replaced 1 occurrence in ${path.relative(cwd, target)}. found ${totalOccurrences} total.`;
    }

    newContent = content.replace(oldText, newText);
    await fs.writeFile(target, newContent, 'utf8');
    return `Replaced 1 occurrence in ${path.relative(cwd, target)}.`;
  }

  if (name === 'list_directory') {
    const targetPath = typeof args.path === 'string' && args.path.length > 0 ? args.path : '.';
    const target = targetPath === '.' ? cwd : resolveWorkspacePath(cwd, targetPath);
    const recursive = args.recursive === true;
    const maxDepth = typeof args.max_depth === 'number' ? args.max_depth : 2;

    const entries = await listDirectory(cwd, target, recursive, maxDepth, 0);
    return limitOutput(entries.join('\n') || '(empty directory)');
  }

  if (name === 'get_file_info') {
    const target = resolveWorkspacePath(cwd, stringArg(args, 'path'));
    const stats = await fs.stat(target);

    return JSON.stringify({
      path: path.relative(cwd, target),
      size: stats.size,
      type: stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other',
      modified: stats.mtime.toISOString(),
      created: stats.birthtime.toISOString(),
      readable: true,
      writable: true
    }, null, 2);
  }

  if (name === 'read_multiple_files') {
    const paths = args.paths;
    if (!Array.isArray(paths)) {
      throw new Error('paths must be an array');
    }

    const maxFiles = typeof args.max_files === 'number' ? args.max_files : 10;
    const filesToRead = paths.slice(0, maxFiles);

    const results: string[] = [];
    for (const filePath of filesToRead) {
      if (typeof filePath !== 'string') continue;

      try {
        const target = resolveWorkspacePath(cwd, filePath);
        const content = await fs.readFile(target, 'utf8');
        results.push(`=== ${filePath} ===\n${content}\n`);
      } catch (error) {
        results.push(`=== ${filePath} ===\nError: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }

    return limitOutput(results.join('\n'));
  }

  if (name === 'delete_file') {
    const target = resolveWorkspacePath(cwd, stringArg(args, 'path'));
    const recursive = args.recursive === true;

    const stats = await fs.stat(target);
    if (stats.isDirectory() && !recursive) {
      throw new Error('Cannot delete directory without recursive flag');
    }

    await fs.rm(target, { recursive, force: true });
    return `Deleted ${path.relative(cwd, target)}`;
  }

  if (name === 'move_file') {
    const source = resolveWorkspacePath(cwd, stringArg(args, 'source'));
    const destination = resolveWorkspacePath(cwd, stringArg(args, 'destination'));

    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.rename(source, destination);
    return `Moved ${path.relative(cwd, source)} to ${path.relative(cwd, destination)}`;
  }

  // 查找和搜索
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
    const caseSensitive = args.case_sensitive !== false;

    const rgArgs = ['--line-number', '--hidden', ...rgIgnoreArgs];
    if (!caseSensitive) {
      rgArgs.push('-i');
    }
    rgArgs.push(query, target);

    try {
      return limitOutput(await runCommand('rg', rgArgs, cwd));
    } catch (error) {
      if (!isMissingCommand(error)) {
        throw error;
      }
      return limitOutput((await searchTextFallback(cwd, target, query)).join('\n') || '(no matches)');
    }
  }

  if (name === 'search_and_replace') {
    const pattern = stringArg(args, 'pattern');
    const search = stringArg(args, 'search');
    const replace = stringArg(args, 'replace');
    const dryRun = args.dry_run !== false;

    const files = await findFilesFallback(cwd, pattern);
    const changes: string[] = [];

    for (const file of files) {
      const target = path.join(cwd, file);
      const content = await fs.readFile(target, 'utf8');
      const searchRegex = safeRegExp(search);

      if (searchRegex.test(content)) {
        const newContent = content.replace(new RegExp(search, 'g'), replace);
        const count = (content.match(new RegExp(search, 'g')) || []).length;

        if (!dryRun) {
          await fs.writeFile(target, newContent, 'utf8');
        }

        changes.push(`${file}: ${count} occurrence(s)${dryRun ? ' (preview)' : ' (replaced)'}`);
      }
    }

    return limitOutput(changes.join('\n') || '(no matches)');
  }

  // 命令执行
  if (name === 'run_command') {
    const command = stringArg(args, 'command');
    const commandArgs = Array.isArray(args.args) ? args.args.filter((a): a is string => typeof a === 'string') : [];
    const timeout = typeof args.timeout === 'number' ? args.timeout * 1000 : 30000;

    if (!ALLOWED_COMMANDS.has(command)) {
      throw new Error(`Command "${command}" is not allowed. Allowed commands: ${Array.from(ALLOWED_COMMANDS).join(', ')}`);
    }

    try {
      return limitOutput(await runCommandWithTimeout(command, commandArgs, cwd, timeout));
    } catch (error) {
      throw new Error(`Command failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Git 工具
  if (name === 'git_status') {
    try {
      return limitOutput(await runCommand('git', ['status', '--short'], cwd));
    } catch (error) {
      throw new Error(`Git status failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (name === 'git_diff') {
    const diffPath = typeof args.path === 'string' && args.path.length > 0 ? args.path : '';
    const staged = args.staged === true;

    const gitArgs = ['diff'];
    if (staged) {
      gitArgs.push('--cached');
    }
    if (diffPath) {
      gitArgs.push('--', diffPath);
    }

    try {
      return limitOutput(await runCommand('git', gitArgs, cwd));
    } catch (error) {
      throw new Error(`Git diff failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (name === 'git_log') {
    const limit = typeof args.limit === 'number' ? args.limit : 10;
    const logPath = typeof args.path === 'string' && args.path.length > 0 ? args.path : '';

    const gitArgs = ['log', `--max-count=${limit}`, '--oneline', '--decorate'];
    if (logPath) {
      gitArgs.push('--', logPath);
    }

    try {
      return limitOutput(await runCommand('git', gitArgs, cwd));
    } catch (error) {
      throw new Error(`Git log failed: ${error instanceof Error ? error.message : String(error)}`);
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

function runCommandWithTimeout(
  command: string,
  args: string[],
  cwd: string,
  timeout: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout}ms`));
    }, timeout);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });

    child.on('error', error => {
      clearTimeout(timer);
      if (!timedOut) reject(error);
    });

    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code === 0) {
        resolve(stdout || '(no output)');
      } else {
        reject(new Error(stderr || `Command exited with code ${code}`));
      }
    });
  });
}

async function listDirectory(
  cwd: string,
  dir: string,
  recursive: boolean,
  maxDepth: number,
  currentDepth: number
): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(cwd, fullPath);
    const indent = '  '.repeat(currentDepth);

    if (entry.isDirectory()) {
      results.push(`${indent}📁 ${relativePath}/`);

      if (recursive && currentDepth < maxDepth) {
        const subEntries = await listDirectory(cwd, fullPath, recursive, maxDepth, currentDepth + 1);
        results.push(...subEntries);
      }
    } else if (entry.isFile()) {
      const stats = await fs.stat(fullPath);
      const size = formatSize(stats.size);
      results.push(`${indent}📄 ${relativePath} (${size})`);
    }
  }

  return results;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
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

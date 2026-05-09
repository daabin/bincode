import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { ToolDefinition } from './types.js';
import { isCommandAllowed, getAllowedCommands } from './config.js';

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
      name: 'edit_file',
      description: 'Edit a specific part of a file by replacing old text with new text. More efficient than write_file for small changes. Supports replacing specific occurrence or all occurrences.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path relative to the workspace root.' },
          old_text: { type: 'string', description: 'The exact text to find and replace. Must match exactly including whitespace.' },
          new_text: { type: 'string', description: 'The new text to replace with.' },
          replace_all: { type: 'boolean', description: 'If true, replace all occurrences. Default false (replace first occurrence).' },
          occurrence: { type: 'number', description: 'Which occurrence to replace (1-based). If not specified and replace_all is false, replaces the first occurrence. Ignored if replace_all is true.' }
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
      name: 'git_branch',
      description: 'List, create, or delete git branches.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'create', 'delete', 'current'], description: 'Action to perform: list, create, delete, or get current branch.' },
          name: { type: 'string', description: 'Branch name for create or delete actions.' },
          all: { type: 'boolean', description: 'List all branches including remote. Default false.' }
        },
        required: ['action'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_checkout',
      description: 'Switch branches or restore working tree files.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'Branch name to switch to, or file path to restore.' },
          create_branch: { type: 'boolean', description: 'Create a new branch and switch to it. Default false.' }
        },
        required: ['target'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_commit',
      description: 'Create a git commit with the staged changes. Can generate commit message from diff.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Commit message. If not provided, will show staged changes.' },
          all: { type: 'boolean', description: 'Automatically stage modified and deleted files. Default false.' }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_add',
      description: 'Stage file changes for commit.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File or directory path to stage. Use "." for all changes.' }
        },
        required: ['path'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_stash',
      description: 'Stash or unstash changes.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['push', 'pop', 'list', 'drop'], description: 'Stash action to perform.' },
          message: { type: 'string', description: 'Message for stash push.' }
        },
        required: ['action'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'git_blame',
      description: 'Show blame information for a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to show blame for.' }
        },
        required: ['path'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'compare_files',
      description: 'Compare two files and show differences. Supports unified diff format.',
      parameters: {
        type: 'object',
        properties: {
          file1: { type: 'string', description: 'Path to first file.' },
          file2: { type: 'string', description: 'Path to second file.' },
          ignore_whitespace: { type: 'boolean', description: 'Ignore whitespace differences. Default false.' }
        },
        required: ['file1', 'file2'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information using a search query. Returns a list of results with titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query.' },
          limit: { type: 'number', description: 'Maximum number of results to return. Default 5.' }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_fetch',
      description: 'Fetch content from a URL and return the text content.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch.' },
          selector: { type: 'string', description: 'Optional CSS selector to extract specific content.' }
        },
        required: ['url'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_docs',
      description: 'Generate documentation for code files. Can generate JSDoc/TSDoc comments, README sections, or API documentation.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File or directory path to generate docs for.' },
          type: { type: 'string', enum: ['jsdoc', 'readme', 'api'], description: 'Type of documentation to generate. Default: jsdoc' },
          output: { type: 'string', description: 'Output file path (optional, defaults to stdout)' }
        },
        required: ['path'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_image',
      description: 'Analyze an image file. Returns format, dimensions, size, and base64 data for multimodal LLM processing.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the image file (PNG, JPG, WebP, GIF, BMP).' }
        },
        required: ['path'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'code_search',
      description: 'Search code symbols (functions, classes, interfaces) by name. Builds an index of the workspace for fast symbol lookup.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Symbol name or search query.' },
          kind: { type: 'string', enum: ['function', 'class', 'interface', 'type', 'enum', 'variable'], description: 'Filter by symbol kind.' },
          language: { type: 'string', description: 'Filter by programming language.' },
          limit: { type: 'number', description: 'Max results. Default 10.' }
        },
        required: ['query'],
        additionalProperties: false
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'code_complete',
      description: 'Get AI-powered code completion at a specific location in a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path.' },
          line: { type: 'number', description: 'Cursor line number (1-based).' },
          column: { type: 'number', description: 'Cursor column number (1-based).' }
        },
        required: ['path', 'line', 'column'],
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
    const occurrence = typeof args.occurrence === 'number' ? args.occurrence : 1;

    const content = await fs.readFile(target, 'utf8');
    const regex = new RegExp(escapeRegExp(oldText), 'g');
    const matches = content.match(regex);
    const totalOccurrences = matches ? matches.length : 0;

    if (totalOccurrences === 0) {
      throw new Error(`Text not found in file. Make sure the old_text matches exactly including whitespace.`);
    }

    let newContent: string;
    let replacedCount: number;

    if (replaceAll) {
      // Replace all occurrences
      newContent = content.replace(regex, newText);
      replacedCount = totalOccurrences;
    } else {
      // Replace specific occurrence (1-based)
      if (occurrence < 1 || occurrence > totalOccurrences) {
        throw new Error(`Invalid occurrence ${occurrence}. File contains ${totalOccurrences} occurrence(s) of the text.`);
      }

      let count = 0;
      newContent = content.replace(regex, (match) => {
        count++;
        return count === occurrence ? newText : match;
      });
      replacedCount = 1;
    }

    await fs.writeFile(target, newContent, 'utf8');
    return `Replaced ${replacedCount} occurrence(s) in ${path.relative(cwd, target)} (found ${totalOccurrences} total).`;
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

  if (name === 'compare_files') {
    const file1 = resolveWorkspacePath(cwd, stringArg(args, 'file1'));
    const file2 = resolveWorkspacePath(cwd, stringArg(args, 'file2'));
    const ignoreWhitespace = args.ignore_whitespace === true;

    const content1 = await fs.readFile(file1, 'utf8');
    const content2 = await fs.readFile(file2, 'utf8');

    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    // Simple diff algorithm
    const diff: string[] = [];
    diff.push(`--- ${path.relative(cwd, file1)}`);
    diff.push(`+++ ${path.relative(cwd, file2)}`);

    const maxLines = Math.max(lines1.length, lines2.length);
    let inDiff = false;
    let diffStart = 0;
    let diffLines1: string[] = [];
    let diffLines2: string[] = [];

    const flushDiff = () => {
      if (diffLines1.length > 0 || diffLines2.length > 0) {
        diff.push(`@@ -${diffStart + 1},${diffLines1.length} +${diffStart + 1},${diffLines2.length} @@`);
        for (const line of diffLines1) {
          diff.push(`-${line}`);
        }
        for (const line of diffLines2) {
          diff.push(`+${line}`);
        }
      }
      diffLines1 = [];
      diffLines2 = [];
    };

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';

      const l1 = ignoreWhitespace ? line1.trim() : line1;
      const l2 = ignoreWhitespace ? line2.trim() : line2;

      if (l1 !== l2) {
        if (!inDiff) {
          diffStart = i;
          inDiff = true;
        }
        if (i < lines1.length) diffLines1.push(line1);
        if (i < lines2.length) diffLines2.push(line2);
      } else {
        if (inDiff) {
          flushDiff();
          inDiff = false;
        }
      }
    }

    if (inDiff) {
      flushDiff();
    }

    if (diff.length === 2) {
      return 'Files are identical.';
    }

    return limitOutput(diff.join('\n'));
  }

  if (name === 'web_search') {
    const query = stringArg(args, 'query');
    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 10) : 5;

    try {
      // Use DuckDuckGo HTML search (no API key required)
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BincodeBot/1.0)'
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const html = await response.text();
      
      // Parse search results from HTML
      const results: string[] = [];
      const resultRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
      const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/a>/g;

      let match;
      let count = 0;
      
      while ((match = resultRegex.exec(html)) !== null && count < limit) {
        const url = match[1];
        const title = match[2].replace(/<[^>]+>/g, '').trim();
        
        results.push(`${count + 1}. ${title}`);
        results.push(`   URL: ${url}`);
        count++;
      }

      if (results.length === 0) {
        return `No results found for: ${query}`;
      }

      return `Search results for "${query}":\n\n${results.join('\n')}`;
    } catch (error) {
      throw new Error(`Web search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (name === 'web_fetch') {
    const url = stringArg(args, 'url');
    const selector = typeof args.selector === 'string' ? args.selector : null;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BincodeBot/1.0)'
        }
      });

      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`);
      }

      let content = await response.text();

      // Simple HTML to text conversion
      content = content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

      // Extract specific content if selector provided
      if (selector) {
        // Simple selector matching for common patterns
        const patterns: Record<string, RegExp> = {
          'title': /<title[^>]*>([^<]+)<\/title>/i,
          'h1': /<h1[^>]*>([^<]+)<\/h1>/i,
          'article': /<article[^>]*>([\s\S]*?)<\/article>/i,
          'main': /<main[^>]*>([\s\S]*?)<\/main>/i
        };

        const regex = patterns[selector];
        if (regex) {
          const match = content.match(regex);
          if (match) {
            content = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          }
        }
      }

      return limitOutput(content);
    } catch (error) {
      throw new Error(`Web fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (name === 'generate_docs') {
    const targetPath = resolveWorkspacePath(cwd, stringArg(args, 'path'));
    const docType = typeof args.type === 'string' ? args.type : 'jsdoc';
    const outputPath = typeof args.output === 'string' ? resolveWorkspacePath(cwd, args.output) : null;

    try {
      const stat = await fs.stat(targetPath);
      const files: string[] = [];

      if (stat.isDirectory()) {
        // Find all TypeScript/JavaScript files
        const findFiles = async (dir: string): Promise<void> => {
          const entries = await fs.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await findFiles(fullPath);
            } else if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
              files.push(fullPath);
            }
          }
        };
        await findFiles(targetPath);
      } else if (stat.isFile()) {
        files.push(targetPath);
      }

      if (files.length === 0) {
        return 'No source files found to document.';
      }

      const docs: string[] = [];

      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        const relativePath = path.relative(cwd, file);

        if (docType === 'jsdoc') {
          // Extract functions and classes for JSDoc generation
          const functionMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g);
          const classMatches = content.matchAll(/(?:export\s+)?class\s+(\w+)/g);
          const interfaceMatches = content.matchAll(/(?:export\s+)?interface\s+(\w+)/g);

          const items: string[] = [];

          for (const match of functionMatches) {
            const fnName = match[1];
            const params = match[2];
            items.push(`/**
 * ${fnName}
 * @param {any} params - Function parameters
 * @returns {any} Return value
 */`);
          }

          for (const match of classMatches) {
            items.push(`/**
 * ${match[1]} class
 * @class
 */`);
          }

          for (const match of interfaceMatches) {
            items.push(`/**
 * ${match[1]} interface
 * @interface
 */`);
          }

          if (items.length > 0) {
            docs.push(`// ${relativePath}\n${items.join('\n\n')}\n`);
          }
        } else if (docType === 'readme') {
          docs.push(`## ${path.basename(file, path.extname(file))}\n\nSource: \`${relativePath}\`\n`);
        } else if (docType === 'api') {
          // Extract exported functions for API documentation
          const exportMatches = content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g);
          
          for (const match of exportMatches) {
            docs.push(`### ${match[1]}\n\n\`\`\`typescript\n${match[0]}\n\`\`\`\n`);
          }
        }
      }

      const result = docs.join('\n---\n\n');

      if (outputPath) {
        await fs.writeFile(outputPath, result, 'utf8');
        return `Documentation generated: ${path.relative(cwd, outputPath)}`;
      }

      return limitOutput(result || 'No documentation generated.');
    } catch (error) {
      throw new Error(`Documentation generation failed: ${error instanceof Error ? error.message : String(error)}`);
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

    if (!isCommandAllowed(command)) {
      const allowed = Array.from(getAllowedCommands());
      throw new Error(`Command "${command}" is not allowed. Allowed commands: ${allowed.slice(0, 10).join(', ')}${allowed.length > 10 ? '...' : ''}`);
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

  if (name === 'git_branch') {
    const action = stringArg(args, 'action');
    const branchName = typeof args.name === 'string' ? args.name : '';
    const all = args.all === true;

    try {
      switch (action) {
        case 'list': {
          const gitArgs = ['branch'];
          if (all) gitArgs.push('-a');
          return limitOutput(await runCommand('git', gitArgs, cwd));
        }
        case 'current': {
          const result = await runCommand('git', ['branch', '--show-current'], cwd);
          return result.trim() || '(detached HEAD)';
        }
        case 'create': {
          if (!branchName) throw new Error('Branch name is required for create action');
          await runCommand('git', ['branch', branchName], cwd);
          return `Created branch: ${branchName}`;
        }
        case 'delete': {
          if (!branchName) throw new Error('Branch name is required for delete action');
          await runCommand('git', ['branch', '-d', branchName], cwd);
          return `Deleted branch: ${branchName}`;
        }
        default:
          throw new Error(`Unknown git_branch action: ${action}`);
      }
    } catch (error) {
      throw new Error(`Git branch failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (name === 'git_checkout') {
    const target = stringArg(args, 'target');
    const createBranch = args.create_branch === true;

    try {
      const gitArgs = createBranch ? ['checkout', '-b', target] : ['checkout', target];
      await runCommand('git', gitArgs, cwd);
      return createBranch ? `Created and switched to branch: ${target}` : `Switched to: ${target}`;
    } catch (error) {
      throw new Error(`Git checkout failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (name === 'git_commit') {
    const message = typeof args.message === 'string' ? args.message : '';
    const all = args.all === true;

    try {
      // If no message, show staged changes
      if (!message) {
        const stagedDiff = await runCommand('git', ['diff', '--cached', '--stat'], cwd);
        if (!stagedDiff.trim()) {
          return 'No staged changes. Use git_add to stage files first.';
        }
        return `Staged changes:\n${stagedDiff}\n\nProvide a commit message to commit.`;
      }

      const gitArgs = ['commit', '-m', message];
      if (all) gitArgs.push('-a');

      const result = await runCommand('git', gitArgs, cwd);
      return limitOutput(result);
    } catch (error) {
      throw new Error(`Git commit failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (name === 'git_add') {
    const addPath = stringArg(args, 'path');

    try {
      await runCommand('git', ['add', addPath], cwd);
      return `Staged: ${addPath}`;
    } catch (error) {
      throw new Error(`Git add failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (name === 'git_stash') {
    const action = stringArg(args, 'action');
    const stashMessage = typeof args.message === 'string' ? args.message : '';

    try {
      switch (action) {
        case 'push': {
          const gitArgs = ['stash', 'push'];
          if (stashMessage) gitArgs.push('-m', stashMessage);
          await runCommand('git', gitArgs, cwd);
          return 'Changes stashed successfully.';
        }
        case 'pop': {
          const result = await runCommand('git', ['stash', 'pop'], cwd);
          return limitOutput(result || 'Stash applied successfully.');
        }
        case 'list': {
          const result = await runCommand('git', ['stash', 'list'], cwd);
          return limitOutput(result || 'No stashes found.');
        }
        case 'drop': {
          await runCommand('git', ['stash', 'drop'], cwd);
          return 'Stash dropped successfully.';
        }
        default:
          throw new Error(`Unknown git_stash action: ${action}`);
      }
    } catch (error) {
      throw new Error(`Git stash failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (name === 'git_blame') {
    const blamePath = stringArg(args, 'path');

    try {
      const result = await runCommand('git', ['blame', '--line-porcelain', blamePath], cwd);
      
      // Parse blame output for a cleaner format
      const lines = result.split('\n');
      const blameInfo: string[] = [];
      let currentCommit = '';
      let currentAuthor = '';
      let currentLine = '';

      for (const line of lines) {
        if (line.startsWith('author ')) {
          currentAuthor = line.slice(7);
        } else if (line.startsWith('author-mail ')) {
          // Skip
        } else if (line.startsWith('summary ')) {
          // Skip
        } else if (line.match(/^\w{40}/)) {
          const parts = line.split(' ');
          currentCommit = parts[0].slice(0, 8);
          currentLine = parts[parts.length - 1];
        } else if (line.startsWith('\t')) {
          const code = line.slice(1);
          blameInfo.push(`${currentCommit} ${currentAuthor.padEnd(20)} | ${code}`);
        }
      }

      return limitOutput(blameInfo.join('\n'));
    } catch (error) {
      throw new Error(`Git blame failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (name === 'analyze_image') {
    const { analyzeImage } = await import('./image.js');
    const imagePath = resolveWorkspacePath(cwd, stringArg(args, 'path'));
    return await analyzeImage(imagePath);
  }

  if (name === 'code_search') {
    const { indexWorkspace, loadIndex, searchSymbols } = await import('./indexer.js');
    const query = stringArg(args, 'query');
    const kind = typeof args.kind === 'string' ? args.kind : undefined;
    const language = typeof args.language === 'string' ? args.language : undefined;
    const limit = typeof args.limit === 'number' ? args.limit : 10;

    // 尝试加载已有索引，否则重新构建
    let entries = loadIndex(cwd)?.entries;
    if (!entries) {
      entries = indexWorkspace(cwd);
    }

    const results = searchSymbols(entries, query, { kind, language, limit });

    if (results.length === 0) {
      return `No symbols found matching "${query}".`;
    }

    return results.map(r =>
      `${r.symbol} (${r.kind}) at ${r.file}:${r.line}\n  ${r.context.split('\n')[0].trim()}`
    ).join('\n\n');
  }

  if (name === 'code_complete') {
    const { codeComplete } = await import('./completion.js');
    const filePath = resolveWorkspacePath(cwd, stringArg(args, 'path'));
    const line = typeof args.line === 'number' ? args.line : 1;
    const column = typeof args.column === 'number' ? args.column : 1;

    const content = await fs.readFile(filePath, 'utf8');
    const result = await codeComplete({
      filePath: path.relative(cwd, filePath),
      fileContent: content,
      cursorLine: line,
      cursorColumn: column
    });

    if (result.completions.length === 0) {
      return 'No completions available.';
    }

    return result.completions.map(c => `${c.text} [${c.type}]`).join('\n');
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
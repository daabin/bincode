/**
 * File system tools
 */

import type { ToolHandler } from './types.js';

export const fileTools: ToolHandler[] = [
  {
    name: 'read_file',
    description: 'Read a UTF-8 text file inside the current workspace.',
    category: 'file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the workspace root.' }
      },
      required: ['path'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const content = await services.fileSystem.readFile(args.path as string);
      return content;
    }
  },
  {
    name: 'write_file',
    description: 'Write UTF-8 text to a file inside the current workspace, creating parent directories as needed.',
    category: 'file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the workspace root.' },
        content: { type: 'string', description: 'Full file content to write.' }
      },
      required: ['path', 'content'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const content = args.content as string;
      await services.fileSystem.writeFile(args.path as string, content);
      return `Wrote ${content.length} characters to ${args.path}`;
    }
  },
  {
    name: 'edit_file',
    description: 'Edit a specific part of a file by replacing old text with new text. More efficient than write_file for small changes. Supports replacing specific occurrence or all occurrences.',
    category: 'file',
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
    },
    handler: async (args, { services }) => {
      const { replacedCount, totalCount } = await services.fileSystem.editFile(
        args.path as string,
        args.old_text as string,
        args.new_text as string,
        {
          replaceAll: args.replace_all as boolean | undefined,
          occurrence: args.occurrence as number | undefined
        }
      );
      const total = totalCount ?? replacedCount;
      if (total > replacedCount) {
        return `Replaced ${replacedCount} occurrence(s) in ${args.path} (found ${total} total)`;
      }
      if (replacedCount === 1) {
        return `Replaced 1 occurrence in ${args.path}`;
      }
      return `Replaced ${replacedCount} occurrence(s) in ${args.path}`;
    }
  },
  {
    name: 'list_directory',
    description: 'List files and subdirectories in a directory with file types and sizes.',
    category: 'file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to workspace root. Empty or "." for root directory.' },
        recursive: { type: 'boolean', description: 'Whether to list recursively. Default false.' },
        max_depth: { type: 'number', description: 'Maximum recursion depth. Default 2.' }
      },
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const entries = await services.fileSystem.listDirectory(
        (args.path as string) || '.',
        {
          recursive: args.recursive as boolean | undefined,
          maxDepth: args.max_depth as number | undefined
        }
      );

      if (entries.length === 0) return '(empty directory)';

      return entries.map(e => {
        const icon = e.type === 'directory' ? '📁' : e.type === 'symlink' ? '🔗' : '📄';
        const sizeStr = e.type === 'file' ? ` (${formatSize(e.size)})` : '';
        return `${icon} ${e.path}${sizeStr}`;
      }).join('\n');
    }
  },
  {
    name: 'get_file_info',
    description: 'Get file metadata including size, modification time, and type without reading contents.',
    category: 'file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the workspace root.' }
      },
      required: ['path'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const info = await services.fileSystem.getFileInfo(args.path as string);
      return [
        `Name: ${info.name}`,
        `Path: ${info.path}`,
        `Type: ${info.type}`,
        `Size: ${formatSize(info.size)}`,
        `Modified: ${info.modifiedAt.toISOString()}`
      ].join('\n');
    }
  },
  {
    name: 'find_files',
    description: 'Find files in the workspace by glob-like pattern. Uses ripgrep when available.',
    category: 'file',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'File glob, for example "*.ts" or "src/**/*.tsx".' }
      },
      required: ['pattern'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const files = await services.fileSystem.findFiles(args.pattern as string);
      if (files.length === 0) return 'No files found.';
      return files.join('\n');
    }
  },
  {
    name: 'read_multiple_files',
    description: 'Read multiple files at once. More efficient than calling read_file multiple times.',
    category: 'file',
    parameters: {
      type: 'object',
      properties: {
        paths: { type: 'array', items: { type: 'string' }, description: 'Array of file paths relative to workspace root.' },
        max_files: { type: 'number', description: 'Maximum number of files to read. Default 10.' }
      },
      required: ['paths'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const results = await services.fileSystem.readMultipleFiles(
        args.paths as string[],
        (args.max_files as number) || 10
      );

      return results.map(r => {
        if (r.error) {
          return `=== ${r.path} ===\nERROR: ${r.error}`;
        }
        return `=== ${r.path} ===\n${r.content}`;
      }).join('\n\n');
    }
  },
  {
    name: 'delete_file',
    description: 'Delete a file or directory. Use with caution.',
    category: 'file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the workspace root.' },
        recursive: { type: 'boolean', description: 'Whether to recursively delete directories. Default false.' }
      },
      required: ['path'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      await services.fileSystem.deleteFile(
        args.path as string,
        args.recursive as boolean | undefined
      );
      return `Deleted: ${args.path}`;
    }
  },
  {
    name: 'move_file',
    description: 'Move or rename a file or directory.',
    category: 'file',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path relative to workspace root.' },
        destination: { type: 'string', description: 'Destination path relative to workspace root.' }
      },
      required: ['source', 'destination'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      await services.fileSystem.moveFile(
        args.source as string,
        args.destination as string
      );
      return `Moved: ${args.source} -> ${args.destination}`;
    }
  }
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

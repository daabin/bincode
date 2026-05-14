/**
 * Search and comparison tools
 */

import type { ToolHandler } from './types.js';

export const searchTools: ToolHandler[] = [
  {
    name: 'search_text',
    description: 'Search text in workspace files. Uses ripgrep when available.',
    category: 'search',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text or regex query to search for.' },
        path: { type: 'string', description: 'Optional relative directory or file to search within.' },
        case_sensitive: { type: 'boolean', description: 'Whether search is case-sensitive. Default true.' }
      },
      required: ['query'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const matches = await services.search.searchText(args.query as string, {
        path: args.path as string | undefined,
        caseSensitive: args.case_sensitive as boolean | undefined
      });

      if (matches.length === 0) return 'No matches found.';

      return matches.map(m =>
        `${m.file}:${m.line}:${m.column}  ${m.content}`
      ).join('\n');
    }
  },
  {
    name: 'compare_files',
    description: 'Compare two files and show differences. Supports unified diff format.',
    category: 'search',
    parameters: {
      type: 'object',
      properties: {
        file1: { type: 'string', description: 'Path to first file.' },
        file2: { type: 'string', description: 'Path to second file.' },
        ignore_whitespace: { type: 'boolean', description: 'Ignore whitespace differences. Default false.' }
      },
      required: ['file1', 'file2'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const [content1, content2] = await Promise.all([
        services.fileSystem.readFile(args.file1 as string),
        services.fileSystem.readFile(args.file2 as string)
      ]);

      const lines1 = (args.ignore_whitespace ? content1.trim() : content1).split('\n');
      const lines2 = (args.ignore_whitespace ? content2.trim() : content2).split('\n');

      const diff: string[] = [];
      let i = 0, j = 0;

      while (i < lines1.length || j < lines2.length) {
        if (i < lines1.length && j < lines2.length && lines1[i] === lines2[j]) {
          diff.push(` ${lines1[i]}`);
          i++; j++;
        } else {
          if (i < lines1.length) {
            diff.push(`-${lines1[i]}`);
            i++;
          }
          if (j < lines2.length) {
            diff.push(`+${lines2[j]}`);
            j++;
          }
        }
      }

      return diff.join('\n');
    }
  }
];

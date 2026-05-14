/**
 * Code intelligence tools
 */

import type { ToolHandler } from './types.js';

export const codeTools: ToolHandler[] = [
  {
    name: 'code_search',
    description: 'Search code symbols (functions, classes, interfaces) by name. Builds an index of the workspace for fast symbol lookup.',
    category: 'code',
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
    },
    handler: async (args, { services }) => {
      // Use search service to find symbols
      const query = args.query as string;
      const matches = await services.search.searchText(query, {
        maxResults: (args.limit as number) || 10
      });

      if (matches.length === 0) return 'No symbols found.';

      return matches.map(m =>
        `${m.file}:${m.line}:${m.column}  ${m.content}`
      ).join('\n');
    }
  },
  {
    name: 'code_complete',
    description: 'Get AI-powered code completion at a specific location in a file.',
    category: 'code',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path.' },
        line: { type: 'number', description: 'Cursor line number (1-based).' },
        column: { type: 'number', description: 'Cursor column number (1-based).' }
      },
      required: ['path', 'line', 'column'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const filePath = args.path as string;
      const line = args.line as number;
      const column = args.column as number;

      const content = await services.fileSystem.readFile(filePath);
      const lines = content.split('\n');

      if (line < 1 || line > lines.length) {
        throw new Error(`Line ${line} is out of range. File has ${lines.length} lines.`);
      }

      const beforeCursor = lines.slice(0, line - 1).join('\n') +
        (line > 1 ? '\n' : '') +
        lines[line - 1].substring(0, column - 1);

      const afterCursor = lines[line - 1].substring(column - 1) +
        '\n' +
        lines.slice(line).join('\n');

      return [
        `File: ${filePath}`,
        `Cursor: line ${line}, column ${column}`,
        '',
        '--- Before cursor ---',
        beforeCursor.slice(-500),
        '',
        '--- After cursor ---',
        afterCursor.slice(0, 500)
      ].join('\n');
    }
  },
  {
    name: 'generate_docs',
    description: 'Generate documentation for code files. Can generate JSDoc/TSDoc comments, README sections, or API documentation.',
    category: 'code',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File or directory path to generate docs for.' },
        type: { type: 'string', enum: ['jsdoc', 'readme', 'api'], description: 'Type of documentation to generate. Default: jsdoc' },
        output: { type: 'string', description: 'Output file path (optional, defaults to stdout)' }
      },
      required: ['path'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const filePath = args.path as string;
      const docType = (args.type as string) || 'jsdoc';

      const content = await services.fileSystem.readFile(filePath);

      // Extract structure info
      const lines = content.split('\n');
      const exports: string[] = [];
      const functions: string[] = [];
      const classes: string[] = [];
      const interfaces: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('export ')) exports.push(trimmed);
        if (trimmed.startsWith('function ') || trimmed.startsWith('export function ')) functions.push(trimmed);
        if (trimmed.startsWith('class ') || trimmed.startsWith('export class ')) classes.push(trimmed);
        if (trimmed.startsWith('interface ') || trimmed.startsWith('export interface ')) interfaces.push(trimmed);
      }

      let result = '';

      switch (docType) {
        case 'jsdoc':
          result = [
            `/**`,
            ` * ${filePath}`,
            ` * @module`,
            ` */`,
            '',
            ...functions.map(f => {
              const name = f.replace(/^(export\s+)?function\s+/, '').split('(')[0];
              return [
                `/**`,
                ` * ${name} - Description needed`,
                ` * @param args - Function arguments`,
                ` * @returns Result description`,
                ` */`
              ].join('\n');
            }),
            ...classes.map(c => {
              const name = c.replace(/^(export\s+)?class\s+/, '').split(/\s|{/)[0];
              return [
                `/**`,
                ` * ${name} - Description needed`,
                ` */`
              ].join('\n');
            })
          ].join('\n');
          break;

        case 'readme':
          result = [
            `# ${filePath.replace(/^src\//, '').replace(/\.(ts|tsx)$/, '')}`,
            '',
            '## Overview',
            'TODO: Add description',
            '',
            '## Exports',
            ...exports.map(e => `- \`${e}\``),
            '',
            '## Usage',
            '```typescript',
            `import { ... } from '${filePath.replace(/\.(ts|tsx)$/, '')}';`,
            '```'
          ].join('\n');
          break;

        case 'api':
          result = [
            `## ${filePath}`,
            '',
            '### Functions',
            ...functions.map(f => {
              const name = f.replace(/^(export\s+)?function\s+/, '').split('(')[0];
              return `- \`${name}()\``;
            }),
            '',
            '### Classes',
            ...classes.map(c => {
              const name = c.replace(/^(export\s+)?class\s+/, '').split(/\s|{/)[0];
              return `- \`${name}\``;
            }),
            '',
            '### Interfaces',
            ...interfaces.map(i => {
              const name = i.replace(/^(export\s+)?interface\s+/, '').split(/\s|{/)[0];
              return `- \`${name}\``;
            })
          ].join('\n');
          break;
      }

      if (args.output) {
        await services.fileSystem.writeFile(args.output as string, result);
        return `Documentation written to: ${args.output}`;
      }

      return result;
    }
  }
];

/**
 * Web and image tools
 */

import type { ToolHandler } from './types.js';

export const webTools: ToolHandler[] = [
  {
    name: 'web_search',
    description: 'Search the web for information using a search query. Returns a list of results with titles, URLs, and snippets.',
    category: 'web',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query.' },
        limit: { type: 'number', description: 'Maximum number of results to return. Default 5.' }
      },
      required: ['query'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const results = await services.web.search(
        args.query as string,
        (args.limit as number) || 5
      );

      if (results.length === 0) return 'No search results found.';

      return results.map((r, i) =>
        `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`
      ).join('\n\n');
    }
  },
  {
    name: 'web_fetch',
    description: 'Fetch content from a URL and return the text content.',
    category: 'web',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch.' },
        selector: { type: 'string', description: 'Optional CSS selector to extract specific content.' }
      },
      required: ['url'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      return services.web.fetch(
        args.url as string,
        args.selector as string | undefined
      );
    }
  },
  {
    name: 'analyze_image',
    description: 'Analyze an image file. Returns format, dimensions, size, and base64 data for multimodal LLM processing.',
    category: 'web',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the image file (PNG, JPG, WebP, GIF, BMP).' }
      },
      required: ['path'],
      additionalProperties: false
    },
    handler: async (args, { services }) => {
      const analysis = await services.image.analyzeImage(args.path as string);
      return [
        `Format: ${analysis.format}`,
        `Dimensions: ${analysis.width}x${analysis.height}`,
        `Size: ${analysis.size} bytes`,
        `Base64 length: ${analysis.base64.length} chars`
      ].join('\n');
    }
  }
];

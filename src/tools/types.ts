/**
 * Tool system types
 */

import type { ToolCategory } from '../types/core.js';
import type { ServiceContainer } from '../services/index.js';

/** Runtime context passed to every tool handler */
export interface ToolContext {
  cwd: string;
  services: ServiceContainer;
}

/** Internal tool handler definition (not the LLM-facing schema) */
export interface ToolHandler {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: (args: Record<string, unknown>, context: ToolContext) => Promise<string>;
}

/** Registry of all available tools */
export class ToolRegistry {
  private tools = new Map<string, ToolHandler>();

  register(tool: ToolHandler): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  registerAll(tools: ToolHandler[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  get(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolHandler[] {
    return Array.from(this.tools.values());
  }

  /** Convert to LLM-facing ToolDefinition array */
  toToolDefinitions(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: ToolHandler['parameters'];
    };
  }> {
    return this.getAll().map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));
  }

  /** Execute a tool by name */
  async execute(name: string, args: Record<string, unknown>, context: ToolContext): Promise<string> {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: "${name}". Available tools: ${this.getAll().map(t => t.name).join(', ')}`);
    }
    return tool.handler(args, context);
  }
}

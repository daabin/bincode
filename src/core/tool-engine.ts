/**
 * Tool execution engine
 * Manages tool registration, validation, and execution with error handling
 */

import { ToolRegistry, type ToolContext } from '../tools/index.js';
import type { ServiceContainer } from '../services/index.js';

export interface ToolEngineConfig {
  cwd: string;
  services: ServiceContainer;
}

export class ToolEngine {
  readonly registry: ToolRegistry;
  private readonly context: ToolContext;

  constructor(config: ToolEngineConfig) {
    this.registry = new ToolRegistry();
    this.context = {
      cwd: config.cwd,
      services: config.services
    };
  }

  /**
   * Get the tool execution context
   */
  getContext(): ToolContext {
    return this.context;
  }

  /**
   * Execute a tool by name with given arguments
   */
  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.registry.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: "${name}". Available tools: ${this.registry.getAll().map(t => t.name).join(', ')}`);
    }

    try {
      return await tool.handler(args, this.context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Tool "${name}" failed: ${message}`);
    }
  }

  /**
   * Get all tool definitions in LLM-compatible format
   */
  getToolDefinitions() {
    return this.registry.toToolDefinitions();
  }

  /**
   * Get all registered tool handlers
   */
  getTools() {
    return this.registry.getAll();
  }
}

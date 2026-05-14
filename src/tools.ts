/**
 * Tools - Backward-compatible wrapper
 *
 * Re-exports the new tool system from tools/ for backward compatibility.
 * New code should import from './tools/index.js' directly.
 */

import { createDefaultToolRegistry } from './tools/index.js';
import type { ToolDefinition } from './types/core.js';

// Create default registry for backward compatibility
const registry = createDefaultToolRegistry();

/** @deprecated Use ToolRegistry from './tools/index.js' */
export const toolDefinitions: ToolDefinition[] = registry.toToolDefinitions();

/** @deprecated Use ToolEngine from './core/tool-engine.js' */
export async function runTool(cwd: string, name: string, args: Record<string, unknown>): Promise<string> {
  const { createServiceContainer } = await import('./services/index.js');
  const { ToolEngine } = await import('./core/tool-engine.js');

  const engine = new ToolEngine({
    cwd,
    services: createServiceContainer(cwd)
  });

  // Register all default tools
  const { createDefaultToolRegistry } = await import('./tools/index.js');
  const defaultRegistry = createDefaultToolRegistry();
  for (const tool of defaultRegistry.getAll()) {
    engine.registry.register(tool);
  }

  return engine.execute(name, args);
}

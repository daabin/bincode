/**
 * Tool runner - convenience function for executing tools in tests and scripts
 */

import { ToolEngine } from '../core/tool-engine.js';
import { createServiceContainer } from '../services/index.js';
import { createDefaultToolRegistry } from './index.js';

/**
 * Execute a named tool with the given arguments in the specified directory.
 * Creates a fresh ToolEngine with all default tools registered.
 */
export async function runTool(cwd: string, name: string, args: Record<string, unknown>): Promise<string> {
  const registry = createDefaultToolRegistry();
  const engine = new ToolEngine({
    cwd,
    services: createServiceContainer(cwd)
  });
  for (const tool of registry.getAll()) {
    engine.registry.register(tool);
  }
  return engine.execute(name, args);
}

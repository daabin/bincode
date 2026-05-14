/**
 * Tool system - centralized tool registration and execution
 *
 * Architecture:
 * - tools/types.ts: ToolHandler, ToolRegistry, ToolContext types
 * - tools/*-tools.ts: Tool implementations grouped by category
 * - tools/index.ts: Default registry setup and exports
 */

export { ToolRegistry } from './types.js';
export type { ToolHandler, ToolContext } from './types.js';

export { fileTools } from './file-tools.js';
export { gitTools } from './git-tools.js';
export { searchTools } from './search-tools.js';
export { webTools } from './web-tools.js';
export { codeTools } from './code-tools.js';
export { systemTools } from './system-tools.js';

import { ToolRegistry } from './types.js';
import { fileTools } from './file-tools.js';
import { gitTools } from './git-tools.js';
import { searchTools } from './search-tools.js';
import { webTools } from './web-tools.js';
import { codeTools } from './code-tools.js';
import { systemTools } from './system-tools.js';

/**
 * Create the default tool registry with all built-in tools
 */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.registerAll(fileTools);
  registry.registerAll(gitTools);
  registry.registerAll(searchTools);
  registry.registerAll(webTools);
  registry.registerAll(codeTools);
  registry.registerAll(systemTools);
  return registry;
}

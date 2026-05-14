/**
 * ConfigWatcher - Backward-compatible wrapper
 *
 * Re-exports from the new config module.
 * New code should import from './config/index.js' directly.
 */

export { ConfigWatcher } from './config/index.js';
export type { ConfigChangeCallback } from './config/index.js';

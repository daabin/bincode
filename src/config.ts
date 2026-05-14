/**
 * Config - Backward-compatible wrapper
 *
 * Re-exports the new config module for backward compatibility.
 * New code should import from './config/index.js' directly.
 */

export {
  loadConfig,
  saveConfig,
  getApiKey,
  setApiKey,
  getProvider,
  setProvider,
  getBaseUrl,
  getModel,
  getLLMConfig,
  isCommandAllowed,
  getAllowedCommands,
  ConfigWatcher
} from './config/index.js';

export type { Config } from './types/config.js';
export type { ConfigChangeCallback } from './config/index.js';

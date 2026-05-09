/**
 * bincode - A powerful CLI code agent
 *
 * This module exports the core components for programmatic use.
 */

// Agent
export { Agent } from './agent.js';
export type { AgentConfig, AgentEvent } from './types.js';

// LLM Providers
export { createProvider, detectAvailableProviders } from './llm/index.js';
export type { LLMProvider, ProviderConfig, ProviderType } from './llm/types.js';

// Tools
export { toolDefinitions, runTool } from './tools.js';
export type { ToolDefinition } from './types.js';

// Configuration
export {
  loadConfig,
  saveConfig,
  getApiKey,
  setApiKey,
  getProvider,
  setProvider,
  getBaseUrl,
  getModel,
  getLLMConfig
} from './config.js';
export type { Config } from './config.js';

// Session management
export {
  createSession,
  loadSession,
  saveSession,
  deleteSession,
  listSessions,
  updateSession,
  exportSessionAsMarkdown
} from './session.js';
export type { SessionData, SessionMeta } from './session.js';

// Code indexing
export {
  indexWorkspace,
  loadIndex,
  searchSymbols,
  detectLanguage,
  extractSymbols
} from './indexer.js';
export type { IndexEntry, SymbolInfo, SearchResult } from './indexer.js';

// Image analysis
export {
  readImageAsBase64,
  analyzeImage,
  isSupportedImage,
  getImageMimeType,
  buildMultimodalMessage
} from './image.js';
export type { ImageAnalysis } from './image.js';

// Plugin system
export {
  loadPlugin,
  loadAllPlugins,
  scanPlugins,
  createExamplePlugin,
  validateManifest
} from './plugin.js';
export type { PluginManifest, LoadedPlugin } from './plugin.js';

// MCP client
export { MCPClient } from './mcp.js';
export type { MCPServerConfig, MCPToolDefinition, MCPToolResult } from './mcp.js';

// Retry utilities
export { withRetry, APIError, DEFAULT_RETRY_CONFIG } from './retry.js';
export type { RetryableErrorType, RetryConfig } from './retry.js';

// Token management
export {
  TokenCounter,
  globalTokenCounter,
  estimateTokens,
  estimateMessagesTokens
} from './tokens.js';
export type { TokenUsage, TokenUsageRecord } from './tokens.js';
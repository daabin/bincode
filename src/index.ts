/**
 * bincode - A powerful CLI code agent powered by DeepSeek
 *
 * Main entry point with unified exports for programmatic use.
 * Architecture:
 *   - types/       : Type definitions
 *   - core/        : Agent engine, tool engine, message pipeline
 *   - services/    : Abstracted service layer (file, git, search, web, etc.)
 *   - tools/       : Tool definitions grouped by category
 *   - llm/         : DeepSeek LLM provider
 *   - config/      : Configuration management
 *   - interfaces/  : Interface adapters (CLI, Web, VSCode)
 *   - plugins/     : Plugin system
 *   - utils/       : Utility functions
 */

// ===== Types =====
export type {
  Role,
  ChatMessage,
  ToolCall,
  ToolDefinition,
  ToolCategory,
  AgentEvent,
  AgentConfig,
  Config,
  LLMConfig
} from './types/index.js';

// ===== Core Engine =====
export { Agent, ToolEngine, ConversationManager, MessagePipeline, createAgent } from './core/index.js';
export type { AgentOptions, ToolEngineConfig, MessageMiddleware, CreateAgentOptions } from './core/index.js';

// ===== Services =====
export {
  createServiceContainer,
  LocalFileSystemService,
  LocalGitService,
  RipgrepSearchService,
  DefaultWebService,
  LocalImageService,
  SecureShellService
} from './services/index.js';
export type {
  ServiceContainer,
  IFileSystemService,
  IGitService,
  ISearchService,
  IWebService,
  IImageService,
  IShellService,
  FileInfo,
  DirEntry,
  GitStatus,
  SearchMatch,
  WebResult,
  ImageAnalysis,
  CommandResult
} from './services/index.js';

// ===== Tools =====
export {
  ToolRegistry,
  fileTools,
  gitTools,
  searchTools,
  webTools,
  codeTools,
  systemTools,
  createDefaultToolRegistry
} from './tools/index.js';
export type { ToolHandler, ToolContext } from './tools/index.js';

// ===== LLM Providers =====
export { DeepSeekProvider, getSupportedProviders } from './llm/index.js';
export type { LLMProvider, ProviderConfig, ProviderType } from './llm/types.js';

// ===== Configuration =====
export {
  loadConfig,
  saveConfig,
  getApiKey,
  setApiKey,
  getBaseUrl,
  getModel,
  getLLMConfig,
  isCommandAllowed,
  getAllowedCommands,
  ConfigWatcher
} from './config/index.js';
export type { ConfigChangeCallback } from './config/index.js';

// ===== Session Management =====
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

// ===== Code Indexing =====
export {
  indexWorkspace,
  loadIndex,
  searchSymbols,
  detectLanguage,
  extractSymbols
} from './indexer.js';
export type { IndexEntry, SymbolInfo, SearchResult } from './indexer.js';

// ===== Image Analysis =====
export {
  readImageAsBase64,
  analyzeImage,
  isSupportedImage,
  getImageMimeType,
  buildMultimodalMessage
} from './image.js';

// ===== Plugin System =====
export {
  loadPlugin,
  loadAllPlugins,
  scanPlugins,
  createExamplePlugin,
  validateManifest
} from './plugin.js';
export type { PluginManifest, LoadedPlugin } from './plugin.js';

// ===== MCP Client =====
export { MCPClient } from './mcp.js';
export type { MCPServerConfig, MCPToolDefinition, MCPToolResult } from './mcp.js';

// ===== Utilities =====
export { withRetry, APIError, DEFAULT_RETRY_CONFIG } from './retry.js';
export type { RetryableErrorType, RetryConfig } from './retry.js';

export {
  TokenCounter,
  globalTokenCounter,
  estimateTokens,
  estimateMessagesTokens
} from './tokens.js';
export type { TokenUsage, TokenUsageRecord } from './tokens.js';

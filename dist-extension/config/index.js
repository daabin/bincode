"use strict";
/**
 * Configuration module
 * Unified API for reading/writing configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigWatcher = void 0;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.getProvider = getProvider;
exports.setProvider = setProvider;
exports.getApiKey = getApiKey;
exports.setApiKey = setApiKey;
exports.getBaseUrl = getBaseUrl;
exports.setBaseUrl = setBaseUrl;
exports.getModel = getModel;
exports.setModel = setModel;
exports.getLLMConfig = getLLMConfig;
exports.isCommandAllowed = isCommandAllowed;
exports.getAllowedCommands = getAllowedCommands;
const loader_js_1 = require("./loader.js");
const env_js_1 = require("./env.js");
var watcher_js_1 = require("./watcher.js");
Object.defineProperty(exports, "ConfigWatcher", { enumerable: true, get: function () { return watcher_js_1.ConfigWatcher; } });
/**
 * Load configuration (file + env overrides)
 */
function loadConfig() {
    return (0, loader_js_1.loadConfigFile)();
}
/**
 * Save configuration
 */
function saveConfig(config) {
    (0, loader_js_1.saveConfigFile)(config);
}
/**
 * Get current provider
 * Priority: env var > config file > default
 */
function getProvider() {
    return (0, env_js_1.getProviderFromEnv)() || (0, loader_js_1.loadConfigFile)().provider || 'deepseek';
}
/**
 * Set provider
 */
function setProvider(provider) {
    const config = (0, loader_js_1.loadConfigFile)();
    config.provider = provider;
    (0, loader_js_1.saveConfigFile)(config);
}
/**
 * Get API key for current provider
 * Priority: env var > config file
 */
function getApiKey() {
    const provider = getProvider();
    return (0, env_js_1.getApiKeyFromEnv)(provider) || (0, loader_js_1.loadConfigFile)().apiKey;
}
/**
 * Set API key
 */
function setApiKey(apiKey) {
    const config = (0, loader_js_1.loadConfigFile)();
    config.apiKey = apiKey;
    (0, loader_js_1.saveConfigFile)(config);
}
/**
 * Get base URL for current provider
 * Priority: config file > env var > default
 */
function getBaseUrl() {
    const provider = getProvider();
    return (0, loader_js_1.loadConfigFile)().baseUrl || (0, env_js_1.getDefaultBaseUrl)(provider);
}
/**
 * Set base URL
 */
function setBaseUrl(baseUrl) {
    const config = (0, loader_js_1.loadConfigFile)();
    config.baseUrl = baseUrl;
    (0, loader_js_1.saveConfigFile)(config);
}
/**
 * Get model for current provider
 * Priority: config file > env var > default
 */
function getModel() {
    const provider = getProvider();
    return (0, loader_js_1.loadConfigFile)().model || (0, env_js_1.getDefaultModel)(provider);
}
/**
 * Set model
 */
function setModel(model) {
    const config = (0, loader_js_1.loadConfigFile)();
    config.model = model;
    (0, loader_js_1.saveConfigFile)(config);
}
/**
 * Get complete LLM configuration
 */
function getLLMConfig() {
    const provider = getProvider();
    return {
        provider,
        apiKey: getApiKey() || '',
        baseUrl: getBaseUrl(),
        model: getModel()
    };
}
/**
 * Check if a command is allowed
 */
function isCommandAllowed(command) {
    const config = (0, loader_js_1.loadConfigFile)();
    const baseCommand = command.split('/').pop()?.split(' ')[0] || command;
    if (config.deniedCommands?.includes(baseCommand)) {
        return false;
    }
    if (config.allowedCommands) {
        return config.allowedCommands.includes(baseCommand);
    }
    // Default allowed commands
    const defaultAllowed = [
        'npm', 'git', 'node', 'tsc', 'eslint', 'npx', 'yarn', 'pnpm',
        'cat', 'ls', 'pwd', 'echo', 'head', 'tail', 'wc', 'sort', 'uniq',
        'rg', 'grep', 'find', 'sed', 'awk',
        'curl', 'wget',
        'python', 'python3',
        'mkdir', 'cp', 'mv', 'rm',
        'docker', 'make', 'cargo', 'go', 'rustc',
        'deno', 'bun'
    ];
    return defaultAllowed.includes(baseCommand);
}
/**
 * Get allowed commands list
 */
function getAllowedCommands() {
    const config = (0, loader_js_1.loadConfigFile)();
    return config.allowedCommands || [
        'npm', 'git', 'node', 'tsc', 'eslint', 'npx', 'yarn', 'pnpm',
        'cat', 'ls', 'pwd', 'echo', 'head', 'tail', 'wc', 'sort', 'uniq',
        'rg', 'grep', 'find', 'sed', 'awk',
        'curl', 'wget',
        'python', 'python3',
        'mkdir', 'cp', 'mv', 'rm',
        'docker', 'make', 'cargo', 'go', 'rustc',
        'deno', 'bun'
    ];
}

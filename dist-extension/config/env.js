"use strict";
/**
 * Environment variable configuration (DeepSeek only)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvVarName = getEnvVarName;
exports.getApiKeyFromEnv = getApiKeyFromEnv;
exports.getDefaultBaseUrl = getDefaultBaseUrl;
exports.getDefaultModel = getDefaultModel;
exports.getProviderFromEnv = getProviderFromEnv;
/**
 * Get the environment variable name for DeepSeek API key
 */
function getEnvVarName(_provider) {
    return 'DEEPSEEK_API_KEY';
}
/**
 * Get API key from environment variables
 */
function getApiKeyFromEnv(_provider) {
    return process.env.DEEPSEEK_API_KEY || process.env.BINCODE_API_KEY;
}
/**
 * Get default base URL for DeepSeek
 */
function getDefaultBaseUrl(_provider) {
    return 'https://api.deepseek.com';
}
/**
 * Get default model for DeepSeek
 */
function getDefaultModel(_provider) {
    return 'deepseek-chat';
}
/**
 * Get provider from environment variable (always returns 'deepseek')
 */
function getProviderFromEnv() {
    return 'deepseek';
}

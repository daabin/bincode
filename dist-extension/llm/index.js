"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekProvider = void 0;
exports.getSupportedProviders = getSupportedProviders;
exports.getProviderDefaults = getProviderDefaults;
var deepseek_js_1 = require("./deepseek.js");
Object.defineProperty(exports, "DeepSeekProvider", { enumerable: true, get: function () { return deepseek_js_1.DeepSeekProvider; } });
/**
 * 获取所有支持的 Provider 类型（仅 DeepSeek）
 */
function getSupportedProviders() {
    return ['deepseek'];
}
/**
 * 获取 Provider 的默认配置
 */
function getProviderDefaults() {
    return {
        model: 'deepseek-chat',
        baseUrl: 'https://api.deepseek.com',
        apiKeyEnvVar: 'DEEPSEEK_API_KEY'
    };
}

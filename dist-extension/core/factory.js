"use strict";
/**
 * Agent Factory - Centralized agent creation
 *
 * Provides a convenient factory function for creating Agent instances
 * with DeepSeek provider and default configuration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgent = createAgent;
const agent_js_1 = require("./agent.js");
const index_js_1 = require("../llm/index.js");
const index_js_2 = require("../services/index.js");
const index_js_3 = require("../tools/index.js");
const index_js_4 = require("../config/index.js");
/**
 * Create a new Agent instance with DeepSeek provider
 *
 * @param options - Agent configuration options
 * @returns Configured Agent instance
 *
 * @example
 * ```typescript
 * const agent = createAgent({ cwd: process.cwd() });
 * for await (const event of agent.run('Help me analyze this code')) {
 *   console.log(event);
 * }
 * ```
 */
function createAgent(options = {}) {
    const cwd = options.cwd ?? process.cwd();
    const provider = new index_js_1.DeepSeekProvider();
    const services = (0, index_js_2.createServiceContainer)(cwd);
    const config = {
        cwd,
        apiKey: options.apiKey ?? (0, index_js_4.getApiKey)() ?? '',
        baseUrl: options.baseUrl ?? (0, index_js_4.getBaseUrl)(),
        model: options.model ?? (0, index_js_4.getModel)(),
        maxIterations: options.maxIterations ?? 30,
        provider: 'deepseek'
    };
    const agent = new agent_js_1.Agent({
        config,
        provider,
        services,
        systemPrompt: options.systemPrompt
    });
    // Register default tools
    const toolRegistry = (0, index_js_3.createDefaultToolRegistry)();
    for (const tool of toolRegistry.getAll()) {
        agent.getToolEngine().registry.register(tool);
    }
    return agent;
}

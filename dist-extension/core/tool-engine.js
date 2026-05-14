"use strict";
/**
 * Tool execution engine
 * Manages tool registration, validation, and execution with error handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolEngine = void 0;
const index_js_1 = require("../tools/index.js");
class ToolEngine {
    registry;
    context;
    constructor(config) {
        this.registry = new index_js_1.ToolRegistry();
        this.context = {
            cwd: config.cwd,
            services: config.services
        };
    }
    /**
     * Get the tool execution context
     */
    getContext() {
        return this.context;
    }
    /**
     * Execute a tool by name with given arguments
     */
    async execute(name, args) {
        const tool = this.registry.get(name);
        if (!tool) {
            throw new Error(`Unknown tool: "${name}". Available tools: ${this.registry.getAll().map(t => t.name).join(', ')}`);
        }
        try {
            return await tool.handler(args, this.context);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Tool "${name}" failed: ${message}`);
        }
    }
    /**
     * Get all tool definitions in LLM-compatible format
     */
    getToolDefinitions() {
        return this.registry.toToolDefinitions();
    }
    /**
     * Get all registered tool handlers
     */
    getTools() {
        return this.registry.getAll();
    }
}
exports.ToolEngine = ToolEngine;

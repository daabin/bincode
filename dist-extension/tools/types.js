"use strict";
/**
 * Tool system types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
/** Registry of all available tools */
class ToolRegistry {
    tools = new Map();
    register(tool) {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool "${tool.name}" is already registered`);
        }
        this.tools.set(tool.name, tool);
    }
    registerAll(tools) {
        for (const tool of tools) {
            this.register(tool);
        }
    }
    get(name) {
        return this.tools.get(name);
    }
    getAll() {
        return Array.from(this.tools.values());
    }
    /** Convert to LLM-facing ToolDefinition array */
    toToolDefinitions() {
        return this.getAll().map(t => ({
            type: 'function',
            function: {
                name: t.name,
                description: t.description,
                parameters: t.parameters
            }
        }));
    }
    /** Execute a tool by name */
    async execute(name, args, context) {
        const tool = this.get(name);
        if (!tool) {
            throw new Error(`Unknown tool: "${name}". Available tools: ${this.getAll().map(t => t.name).join(', ')}`);
        }
        return tool.handler(args, context);
    }
}
exports.ToolRegistry = ToolRegistry;

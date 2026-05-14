"use strict";
/**
 * Tool runner - convenience function for executing tools in tests and scripts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTool = runTool;
const tool_engine_js_1 = require("../core/tool-engine.js");
const index_js_1 = require("../services/index.js");
const index_js_2 = require("./index.js");
/**
 * Execute a named tool with the given arguments in the specified directory.
 * Creates a fresh ToolEngine with all default tools registered.
 */
async function runTool(cwd, name, args) {
    const registry = (0, index_js_2.createDefaultToolRegistry)();
    const engine = new tool_engine_js_1.ToolEngine({
        cwd,
        services: (0, index_js_1.createServiceContainer)(cwd)
    });
    for (const tool of registry.getAll()) {
        engine.registry.register(tool);
    }
    return engine.execute(name, args);
}

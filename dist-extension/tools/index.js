"use strict";
/**
 * Tool system - centralized tool registration and execution
 *
 * Architecture:
 * - tools/types.ts: ToolHandler, ToolRegistry, ToolContext types
 * - tools/*-tools.ts: Tool implementations grouped by category
 * - tools/index.ts: Default registry setup and exports
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemTools = exports.codeTools = exports.webTools = exports.searchTools = exports.gitTools = exports.fileTools = exports.ToolRegistry = void 0;
exports.createDefaultToolRegistry = createDefaultToolRegistry;
var types_js_1 = require("./types.js");
Object.defineProperty(exports, "ToolRegistry", { enumerable: true, get: function () { return types_js_1.ToolRegistry; } });
var file_tools_js_1 = require("./file-tools.js");
Object.defineProperty(exports, "fileTools", { enumerable: true, get: function () { return file_tools_js_1.fileTools; } });
var git_tools_js_1 = require("./git-tools.js");
Object.defineProperty(exports, "gitTools", { enumerable: true, get: function () { return git_tools_js_1.gitTools; } });
var search_tools_js_1 = require("./search-tools.js");
Object.defineProperty(exports, "searchTools", { enumerable: true, get: function () { return search_tools_js_1.searchTools; } });
var web_tools_js_1 = require("./web-tools.js");
Object.defineProperty(exports, "webTools", { enumerable: true, get: function () { return web_tools_js_1.webTools; } });
var code_tools_js_1 = require("./code-tools.js");
Object.defineProperty(exports, "codeTools", { enumerable: true, get: function () { return code_tools_js_1.codeTools; } });
var system_tools_js_1 = require("./system-tools.js");
Object.defineProperty(exports, "systemTools", { enumerable: true, get: function () { return system_tools_js_1.systemTools; } });
const types_js_2 = require("./types.js");
const file_tools_js_2 = require("./file-tools.js");
const git_tools_js_2 = require("./git-tools.js");
const search_tools_js_2 = require("./search-tools.js");
const web_tools_js_2 = require("./web-tools.js");
const code_tools_js_2 = require("./code-tools.js");
const system_tools_js_2 = require("./system-tools.js");
/**
 * Create the default tool registry with all built-in tools
 */
function createDefaultToolRegistry() {
    const registry = new types_js_2.ToolRegistry();
    registry.registerAll(file_tools_js_2.fileTools);
    registry.registerAll(git_tools_js_2.gitTools);
    registry.registerAll(search_tools_js_2.searchTools);
    registry.registerAll(web_tools_js_2.webTools);
    registry.registerAll(code_tools_js_2.codeTools);
    registry.registerAll(system_tools_js_2.systemTools);
    return registry;
}

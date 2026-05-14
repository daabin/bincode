"use strict";
/**
 * Service layer exports
 * All services are abstracted behind interfaces for testability and multi-platform support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureShellService = exports.LocalImageService = exports.DefaultWebService = exports.RipgrepSearchService = exports.LocalGitService = exports.LocalFileSystemService = void 0;
exports.createServiceContainer = createServiceContainer;
const file_system_js_1 = require("./file-system.js");
const git_js_1 = require("./git.js");
const search_js_1 = require("./search.js");
const web_js_1 = require("./web.js");
const image_js_1 = require("./image.js");
const shell_js_1 = require("./shell.js");
var file_system_js_2 = require("./file-system.js");
Object.defineProperty(exports, "LocalFileSystemService", { enumerable: true, get: function () { return file_system_js_2.LocalFileSystemService; } });
var git_js_2 = require("./git.js");
Object.defineProperty(exports, "LocalGitService", { enumerable: true, get: function () { return git_js_2.LocalGitService; } });
var search_js_2 = require("./search.js");
Object.defineProperty(exports, "RipgrepSearchService", { enumerable: true, get: function () { return search_js_2.RipgrepSearchService; } });
var web_js_2 = require("./web.js");
Object.defineProperty(exports, "DefaultWebService", { enumerable: true, get: function () { return web_js_2.DefaultWebService; } });
var image_js_2 = require("./image.js");
Object.defineProperty(exports, "LocalImageService", { enumerable: true, get: function () { return image_js_2.LocalImageService; } });
var shell_js_2 = require("./shell.js");
Object.defineProperty(exports, "SecureShellService", { enumerable: true, get: function () { return shell_js_2.SecureShellService; } });
/**
 * Create a default service container for local workspace
 */
function createServiceContainer(cwd, allowedCommands, deniedCommands) {
    return {
        fileSystem: new file_system_js_1.LocalFileSystemService(cwd),
        git: new git_js_1.LocalGitService(cwd),
        search: new search_js_1.RipgrepSearchService(cwd),
        web: new web_js_1.DefaultWebService(),
        image: new image_js_1.LocalImageService(cwd),
        shell: new shell_js_1.SecureShellService(cwd, allowedCommands, deniedCommands)
    };
}

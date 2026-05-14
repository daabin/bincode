"use strict";
/**
 * Search service abstraction
 * Supports ripgrep with fallback to Node.js native search
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RipgrepSearchService = void 0;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const path = __importStar(require("node:path"));
class RipgrepSearchService {
    workspaceRoot;
    ignoreDirs;
    constructor(workspaceRoot, ignoreDirs = ['.git', 'node_modules', 'dist']) {
        this.workspaceRoot = workspaceRoot;
        this.ignoreDirs = ignoreDirs;
    }
    async searchText(query, options) {
        const searchPath = options?.path
            ? path.resolve(this.workspaceRoot, options.path)
            : this.workspaceRoot;
        // Try ripgrep first
        try {
            return await this.searchWithRipgrep(query, searchPath, options);
        }
        catch {
            // Fallback to native search
            return this.searchWithNative(query, searchPath, options);
        }
    }
    async searchWithRipgrep(query, searchPath, options) {
        const args = [
            '--line-number',
            '--column',
            '--with-filename',
            '--no-heading',
            '--color', 'never',
            ...this.ignoreDirs.flatMap(d => ['-g', `!${d}/**`]),
        ];
        if (!options?.caseSensitive) {
            args.push('-i');
        }
        if (options?.maxResults) {
            args.push('-m', String(options.maxResults));
        }
        args.push('--', query, searchPath);
        const result = (0, node_child_process_1.execSync)(`rg ${args.map(a => `"${a}"`).join(' ')}`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        return result.trim().split('\n').filter(Boolean).map(line => {
            const parts = line.split(':');
            return {
                file: path.relative(this.workspaceRoot, parts[0]),
                line: parseInt(parts[1], 10),
                column: parseInt(parts[2], 10),
                content: parts.slice(3).join(':')
            };
        });
    }
    async searchWithNative(query, searchPath, options) {
        const results = [];
        const maxResults = options?.maxResults ?? 100;
        const caseSensitive = options?.caseSensitive ?? true;
        const walkDir = async (dir) => {
            if (results.length >= maxResults)
                return;
            let entries;
            try {
                entries = await node_fs_1.promises.readdir(dir, { withFileTypes: true });
            }
            catch {
                return;
            }
            for (const entry of entries) {
                if (results.length >= maxResults)
                    return;
                if (this.ignoreDirs.includes(entry.name))
                    continue;
                if (entry.name.startsWith('.') && entry.name !== '.')
                    continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await walkDir(fullPath);
                }
                else if (entry.isFile()) {
                    try {
                        const content = await node_fs_1.promises.readFile(fullPath, 'utf-8');
                        const lines = content.split('\n');
                        for (let i = 0; i < lines.length; i++) {
                            const lineContent = lines[i];
                            const matchIndex = caseSensitive
                                ? lineContent.indexOf(query)
                                : lineContent.toLowerCase().indexOf(query.toLowerCase());
                            if (matchIndex !== -1) {
                                results.push({
                                    file: path.relative(this.workspaceRoot, fullPath),
                                    line: i + 1,
                                    column: matchIndex + 1,
                                    content: lineContent.trim()
                                });
                                if (results.length >= maxResults)
                                    return;
                            }
                        }
                    }
                    catch {
                        // Skip binary or unreadable files
                    }
                }
            }
        };
        await walkDir(searchPath);
        return results;
    }
}
exports.RipgrepSearchService = RipgrepSearchService;

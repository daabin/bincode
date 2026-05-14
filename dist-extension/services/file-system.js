"use strict";
/**
 * File system service abstraction
 * Can be replaced with remote/virtual file system implementations
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
exports.LocalFileSystemService = void 0;
const node_fs_1 = require("node:fs");
const path = __importStar(require("node:path"));
class LocalFileSystemService {
    workspaceRoot;
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    resolvePath(filePath) {
        // Prevent path traversal
        const resolved = path.resolve(this.workspaceRoot, filePath);
        if (!resolved.startsWith(this.workspaceRoot)) {
            throw new Error(`Path traversal detected: ${filePath}`);
        }
        return resolved;
    }
    async readFile(filePath) {
        const fullPath = this.resolvePath(filePath);
        return node_fs_1.promises.readFile(fullPath, 'utf-8');
    }
    async writeFile(filePath, content) {
        const fullPath = this.resolvePath(filePath);
        await node_fs_1.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await node_fs_1.promises.writeFile(fullPath, content, 'utf-8');
    }
    async editFile(filePath, oldText, newText, options) {
        const content = await this.readFile(filePath);
        let result;
        let replacedCount = 0;
        let totalCount = 0;
        const escapedText = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const allMatches = content.match(new RegExp(escapedText, 'g'));
        totalCount = allMatches ? allMatches.length : 0;
        if (options?.replaceAll) {
            replacedCount = totalCount;
            result = content.replaceAll(oldText, newText);
        }
        else if (options?.occurrence != null) {
            const occurrence = options.occurrence;
            if (occurrence < 1) {
                throw new Error(`Invalid occurrence ${occurrence}: must be >= 1`);
            }
            if (occurrence > totalCount) {
                throw new Error(`Invalid occurrence ${occurrence}: only ${totalCount} occurrence(s) found`);
            }
            let count = 0;
            result = content.replace(new RegExp(escapedText, 'g'), (match) => {
                count++;
                if (count === occurrence) {
                    replacedCount = 1;
                    return newText;
                }
                return match;
            });
        }
        else {
            result = content.replace(oldText, newText);
            replacedCount = result !== content ? 1 : 0;
        }
        if (result === content) {
            throw new Error(`Text not found in file: ${oldText}`);
        }
        await this.writeFile(filePath, result);
        return { replacedCount, totalCount };
    }
    async listDirectory(dirPath, options) {
        const fullPath = this.resolvePath(dirPath);
        const entries = [];
        const readDir = async (currentPath, depth) => {
            if (options?.maxDepth !== undefined && depth > options.maxDepth)
                return;
            const dir = await node_fs_1.promises.opendir(currentPath);
            for await (const entry of dir) {
                if (entry.name.startsWith('.') && entry.name !== '.')
                    continue;
                if (entry.name === 'node_modules')
                    continue;
                const entryPath = path.join(currentPath, entry.name);
                const relativePath = path.relative(this.workspaceRoot, entryPath);
                let stats;
                try {
                    stats = await node_fs_1.promises.stat(entryPath);
                }
                catch {
                    continue;
                }
                entries.push({
                    name: entry.name,
                    path: relativePath,
                    type: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file',
                    size: stats.size
                });
                if (entry.isDirectory() && options?.recursive) {
                    await readDir(entryPath, depth + 1);
                }
            }
        };
        await readDir(fullPath, 0);
        return entries;
    }
    async getFileInfo(filePath) {
        const fullPath = this.resolvePath(filePath);
        const stats = await node_fs_1.promises.stat(fullPath);
        return {
            name: path.basename(filePath),
            path: filePath,
            size: stats.size,
            type: stats.isDirectory() ? 'directory' : stats.isSymbolicLink() ? 'symlink' : 'file',
            modifiedAt: stats.mtime
        };
    }
    async findFiles(pattern) {
        // Use ripgrep for glob matching when available
        try {
            const { execSync } = await Promise.resolve().then(() => __importStar(require('node:child_process')));
            const result = execSync(`rg --files -g "${pattern}" "${this.workspaceRoot}"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
            return result.trim().split('\n').filter(Boolean).map(f => path.relative(this.workspaceRoot, f));
        }
        catch {
            // Fallback: simple glob matching
            const matches = [];
            const walkDir = async (dir) => {
                const entries = await node_fs_1.promises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (entry.name.startsWith('.') || entry.name === 'node_modules')
                            continue;
                        await walkDir(fullPath);
                    }
                    else {
                        const relativePath = path.relative(this.workspaceRoot, fullPath);
                        if (this.matchGlob(relativePath, pattern)) {
                            matches.push(relativePath);
                        }
                    }
                }
            };
            await walkDir(this.workspaceRoot);
            return matches;
        }
    }
    matchGlob(filePath, pattern) {
        // Simple glob matching (supports *, **, ?)
        const regexStr = pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '___DOUBLESTAR___')
            .replace(/\*/g, '[^/]*')
            .replace(/___DOUBLESTAR___/g, '.*')
            .replace(/\?/g, '.');
        return new RegExp(`^${regexStr}$`).test(filePath);
    }
    async deleteFile(filePath, recursive) {
        const fullPath = this.resolvePath(filePath);
        const stats = await node_fs_1.promises.stat(fullPath);
        if (stats.isDirectory()) {
            await node_fs_1.promises.rm(fullPath, { recursive: recursive ?? false, force: true });
        }
        else {
            await node_fs_1.promises.unlink(fullPath);
        }
    }
    async moveFile(source, destination) {
        const srcPath = this.resolvePath(source);
        const destPath = this.resolvePath(destination);
        await node_fs_1.promises.mkdir(path.dirname(destPath), { recursive: true });
        await node_fs_1.promises.rename(srcPath, destPath);
    }
    async readMultipleFiles(paths, maxFiles = 10) {
        const results = [];
        const toRead = paths.slice(0, maxFiles);
        for (const filePath of toRead) {
            try {
                const content = await this.readFile(filePath);
                results.push({ path: filePath, content });
            }
            catch (error) {
                results.push({
                    path: filePath,
                    content: '',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        return results;
    }
}
exports.LocalFileSystemService = LocalFileSystemService;

"use strict";
/**
 * Image analysis service abstraction
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
exports.LocalImageService = void 0;
const node_fs_1 = require("node:fs");
const path = __importStar(require("node:path"));
class LocalImageService {
    workspaceRoot;
    supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
    constructor(workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
    isSupportedImage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.supportedExtensions.has(ext);
    }
    getImageMimeType(filePath) {
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp'
        };
        return mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    }
    async analyzeImage(filePath) {
        const fullPath = path.resolve(this.workspaceRoot, filePath);
        const stats = await node_fs_1.promises.stat(fullPath);
        const buffer = await node_fs_1.promises.readFile(fullPath);
        const base64 = buffer.toString('base64');
        // Parse dimensions from image headers
        const { width, height } = this.parseImageDimensions(buffer, path.extname(filePath));
        return {
            format: path.extname(filePath).slice(1).toUpperCase(),
            width,
            height,
            size: stats.size,
            base64
        };
    }
    parseImageDimensions(buffer, ext) {
        try {
            if (ext === '.png') {
                // PNG: IHDR chunk at offset 16
                return {
                    width: buffer.readUInt32BE(16),
                    height: buffer.readUInt32BE(20)
                };
            }
            if (ext === '.jpg' || ext === '.jpeg') {
                // JPEG: search for SOF marker
                let offset = 2;
                while (offset < buffer.length) {
                    if (buffer[offset] === 0xFF) {
                        const marker = buffer[offset + 1];
                        if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
                            return {
                                height: buffer.readUInt16BE(offset + 5),
                                width: buffer.readUInt16BE(offset + 7)
                            };
                        }
                        const length = buffer.readUInt16BE(offset + 2);
                        offset += length + 2;
                    }
                    else {
                        offset++;
                    }
                }
            }
            if (ext === '.gif') {
                return {
                    width: buffer.readUInt16LE(6),
                    height: buffer.readUInt16LE(8)
                };
            }
            if (ext === '.webp') {
                // WebP: VP8/VP8L chunk
                return {
                    width: buffer.readUInt16LE(26) & 0x3FFF,
                    height: buffer.readUInt16LE(28) & 0x3FFF
                };
            }
        }
        catch {
            // Fallback
        }
        return { width: 0, height: 0 };
    }
    async buildMultimodalMessage(filePath, prompt) {
        const analysis = await this.analyzeImage(filePath);
        const mimeType = this.getImageMimeType(filePath);
        return {
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:${mimeType};base64,${analysis.base64}`
                    }
                }
            ]
        };
    }
}
exports.LocalImageService = LocalImageService;

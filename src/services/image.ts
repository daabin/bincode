/**
 * Image analysis service abstraction
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface ImageAnalysis {
  format: string;
  width: number;
  height: number;
  size: number;
  base64: string;
}

export interface IImageService {
  analyzeImage(filePath: string): Promise<ImageAnalysis>;
  isSupportedImage(filePath: string): boolean;
  getImageMimeType(filePath: string): string;
  buildMultimodalMessage(filePath: string, prompt: string): Promise<{ role: string; content: Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
}

export class LocalImageService implements IImageService {
  private readonly supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

  constructor(private readonly workspaceRoot: string) {}

  isSupportedImage(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.has(ext);
  }

  getImageMimeType(filePath: string): string {
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp'
    };
    return mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  }

  async analyzeImage(filePath: string): Promise<ImageAnalysis> {
    const fullPath = path.resolve(this.workspaceRoot, filePath);
    const stats = await fs.stat(fullPath);
    const buffer = await fs.readFile(fullPath);
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

  private parseImageDimensions(buffer: Buffer, ext: string): { width: number; height: number } {
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
          } else {
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
    } catch {
      // Fallback
    }

    return { width: 0, height: 0 };
  }

  async buildMultimodalMessage(
    filePath: string,
    prompt: string
  ): Promise<{ role: string; content: Array<{ type: string; text?: string; image_url?: { url: string } }> }> {
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

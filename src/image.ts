import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * 支持的图片格式
 */
const SUPPORTED_IMAGE_FORMATS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);

/**
 * 最大图片大小 (5MB)
 */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/**
 * 图片分析结果
 */
export interface ImageAnalysis {
  format: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
  base64: string;
  description?: string;
}

/**
 * 检查文件是否为支持的图片格式
 */
export function isSupportedImage(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  return SUPPORTED_IMAGE_FORMATS.has(ext);
}

/**
 * 获取图片的 MIME 类型
 */
export function getImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp'
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * 读取图片文件并转为 base64
 */
export async function readImageAsBase64(filePath: string): Promise<ImageAnalysis> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image file not found: ${filePath}`);
  }

  if (!isSupportedImage(filePath)) {
    throw new Error(`Unsupported image format. Supported: ${Array.from(SUPPORTED_IMAGE_FORMATS).join(', ')}`);
  }

  const stat = fs.statSync(filePath);
  
  if (stat.size > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Maximum size: 5MB`);
  }

  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  const mimeType = getImageMimeType(filePath);

  // 尝试获取图片尺寸（简单 PNG/JPEG 解析）
  const dimensions = getImageDimensions(buffer, path.extname(filePath).toLowerCase());

  return {
    format: path.extname(filePath).toLowerCase().slice(1),
    width: dimensions.width,
    height: dimensions.height,
    size: stat.size,
    mimeType,
    base64
  };
}

/**
 * 简单获取 PNG/JPEG 图片尺寸
 */
function getImageDimensions(buffer: Buffer, ext: string): { width: number; height: number } {
  try {
    if (ext === '.png') {
      // PNG: width at offset 16, height at offset 20 (big-endian)
      if (buffer.length >= 24) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        if (width > 0 && height > 0 && width < 100000 && height < 100000) {
          return { width, height };
        }
      }
    } else if (ext === '.jpg' || ext === '.jpeg') {
      // JPEG: parse SOF markers
      let offset = 2;
      while (offset < buffer.length - 1) {
        if (buffer[offset] !== 0xFF) break;
        const marker = buffer[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        const segLen = buffer.readUInt16BE(offset + 2);
        offset += 2 + segLen;
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return { width: 0, height: 0 };
}

/**
 * 将图片分析结果转为多模态消息内容
 */
export function imageToMessageContent(image: ImageAnalysis): {
  type: 'image_url';
  image_url: { url: string; detail: string };
} {
  return {
    type: 'image_url',
    image_url: {
      url: `data:${image.mimeType};base64,${image.base64}`,
      detail: 'auto'
    }
  };
}

/**
 * 构建多模态消息（文本 + 图片）
 */
export function buildMultimodalMessage(
  text: string,
  images: ImageAnalysis[]
): Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> {
  const content: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [];
  
  if (text) {
    content.push({ type: 'text', text });
  }
  
  for (const image of images) {
    content.push(imageToMessageContent(image));
  }
  
  return content;
}

/**
 * 分析图片文件（工具函数）
 */
export async function analyzeImage(filePath: string): Promise<string> {
  const image = await readImageAsBase64(filePath);
  
  const lines: string[] = [
    `Image Analysis: ${path.basename(filePath)}`,
    `  Format: ${image.format.toUpperCase()}`,
    `  Dimensions: ${image.width}x${image.height}`,
    `  Size: ${(image.size / 1024).toFixed(1)} KB`,
    `  MIME Type: ${image.mimeType}`,
    `  Base64 Length: ${image.base64.length} characters`
  ];
  
  return lines.join('\n');
}
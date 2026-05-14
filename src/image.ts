/**
 * Image analysis - Backward-compatible wrapper
 *
 * Re-exports from the services layer for backward compatibility.
 * New code should import from './services/image.js' directly.
 */

import { LocalImageService } from './services/image.js';
import type { ImageAnalysis as ServiceImageAnalysis } from './services/image.js';

export type { ImageAnalysis } from './services/image.js';

const defaultService = new LocalImageService(process.cwd());

/** @deprecated Use IImageService from './services/image.js' */
export async function readImageAsBase64(filePath: string): Promise<string> {
  const analysis = await defaultService.analyzeImage(filePath);
  return analysis.base64;
}

/** @deprecated Use IImageService from './services/image.js' */
export async function analyzeImage(filePath: string): Promise<ServiceImageAnalysis> {
  return defaultService.analyzeImage(filePath);
}

/** @deprecated Use IImageService from './services/image.js' */
export function isSupportedImage(filePath: string): boolean {
  return defaultService.isSupportedImage(filePath);
}

/** @deprecated Use IImageService from './services/image.js' */
export function getImageMimeType(filePath: string): string {
  return defaultService.getImageMimeType(filePath);
}

/** @deprecated Use IImageService from './services/image.js' */
export async function buildMultimodalMessage(filePath: string, prompt: string) {
  return defaultService.buildMultimodalMessage(filePath, prompt);
}

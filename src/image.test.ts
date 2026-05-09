import { describe, it, expect } from 'vitest';
import {
  isSupportedImage,
  getImageMimeType,
  readImageAsBase64,
  imageToMessageContent,
  buildMultimodalMessage,
  analyzeImage
} from './image.js';

describe('image', () => {
  describe('isSupportedImage', () => {
    it('should recognize supported formats', () => {
      expect(isSupportedImage('test.png')).toBe(true);
      expect(isSupportedImage('test.jpg')).toBe(true);
      expect(isSupportedImage('test.jpeg')).toBe(true);
      expect(isSupportedImage('test.webp')).toBe(true);
      expect(isSupportedImage('test.gif')).toBe(true);
      expect(isSupportedImage('test.bmp')).toBe(true);
    });

    it('should reject unsupported formats', () => {
      expect(isSupportedImage('test.txt')).toBe(false);
      expect(isSupportedImage('test.pdf')).toBe(false);
      expect(isSupportedImage('test.svg')).toBe(false);
    });
  });

  describe('getImageMimeType', () => {
    it('should return correct MIME types', () => {
      expect(getImageMimeType('test.png')).toBe('image/png');
      expect(getImageMimeType('test.jpg')).toBe('image/jpeg');
      expect(getImageMimeType('test.webp')).toBe('image/webp');
    });
  });

  describe('readImageAsBase64', () => {
    it('should throw for non-existent file', async () => {
      await expect(readImageAsBase64('/nonexistent/image.png')).rejects.toThrow('not found');
    });

    it('should throw for unsupported format', async () => {
      const { writeFileSync, unlinkSync, mkdtempSync } = await import('node:fs');
      const { join } = await import('node:path');
      const { tmpdir } = await import('node:os');
      const dir = mkdtempSync('/tmp/bincode-test-');
      const file = join(dir, 'test.txt');
      writeFileSync(file, 'hello');
      await expect(readImageAsBase64(file)).rejects.toThrow('Unsupported image format');
      unlinkSync(file);
      const { rmdirSync } = await import('node:fs');
      rmdirSync(dir);
    });
  });

  describe('imageToMessageContent', () => {
    it('should create image_url content', () => {
      const image = {
        format: 'png',
        width: 100,
        height: 100,
        size: 1024,
        mimeType: 'image/png',
        base64: 'abc123'
      };
      const content = imageToMessageContent(image);
      expect(content.type).toBe('image_url');
      expect(content.image_url.url).toContain('data:image/png;base64,abc123');
    });
  });

  describe('buildMultimodalMessage', () => {
    it('should build message with text and images', () => {
      const images = [{
        format: 'png' as const,
        width: 100,
        height: 100,
        size: 1024,
        mimeType: 'image/png',
        base64: 'abc'
      }];
      const content = buildMultimodalMessage('Describe this image', images);
      expect(content).toHaveLength(2);
      expect(content[0].type).toBe('text');
      expect(content[1].type).toBe('image_url');
    });
  });
});
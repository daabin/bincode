import { describe, it, expect } from 'vitest';
import { LocalImageService } from './services/image.js';

describe('image', () => {
  const service = new LocalImageService(process.cwd());

  describe('isSupportedImage', () => {
    it('should recognize supported formats', () => {
      expect(service.isSupportedImage('test.png')).toBe(true);
      expect(service.isSupportedImage('test.jpg')).toBe(true);
      expect(service.isSupportedImage('test.jpeg')).toBe(true);
      expect(service.isSupportedImage('test.webp')).toBe(true);
      expect(service.isSupportedImage('test.gif')).toBe(true);
      expect(service.isSupportedImage('test.bmp')).toBe(true);
    });

    it('should reject unsupported formats', () => {
      expect(service.isSupportedImage('test.txt')).toBe(false);
      expect(service.isSupportedImage('test.pdf')).toBe(false);
      expect(service.isSupportedImage('test.svg')).toBe(false);
    });
  });

  describe('getImageMimeType', () => {
    it('should return correct MIME types', () => {
      expect(service.getImageMimeType('test.png')).toBe('image/png');
      expect(service.getImageMimeType('test.jpg')).toBe('image/jpeg');
      expect(service.getImageMimeType('test.webp')).toBe('image/webp');
    });
  });

  describe('analyzeImage', () => {
    it('should throw for non-existent file', async () => {
      await expect(service.analyzeImage('/nonexistent/image.png')).rejects.toThrow();
    });
  });

  describe('buildMultimodalMessage', () => {
    it('should throw for non-existent file', async () => {
      await expect(
        service.buildMultimodalMessage('/nonexistent/image.png', 'Describe this')
      ).rejects.toThrow();
    });
  });
});

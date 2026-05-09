import { describe, it, expect } from 'vitest';
import {
  APIError,
  createAPIErrorFromResponse,
  createAPIErrorFromNetworkError,
  withRetry,
  fetchWithTimeout,
  type RetryableErrorType
} from './retry.js';

describe('retry', () => {
  describe('APIError', () => {
    it('should create an APIError with all properties', () => {
      const error = new APIError('Test error', 'rate_limit', 429, 60, new Error('original'));
      
      expect(error.message).toBe('Test error');
      expect(error.type).toBe('rate_limit');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.name).toBe('APIError');
    });

    it('should identify retryable errors correctly', () => {
      const retryableTypes: RetryableErrorType[] = ['network', 'rate_limit', 'timeout', 'server_error'];
      
      for (const type of retryableTypes) {
        const error = new APIError('Test', type);
        expect(error.isRetryable()).toBe(true);
      }

      const nonRetryableError = new APIError('Test', 'unknown');
      expect(nonRetryableError.isRetryable()).toBe(false);
    });

    it('should return correct retry delays', () => {
      const rateLimitError = new APIError('Rate limited', 'rate_limit', 429, 30);
      expect(rateLimitError.getRetryDelay()).toBe(30000); // 30 seconds

      const rateLimitErrorNoHeader = new APIError('Rate limited', 'rate_limit', 429);
      expect(rateLimitErrorNoHeader.getRetryDelay()).toBe(60000); // default 1 minute

      const serverError = new APIError('Server error', 'server_error', 500);
      expect(serverError.getRetryDelay()).toBe(5000); // 5 seconds

      const networkError = new APIError('Network error', 'network');
      expect(networkError.getRetryDelay()).toBe(2000); // 2 seconds
    });
  });

  describe('createAPIErrorFromResponse', () => {
    it('should create rate limit error from 429 response', () => {
      const mockResponse = {
        status: 429,
        headers: {
          get: () => '60'
        }
      } as unknown as Response;

      const error = createAPIErrorFromResponse(mockResponse, { error: { message: 'Too many requests' } });
      
      expect(error.type).toBe('rate_limit');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.message).toBe('Too many requests');
    });

    it('should create server error from 500 response', () => {
      const mockResponse = {
        status: 500,
        headers: {
          get: () => null
        }
      } as unknown as Response;

      const error = createAPIErrorFromResponse(mockResponse);
      
      expect(error.type).toBe('server_error');
      expect(error.statusCode).toBe(500);
    });

    it('should create timeout error from 504 response', () => {
      const mockResponse = {
        status: 504,
        headers: {
          get: () => null
        }
      } as unknown as Response;

      const error = createAPIErrorFromResponse(mockResponse);
      
      expect(error.type).toBe('timeout');
      expect(error.statusCode).toBe(504);
    });

    it('should create timeout error from 408 response', () => {
      const mockResponse = {
        status: 408,
        headers: {
          get: () => null
        }
      } as unknown as Response;

      const error = createAPIErrorFromResponse(mockResponse);
      
      expect(error.type).toBe('timeout');
      expect(error.statusCode).toBe(408);
    });

    it('should create unknown error from 400 response', () => {
      const mockResponse = {
        status: 400,
        headers: {
          get: () => null
        }
      } as unknown as Response;

      const error = createAPIErrorFromResponse(mockResponse);
      
      expect(error.type).toBe('unknown');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('createAPIErrorFromNetworkError', () => {
    it('should create network error from fetch TypeError', () => {
      const originalError = new TypeError('fetch failed');
      const error = createAPIErrorFromNetworkError(originalError);
      
      expect(error.type).toBe('network');
      expect(error.message).toContain('Network error');
    });

    it('should create timeout error from AbortError', () => {
      const originalError = new Error('The operation was aborted');
      originalError.name = 'AbortError';
      const error = createAPIErrorFromNetworkError(originalError);
      
      expect(error.type).toBe('timeout');
    });

    it('should create unknown error from other errors', () => {
      const originalError = new Error('Something went wrong');
      const error = createAPIErrorFromNetworkError(originalError);
      
      expect(error.type).toBe('unknown');
      expect(error.message).toBe('Something went wrong');
    });
  });

  describe('withRetry', () => {
    it('should return result on first successful attempt', async () => {
      const fn = () => Promise.resolve('success');
      
      const result = await withRetry(fn);
      
      expect(result).toBe('success');
    });

    it('should not retry on non-retryable errors', async () => {
      let callCount = 0;
      const fn = () => {
        callCount++;
        return Promise.reject(new APIError('Bad request', 'unknown', 400));
      };
      
      await expect(withRetry(fn, { maxRetries: 3, initialDelay: 10 })).rejects.toThrow('Bad request');
      expect(callCount).toBe(1);
    });

    it('should retry on retryable errors and succeed', async () => {
      let callCount = 0;
      const fn = () => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new APIError('Network error', 'network'));
        }
        return Promise.resolve('success');
      };
      
      const result = await withRetry(fn, { maxRetries: 3, initialDelay: 1, maxDelay: 10 });
      
      expect(result).toBe('success');
      expect(callCount).toBe(3);
    }, 10000);

    it('should throw after max retries exhausted', async () => {
      let callCount = 0;
      const fn = () => {
        callCount++;
        return Promise.reject(new APIError('Server error', 'server_error', 500));
      };
      
      await expect(withRetry(fn, { maxRetries: 2, initialDelay: 1, maxDelay: 10, backoffFactor: 1 })).rejects.toThrow('Server error');
      expect(callCount).toBe(3); // Initial + 2 retries
    }, 10000);

    it('should call onRetry callback on each retry', async () => {
      let callCount = 0;
      let retryCount = 0;
      const fn = () => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject(new APIError('Network error', 'network'));
        }
        return Promise.resolve('success');
      };
      
      const onRetry = (_attempt: number, _error: APIError, _delayMs: number) => {
        retryCount++;
      };
      
      await withRetry(fn, { maxRetries: 3, initialDelay: 1, maxDelay: 10 }, onRetry);
      
      expect(retryCount).toBe(1);
    }, 10000);
  });

  describe('fetchWithTimeout', () => {
    it('should return response within timeout', async () => {
      const mockResponse = new Response('OK', { status: 200 });
      global.fetch = () => Promise.resolve(mockResponse);
      
      const response = await fetchWithTimeout('https://example.com', {}, 5000);
      
      expect(response.status).toBe(200);
    });
  });
});

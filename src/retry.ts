/**
 * 可重试错误类型
 */
export type RetryableErrorType = 
  | 'network'
  | 'rate_limit'
  | 'timeout'
  | 'server_error'
  | 'unknown';

/**
 * API 错误类
 */
export class APIError extends Error {
  constructor(
    message: string,
    public readonly type: RetryableErrorType,
    public readonly statusCode?: number,
    public readonly retryAfter?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }

  /**
   * 判断错误是否可重试
   */
  isRetryable(): boolean {
    return (
      this.type === 'network' ||
      this.type === 'rate_limit' ||
      this.type === 'timeout' ||
      this.type === 'server_error'
    );
  }

  /**
   * 获取建议的重试延迟（毫秒）
   */
  getRetryDelay(): number {
    if (this.retryAfter) {
      return this.retryAfter * 1000;
    }
    
    switch (this.type) {
      case 'rate_limit':
        return 60000; // 1 minute
      case 'server_error':
        return 5000; // 5 seconds
      case 'network':
      case 'timeout':
        return 2000; // 2 seconds
      default:
        return 1000;
    }
  }
}

/**
 * 从 HTTP 响应创建 API 错误
 */
export function createAPIErrorFromResponse(
  response: Response,
  body?: { error?: { message?: string; code?: string } }
): APIError {
  const statusCode = response.status;
  let type: RetryableErrorType;
  let retryAfter: number | undefined;

  if (statusCode === 429) {
    type = 'rate_limit';
    const retryAfterHeader = response.headers.get('retry-after');
    if (retryAfterHeader) {
      retryAfter = parseInt(retryAfterHeader, 10);
    }
  } else if (statusCode === 408 || statusCode === 504) {
    type = 'timeout';
  } else if (statusCode >= 500) {
    type = 'server_error';
  } else {
    type = 'unknown';
  }

  const message = body?.error?.message || `API request failed with status ${statusCode}`;
  
  return new APIError(message, type, statusCode, retryAfter);
}

/**
 * 从网络错误创建 API 错误
 */
export function createAPIErrorFromNetworkError(error: unknown): APIError {
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new APIError(
      'Network error: Unable to connect to API',
      'network',
      undefined,
      undefined,
      error
    );
  }
  
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return new APIError(
        'Request timeout',
        'timeout',
        undefined,
        undefined,
        error
      );
    }
    
    return new APIError(
      error.message,
      'unknown',
      undefined,
      undefined,
      error
    );
  }
  
  return new APIError(
    'Unknown error occurred',
    'unknown',
    undefined,
    undefined,
    error
  );
}

/**
 * 重试配置
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: RetryableErrorType[];
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  retryableErrors: ['network', 'rate_limit', 'timeout', 'server_error']
};

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 计算重试延迟（指数退避）
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig,
  error?: APIError
): number {
  // 如果错误指定了重试延迟，使用它
  if (error?.getRetryDelay()) {
    return Math.min(error.getRetryDelay(), config.maxDelay);
  }
  
  // 指数退避
  const delayMs = config.initialDelay * Math.pow(config.backoffFactor, attempt);
  return Math.min(delayMs, config.maxDelay);
}

/**
 * 带重试的异步函数执行器
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: APIError, delayMs: number) => void
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: APIError | undefined;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // 转换为 APIError
      if (!(error instanceof APIError)) {
        if (error instanceof Response) {
          lastError = createAPIErrorFromResponse(error);
        } else {
          lastError = createAPIErrorFromNetworkError(error);
        }
      } else {
        lastError = error;
      }

      // 检查是否可重试
      if (
        attempt >= finalConfig.maxRetries ||
        !finalConfig.retryableErrors.includes(lastError.type)
      ) {
        throw lastError;
      }

      // 计算延迟
      const delayMs = calculateDelay(attempt, finalConfig, lastError);
      
      // 回调通知
      if (onRetry) {
        onRetry(attempt + 1, lastError, delayMs);
      }

      // 等待后重试
      await delay(delayMs);
    }
  }

  // 不应该到达这里，但 TypeScript 需要返回值
  throw lastError || new APIError('Max retries exceeded', 'unknown');
}

/**
 * 创建带超时的 fetch
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Token 使用统计
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Token 使用记录
 */
export interface TokenUsageRecord {
  timestamp: number;
  provider: string;
  model: string;
  usage: TokenUsage;
}

/**
 * Token 统计器类
 */
export class TokenCounter {
  private records: TokenUsageRecord[] = [];
  private readonly maxRecords: number;

  constructor(maxRecords: number = 1000) {
    this.maxRecords = maxRecords;
  }

  /**
   * 记录 Token 使用
   */
  record(
    provider: string,
    model: string,
    usage: TokenUsage
  ): void {
    this.records.push({
      timestamp: Date.now(),
      provider,
      model,
      usage
    });

    // 保持记录数量限制
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }
  }

  /**
   * 获取总使用量
   */
  getTotalUsage(): TokenUsage {
    return this.records.reduce(
      (acc, record) => ({
        promptTokens: acc.promptTokens + record.usage.promptTokens,
        completionTokens: acc.completionTokens + record.usage.completionTokens,
        totalTokens: acc.totalTokens + record.usage.totalTokens
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
  }

  /**
   * 获取今日使用量
   */
  getTodayUsage(): TokenUsage {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return this.records
      .filter(r => r.timestamp >= todayStart.getTime())
      .reduce(
        (acc, record) => ({
          promptTokens: acc.promptTokens + record.usage.promptTokens,
          completionTokens: acc.completionTokens + record.usage.completionTokens,
          totalTokens: acc.totalTokens + record.usage.totalTokens
        }),
        { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      );
  }

  /**
   * 获取使用记录
   */
  getRecords(limit?: number): TokenUsageRecord[] {
    const sorted = [...this.records].reverse();
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * 清除所有记录
   */
  clear(): void {
    this.records = [];
  }

  /**
   * 导出为 JSON
   */
  toJSON(): string {
    return JSON.stringify(this.records, null, 2);
  }

  /**
   * 从 JSON 导入
   */
  static fromJSON(json: string): TokenCounter {
    const counter = new TokenCounter();
    try {
      const records = JSON.parse(json) as TokenUsageRecord[];
      counter.records = records;
    } catch {
      // Ignore parse errors
    }
    return counter;
  }
}

/**
 * 模型上下文窗口配置
 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // DeepSeek
  'deepseek-chat': 64000,
  'deepseek-coder': 16000,
  'deepseek-v4-pro': 64000,
  
  // OpenAI
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-3.5-turbo': 16385,
  
  // Anthropic
  'claude-3-5-sonnet-20241022': 200000,
  'claude-3-opus-20240229': 200000,
  'claude-3-sonnet-20240229': 200000,
  'claude-3-haiku-20240307': 200000,
  
  // Ollama (varies by model, use conservative default)
  'llama3.2': 128000,
  'llama3.1': 128000,
  'codellama': 16000,
  'mistral': 32000,
};

/**
 * 获取模型的上下文窗口大小
 */
export function getContextWindowSize(model: string): number {
  // 精确匹配
  if (MODEL_CONTEXT_WINDOWS[model]) {
    return MODEL_CONTEXT_WINDOWS[model];
  }
  
  // 模糊匹配
  const lowerModel = model.toLowerCase();
  for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (lowerModel.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerModel)) {
      return value;
    }
  }
  
  // 默认返回 8k
  return 8192;
}

/**
 * 估算文本的 Token 数量
 * 使用简单的启发式方法：英文约 4 字符 = 1 token，中文约 2 字符 = 1 token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  
  // 分离中文字符和非中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const otherChars = text.length - chineseChars;
  
  // 中文约 2 字符 = 1 token，英文约 4 字符 = 1 token
  const estimatedTokens = Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
  
  return estimatedTokens;
}

/**
 * 估算消息的 Token 数量
 */
export function estimateMessagesTokens(messages: Array<{ role: string; content: string | null }>): number {
  let total = 0;
  
  for (const message of messages) {
    // 每条消息有约 4 tokens 的开销
    total += 4;
    
    if (message.content) {
      total += estimateTokens(message.content);
    }
  }
  
  // 对话有约 3 tokens 的开销
  total += 3;
  
  return total;
}

/**
 * 检查是否接近上下文窗口限制
 */
export function checkContextLimit(
  messages: Array<{ role: string; content: string | null }>,
  model: string,
  threshold: number = 0.8
): {
  currentTokens: number;
  maxTokens: number;
  percentage: number;
  isNearLimit: boolean;
} {
  const currentTokens = estimateMessagesTokens(messages);
  const maxTokens = getContextWindowSize(model);
  const percentage = currentTokens / maxTokens;
  
  return {
    currentTokens,
    maxTokens,
    percentage,
    isNearLimit: percentage >= threshold
  };
}

/**
 * 压缩消息历史以适应上下文窗口
 * 保留 system 消息和最近的对话
 */
export function compressMessages(
  messages: Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }>,
  model: string,
  targetPercentage: number = 0.6
): Array<{ role: string; content: string | null; tool_calls?: unknown[]; tool_call_id?: string }> {
  const maxTokens = getContextWindowSize(model);
  const targetTokens = Math.floor(maxTokens * targetPercentage);
  
  // 分离 system 消息和其他消息
  const systemMessages = messages.filter(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');
  
  // 计算当前 token 数
  let currentTokens = estimateMessagesTokens(messages);
  
  // 如果已经在目标范围内，不需要压缩
  if (currentTokens <= targetTokens) {
    return messages;
  }
  
  // 从最旧的消息开始删除（保留最近的）
  const compressedOther: typeof otherMessages = [];
  
  // 从后向前遍历，保留最新的消息
  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msg = otherMessages[i];
    const msgTokens = estimateMessagesTokens([msg as { role: string; content: string | null }]);
    
    const systemTokens = estimateMessagesTokens(systemMessages as { role: string; content: string | null }[]);
    const currentOtherTokens = estimateMessagesTokens(compressedOther as { role: string; content: string | null }[]);
    
    if (systemTokens + currentOtherTokens + msgTokens <= targetTokens) {
      compressedOther.unshift(msg);
    } else {
      break;
    }
  }
  
  // 添加摘要提示（如果删除了消息）
  if (compressedOther.length < otherMessages.length) {
    const removedCount = otherMessages.length - compressedOther.length;
    const summaryMessage = {
      role: 'system' as const,
      content: `[Earlier conversation history (${removedCount} messages) has been compressed to fit context window. Continue from where we left off.]`
    };
    
    return [...systemMessages, summaryMessage, ...compressedOther];
  }
  
  return [...systemMessages, ...compressedOther];
}

// 全局 Token 计数器实例
export const globalTokenCounter = new TokenCounter();
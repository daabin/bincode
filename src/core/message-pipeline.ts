/**
 * Message processing pipeline
 * Middleware-based architecture for processing messages before/after LLM interaction
 */

import type { ChatMessage, ToolCall } from '../types/core.js';
import type { ToolContext } from '../tools/index.js';

export interface MessageMiddleware {
  /** Called before sending messages to the LLM */
  beforeSend?: (messages: ChatMessage[]) => Promise<ChatMessage[]>;
  /** Called after receiving a response from the LLM */
  afterReceive?: (message: ChatMessage) => Promise<ChatMessage>;
  /** Called before executing a tool */
  beforeToolCall?: (toolCall: ToolCall, context: ToolContext) => Promise<ToolCall>;
  /** Called after executing a tool */
  afterToolCall?: (toolCall: ToolCall, result: string, context: ToolContext) => Promise<string>;
}

export class MessagePipeline {
  private middlewares: MessageMiddleware[] = [];

  use(middleware: MessageMiddleware): void {
    this.middlewares.push(middleware);
  }

  remove(middleware: MessageMiddleware): void {
    const index = this.middlewares.indexOf(middleware);
    if (index !== -1) {
      this.middlewares.splice(index, 1);
    }
  }

  async processBeforeSend(messages: ChatMessage[]): Promise<ChatMessage[]> {
    let result = messages;
    for (const middleware of this.middlewares) {
      if (middleware.beforeSend) {
        result = await middleware.beforeSend(result);
      }
    }
    return result;
  }

  async processAfterReceive(message: ChatMessage): Promise<ChatMessage> {
    let result = message;
    for (const middleware of this.middlewares) {
      if (middleware.afterReceive) {
        result = await middleware.afterReceive(result);
      }
    }
    return result;
  }

  async processBeforeToolCall(toolCall: ToolCall, context: ToolContext): Promise<ToolCall> {
    let result = toolCall;
    for (const middleware of this.middlewares) {
      if (middleware.beforeToolCall) {
        result = await middleware.beforeToolCall(result, context);
      }
    }
    return result;
  }

  async processAfterToolCall(toolCall: ToolCall, result: string, context: ToolContext): Promise<string> {
    let current = result;
    for (const middleware of this.middlewares) {
      if (middleware.afterToolCall) {
        current = await middleware.afterToolCall(toolCall, current, context);
      }
    }
    return current;
  }
}

/**
 * Built-in middleware: Token usage tracking
 */
export function createTokenTrackingMiddleware(): MessageMiddleware {
  return {
    afterReceive: async (message) => {
      // Token tracking is handled by the agent
      return message;
    }
  };
}

/**
 * Built-in middleware: Rate limiting
 */
export function createRateLimitMiddleware(maxRequestsPerMinute: number = 30): MessageMiddleware {
  const timestamps: number[] = [];

  return {
    beforeSend: async (messages) => {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;

      // Clean old timestamps
      while (timestamps.length > 0 && timestamps[0] < oneMinuteAgo) {
        timestamps.shift();
      }

      if (timestamps.length >= maxRequestsPerMinute) {
        const waitTime = timestamps[0] - oneMinuteAgo;
        await new Promise(resolve => setTimeout(resolve, waitTime + 100));
      }

      timestamps.push(now);
      return messages;
    }
  };
}

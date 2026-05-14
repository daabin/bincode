"use strict";
/**
 * Message processing pipeline
 * Middleware-based architecture for processing messages before/after LLM interaction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagePipeline = void 0;
exports.createTokenTrackingMiddleware = createTokenTrackingMiddleware;
exports.createRateLimitMiddleware = createRateLimitMiddleware;
class MessagePipeline {
    middlewares = [];
    use(middleware) {
        this.middlewares.push(middleware);
    }
    remove(middleware) {
        const index = this.middlewares.indexOf(middleware);
        if (index !== -1) {
            this.middlewares.splice(index, 1);
        }
    }
    async processBeforeSend(messages) {
        let result = messages;
        for (const middleware of this.middlewares) {
            if (middleware.beforeSend) {
                result = await middleware.beforeSend(result);
            }
        }
        return result;
    }
    async processAfterReceive(message) {
        let result = message;
        for (const middleware of this.middlewares) {
            if (middleware.afterReceive) {
                result = await middleware.afterReceive(result);
            }
        }
        return result;
    }
    async processBeforeToolCall(toolCall, context) {
        let result = toolCall;
        for (const middleware of this.middlewares) {
            if (middleware.beforeToolCall) {
                result = await middleware.beforeToolCall(result, context);
            }
        }
        return result;
    }
    async processAfterToolCall(toolCall, result, context) {
        let current = result;
        for (const middleware of this.middlewares) {
            if (middleware.afterToolCall) {
                current = await middleware.afterToolCall(toolCall, current, context);
            }
        }
        return current;
    }
}
exports.MessagePipeline = MessagePipeline;
/**
 * Built-in middleware: Token usage tracking
 */
function createTokenTrackingMiddleware() {
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
function createRateLimitMiddleware(maxRequestsPerMinute = 30) {
    const timestamps = [];
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

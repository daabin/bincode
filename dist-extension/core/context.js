"use strict";
/**
 * Agent context management
 * Manages conversation history, token tracking, and session state
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationManager = void 0;
exports.recordTokenUsage = recordTokenUsage;
const tokens_js_1 = require("../tokens.js");
class ConversationManager {
    messages = [];
    maxHistoryLength = 100;
    constructor(systemPrompt) {
        if (systemPrompt) {
            this.messages.push({ role: 'system', content: systemPrompt });
        }
    }
    addMessage(message) {
        this.messages.push(message);
        // Trim history if too long (keep system message)
        if (this.messages.length > this.maxHistoryLength) {
            const systemMsg = this.messages.find(m => m.role === 'system');
            const otherMessages = this.messages.filter(m => m.role !== 'system');
            const trimmed = otherMessages.slice(-(this.maxHistoryLength - 1));
            this.messages = systemMsg ? [systemMsg, ...trimmed] : trimmed;
        }
    }
    getMessages() {
        return this.messages;
    }
    getSystemPrompt() {
        return this.messages.find(m => m.role === 'system')?.content ?? undefined;
    }
    setSystemPrompt(prompt) {
        const systemIndex = this.messages.findIndex(m => m.role === 'system');
        if (systemIndex !== -1) {
            this.messages[systemIndex] = { role: 'system', content: prompt };
        }
        else {
            this.messages.unshift({ role: 'system', content: prompt });
        }
    }
    getEstimatedTokens() {
        return (0, tokens_js_1.estimateMessagesTokens)(this.messages);
    }
    clear() {
        const systemMsg = this.messages.find(m => m.role === 'system');
        this.messages = systemMsg ? [systemMsg] : [];
    }
    setMaxHistoryLength(length) {
        this.maxHistoryLength = length;
    }
    /**
     * Export conversation as markdown
     */
    toMarkdown() {
        return this.messages
            .filter(m => m.role !== 'system')
            .map(m => {
            const role = m.role === 'user' ? '👤 User' : m.role === 'assistant' ? '🤖 Assistant' : '🔧 Tool';
            const content = m.content || '';
            return `## ${role}\n\n${content}\n`;
        })
            .join('---\n');
    }
}
exports.ConversationManager = ConversationManager;
/**
 * Track token usage across the agent lifecycle
 */
function recordTokenUsage(provider, model, messages) {
    const tokens = (0, tokens_js_1.estimateMessagesTokens)(messages);
    tokens_js_1.globalTokenCounter.record(provider, model, {
        promptTokens: tokens,
        completionTokens: 0,
        totalTokens: tokens
    });
}

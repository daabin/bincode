/**
 * Agent context management
 * Manages conversation history, token tracking, and session state
 */

import type { ChatMessage } from '../types/core.js';
import type { AgentConfig } from '../types/agent.js';
import { globalTokenCounter, estimateMessagesTokens } from '../tokens.js';

export interface AgentContext {
  config: AgentConfig;
  messages: ChatMessage[];
  iteration: number;
  tokenCount: number;
}

export class ConversationManager {
  private messages: ChatMessage[] = [];
  private maxHistoryLength: number = 100;

  constructor(systemPrompt?: string) {
    if (systemPrompt) {
      this.messages.push({ role: 'system', content: systemPrompt });
    }
  }

  addMessage(message: ChatMessage): void {
    this.messages.push(message);

    // Trim history if too long (keep system message)
    if (this.messages.length > this.maxHistoryLength) {
      const systemMsg = this.messages.find(m => m.role === 'system');
      const otherMessages = this.messages.filter(m => m.role !== 'system');
      const trimmed = otherMessages.slice(-(this.maxHistoryLength - 1));
      this.messages = systemMsg ? [systemMsg, ...trimmed] : trimmed;
    }
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  getSystemPrompt(): string | undefined {
    return this.messages.find(m => m.role === 'system')?.content ?? undefined;
  }

  setSystemPrompt(prompt: string): void {
    const systemIndex = this.messages.findIndex(m => m.role === 'system');
    if (systemIndex !== -1) {
      this.messages[systemIndex] = { role: 'system', content: prompt };
    } else {
      this.messages.unshift({ role: 'system', content: prompt });
    }
  }

  getEstimatedTokens(): number {
    return estimateMessagesTokens(this.messages);
  }

  clear(): void {
    const systemMsg = this.messages.find(m => m.role === 'system');
    this.messages = systemMsg ? [systemMsg] : [];
  }

  setMaxHistoryLength(length: number): void {
    this.maxHistoryLength = length;
  }

  /**
   * Export conversation as markdown
   */
  toMarkdown(): string {
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

/**
 * Track token usage across the agent lifecycle
 */
export function recordTokenUsage(provider: string, model: string, messages: ChatMessage[]): void {
  const tokens = estimateMessagesTokens(messages);
  globalTokenCounter.record(provider, model, {
    promptTokens: tokens,
    completionTokens: 0,
    totalTokens: tokens
  });
}

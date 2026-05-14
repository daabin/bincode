/**
 * Agent - Core AI agent loop
 *
 * Orchestrates the conversation between LLM and tools:
 * 1. Send messages to LLM
 * 2. Parse response for tool calls
 * 3. Execute tools via ToolEngine
 * 4. Feed results back to LLM
 * 5. Repeat until no more tool calls
 */

import type { ChatMessage, ToolCall } from '../types/core.js';
import type { AgentConfig, AgentEvent } from '../types/agent.js';
import type { LLMProvider } from '../llm/types.js';
import { ToolEngine } from './tool-engine.js';
import { ConversationManager } from './context.js';
import { MessagePipeline } from './message-pipeline.js';
import type { ServiceContainer } from '../services/index.js';
import { globalTokenCounter, estimateMessagesTokens } from '../tokens.js';

const DEFAULT_SYSTEM_PROMPT = `You are a minimal CLI code agent inspired by Claude Code.
You help the user inspect and edit files in the current workspace.
Use tools whenever you need accurate file contents, search results, or to write changes.
Keep responses concise and mention changed files when you edit them.
Never attempt to access paths outside the workspace.`;

export interface AgentOptions {
  config: AgentConfig;
  provider: LLMProvider;
  services: ServiceContainer;
  systemPrompt?: string;
  pipeline?: MessagePipeline;
}

export class Agent {
  private readonly conversation: ConversationManager;
  private readonly toolEngine: ToolEngine;
  private readonly provider: LLMProvider;
  private readonly config: AgentConfig;
  private readonly pipeline: MessagePipeline;

  constructor(options: AgentOptions) {
    this.config = options.config;
    this.provider = options.provider;
    this.pipeline = options.pipeline ?? new MessagePipeline();

    this.conversation = new ConversationManager(options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT);
    this.toolEngine = new ToolEngine({
      cwd: options.config.cwd,
      services: options.services
    });
  }

  /**
   * Get the tool engine for registering additional tools
   */
  getToolEngine(): ToolEngine {
    return this.toolEngine;
  }

  /**
   * Get the conversation manager
   */
  getConversation(): ConversationManager {
    return this.conversation;
  }

  /**
   * Get the message pipeline for adding middleware
   */
  getPipeline(): MessagePipeline {
    return this.pipeline;
  }

  /**
   * Run the agent with user input
   * Yields events for UI rendering
   */
  async *run(userInput: string): AsyncGenerator<AgentEvent> {
    this.conversation.addMessage({ role: 'user', content: userInput });

    for (let iteration = 0; iteration < this.config.maxIterations; iteration++) {
      // Get messages and run through pipeline
      let messages = this.conversation.getMessages();
      messages = await this.pipeline.processBeforeSend(messages);

      // Get tool definitions from registry
      const tools = this.toolEngine.getToolDefinitions();

      // Stream response from LLM
      let accumulatedContent = '';
      let finalToolCalls: ToolCall[] | undefined;
      let finalReasoning: string | undefined;

      for await (const chunk of this.provider.createChatCompletionStream({
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
        model: this.config.model,
        messages,
        tools
      })) {
        if (chunk.content) {
          accumulatedContent += chunk.content;
          yield { type: 'assistant', content: chunk.content };
        }

        if (chunk.reasoning_content) {
          finalReasoning = (finalReasoning || '') + chunk.reasoning_content;
          yield { type: 'reasoning', content: chunk.reasoning_content };
        }

        if (chunk.done) {
          finalToolCalls = chunk.tool_calls;
        }
      }

      // Build assistant message
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: accumulatedContent || null,
        tool_calls: finalToolCalls,
        reasoning_content: finalReasoning
      };

      // Run through pipeline
      const processedMessage = await this.pipeline.processAfterReceive(assistantMessage);
      this.conversation.addMessage(processedMessage);

      // Record token usage
      const promptTokens = estimateMessagesTokens(messages);
      const completionTokens = estimateMessagesTokens([assistantMessage]);
      globalTokenCounter.record(
        this.config.provider || 'unknown',
        this.config.model,
        {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        }
      );

      // If no tool calls, we're done
      const toolCalls = finalToolCalls ?? [];
      if (toolCalls.length === 0) {
        yield { type: 'done' };
        return;
      }

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const name = toolCall.function.name;
        const args = this.parseToolArguments(toolCall.function.arguments);

        // Pipeline: before tool call
        const processedCall = await this.pipeline.processBeforeToolCall(toolCall, this.toolEngine.getContext());

        yield { type: 'tool_call', name, args };

        try {
          const result = await this.toolEngine.execute(name, args);

          // Pipeline: after tool call
          const processedResult = await this.pipeline.processAfterToolCall(processedCall, result, this.toolEngine.getContext());

          this.conversation.addMessage({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: processedResult
          });

          yield { type: 'tool_result', name, result: processedResult };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.conversation.addMessage({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `Tool failed: ${message}`
          });
          yield { type: 'error', message: `Tool ${name} failed: ${message}` };
        }
      }
    }

    yield {
      type: 'error',
      message: `Stopped after ${this.config.maxIterations} agent iterations. Try a narrower request.`
    };
  }

  private parseToolArguments(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw || '{}') as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through
    }
    throw new Error(`Invalid tool arguments: ${raw}`);
  }
}

import { DeepSeekProvider } from './llm/index.js';
import { runTool, toolDefinitions } from './tools.js';
import type { AgentConfig, AgentEvent, ChatMessage } from './types.js';
import { globalTokenCounter, estimateMessagesTokens } from './tokens.js';

const systemPrompt = `You are a minimal CLI code agent inspired by Claude Code.
You help the user inspect and edit files in the current workspace.
Use tools whenever you need accurate file contents, search results, or to write changes.
Keep responses concise and mention changed files when you edit them.
Never attempt to access paths outside the workspace.`;

export class Agent {
  private readonly messages: ChatMessage[];
  private readonly provider = new DeepSeekProvider();

  constructor(private readonly config: AgentConfig) {
    this.messages = [{ role: 'system', content: systemPrompt }];
  }

  async *run(userInput: string): AsyncGenerator<AgentEvent> {
    this.messages.push({ role: 'user', content: userInput });

    for (let iteration = 0; iteration < this.config.maxIterations; iteration += 1) {
      let accumulatedContent = '';
      let finalToolCalls: any[] | undefined;
      let finalReasoning: string | undefined;

      for await (const chunk of this.provider.createChatCompletionStream({
        apiKey: this.config.apiKey,
        baseUrl: this.config.baseUrl,
        model: this.config.model,
        messages: this.messages,
        tools: toolDefinitions
      })) {
        if (chunk.content) {
          accumulatedContent += chunk.content;
          yield { type: 'assistant', content: chunk.content };
        }

        if (chunk.done) {
          finalToolCalls = chunk.tool_calls;
          finalReasoning = chunk.reasoning_content;
        }
      }

      this.messages.push({
        role: 'assistant',
        content: accumulatedContent || null,
        tool_calls: finalToolCalls,
        reasoning_content: finalReasoning
      });

      const promptTokens = estimateMessagesTokens(this.messages.slice(0, -1));
      const completionTokens = estimateMessagesTokens([{
        role: 'assistant',
        content: accumulatedContent + (finalReasoning || '')
      }]);
      globalTokenCounter.record(
        'deepseek',
        this.config.model,
        {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        }
      );

      const toolCalls = finalToolCalls ?? [];
      if (toolCalls.length === 0) {
        return;
      }

      for (const toolCall of toolCalls) {
        const name = toolCall.function.name;
        const args = parseToolArguments(toolCall.function.arguments);
        yield { type: 'tool_call', name, args };

        try {
          const result = await runTool(this.config.cwd, name, args);
          this.messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result
          });
          yield { type: 'tool_result', name, result };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.messages.push({
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
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || '{}') as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to the explicit error below.
  }

  throw new Error(`Invalid tool arguments: ${raw}`);
}

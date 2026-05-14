/**
 * Agent Factory - Centralized agent creation
 *
 * Provides a convenient factory function for creating Agent instances
 * with DeepSeek provider and default configuration.
 */

import { Agent } from './agent.js';
import { DeepSeekProvider } from '../llm/index.js';
import { createServiceContainer } from '../services/index.js';
import { createDefaultToolRegistry } from '../tools/index.js';
import { getApiKey, getBaseUrl, getModel } from '../config/index.js';
import type { AgentConfig } from '../types/agent.js';

export interface CreateAgentOptions {
  cwd?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxIterations?: number;
  systemPrompt?: string;
}

/**
 * Create a new Agent instance with DeepSeek provider
 *
 * @param options - Agent configuration options
 * @returns Configured Agent instance
 *
 * @example
 * ```typescript
 * const agent = createAgent({ cwd: process.cwd() });
 * for await (const event of agent.run('Help me analyze this code')) {
 *   console.log(event);
 * }
 * ```
 */
export function createAgent(options: CreateAgentOptions = {}): Agent {
  const cwd = options.cwd ?? process.cwd();
  const provider = new DeepSeekProvider();
  const services = createServiceContainer(cwd);

  const config: AgentConfig = {
    cwd,
    apiKey: options.apiKey ?? getApiKey() ?? '',
    baseUrl: options.baseUrl ?? getBaseUrl(),
    model: options.model ?? getModel(),
    maxIterations: options.maxIterations ?? 30,
    provider: 'deepseek'
  };

  const agent = new Agent({
    config,
    provider,
    services,
    systemPrompt: options.systemPrompt
  });

  // Register default tools
  const toolRegistry = createDefaultToolRegistry();
  for (const tool of toolRegistry.getAll()) {
    agent.getToolEngine().registry.register(tool);
  }

  return agent;
}

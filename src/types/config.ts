/** Configuration types */

import type { ProviderType } from '../llm/types.js';

export interface Config {
  provider?: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  allowedCommands?: string[];
  deniedCommands?: string[];
}

export interface LLMConfig {
  provider: ProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
}

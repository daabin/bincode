/**
 * React hook for managing configuration in CLI
 */

import { useState, useCallback, useEffect } from 'react';
import { loadConfig, saveConfig, getApiKey, getProvider, getBaseUrl, getModel } from '../../config/index.js';
import type { Config } from '../../types/config.js';
import type { ProviderType } from '../../llm/types.js';

export interface ConfigState {
  config: Config;
  apiKey: string;
  provider: ProviderType;
  baseUrl: string;
  model: string;
  isLoaded: boolean;
}

export function useConfig() {
  const [state, setState] = useState<ConfigState>(() => ({
    config: loadConfig(),
    apiKey: getApiKey() || '',
    provider: getProvider(),
    baseUrl: getBaseUrl(),
    model: getModel(),
    isLoaded: true
  }));

  const updateConfig = useCallback((updates: Partial<Config>) => {
    const newConfig = { ...state.config, ...updates };
    saveConfig(newConfig);
    setState(prev => ({
      ...prev,
      config: newConfig,
      apiKey: getApiKey() || prev.apiKey,
      provider: getProvider(),
      baseUrl: getBaseUrl(),
      model: getModel()
    }));
  }, [state.config]);

  const setProvider = useCallback((provider: ProviderType) => {
    updateConfig({ provider });
  }, [updateConfig]);

  const setApiKey = useCallback((apiKey: string) => {
    updateConfig({ apiKey });
  }, [updateConfig]);

  const setBaseUrl = useCallback((baseUrl: string) => {
    updateConfig({ baseUrl });
  }, [updateConfig]);

  const setModel = useCallback((model: string) => {
    updateConfig({ model });
  }, [updateConfig]);

  return {
    ...state,
    updateConfig,
    setProvider,
    setApiKey,
    setBaseUrl,
    setModel
  };
}

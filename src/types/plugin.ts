/** Plugin system types */

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  entry: string;
  tools?: string[];
  hooks?: string[];
  author?: string;
  license?: string;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  module: Record<string, unknown>;
  path: string;
}

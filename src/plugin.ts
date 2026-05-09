import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ToolDefinition } from './types.js';

/**
 * 插件清单文件
 */
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  main: string;
  tools?: ToolDefinition[];
  permissions?: string[];
  author?: string;
  license?: string;
}

/**
 * 已加载的插件
 */
export interface LoadedPlugin {
  manifest: PluginManifest;
  path: string;
  tools: ToolDefinition[];
  toolHandlers?: Record<string, (args: Record<string, unknown>) => Promise<string>>;
}

/**
 * 插件目录
 */
function getPluginsDir(): string {
  return process.env.BINCODE_PLUGINS_DIR || path.join(os.homedir(), '.bincode', 'plugins');
}

/**
 * 确保插件目录存在
 */
export function ensurePluginsDir(): string {
  const dir = getPluginsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 验证插件清单
 */
export function validateManifest(manifest: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be an object'] };
  }

  const m = manifest as Record<string, unknown>;

  if (typeof m.name !== 'string' || m.name.length === 0) {
    errors.push('Plugin name is required');
  }

  if (typeof m.version !== 'string') {
    errors.push('Plugin version is required');
  }

  if (typeof m.main !== 'string') {
    errors.push('Plugin main entry point is required');
  }

  // 验证 name 格式
  if (typeof m.name === 'string' && !/^[a-z0-9_-]+$/i.test(m.name)) {
    errors.push('Plugin name must only contain alphanumeric characters, hyphens, and underscores');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 扫描插件目录
 */
export function scanPlugins(): PluginManifest[] {
  const pluginsDir = getPluginsDir();
  const manifests: PluginManifest[] = [];

  if (!fs.existsSync(pluginsDir)) {
    return manifests;
  }

  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(pluginsDir, entry.name, 'plugin.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const content = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(content) as PluginManifest;
      const validation = validateManifest(manifest);

      if (validation.valid) {
        manifests.push(manifest);
      } else {
        console.error(`Plugin ${entry.name} has invalid manifest: ${validation.errors.join(', ')}`);
      }
    } catch (error) {
      console.error(`Failed to load plugin ${entry.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return manifests;
}

/**
 * 加载插件
 */
export async function loadPlugin(pluginDir: string): Promise<LoadedPlugin | null> {
  const manifestPath = path.join(pluginDir, 'plugin.json');

  if (!fs.existsSync(manifestPath)) {
    console.error(`No plugin.json found in ${pluginDir}`);
    return null;
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(content) as PluginManifest;
    const validation = validateManifest(manifest);

    if (!validation.valid) {
      console.error(`Invalid plugin manifest: ${validation.errors.join(', ')}`);
      return null;
    }

    const mainPath = path.join(pluginDir, manifest.main);
    if (!fs.existsSync(mainPath)) {
      console.error(`Plugin main file not found: ${mainPath}`);
      return null;
    }

    // 动态加载插件模块
    const pluginModule = await import(mainPath);

    const tools: ToolDefinition[] = manifest.tools || [];
    
    // 如果插件导出了 tools，合并
    if (pluginModule.tools && Array.isArray(pluginModule.tools)) {
      tools.push(...pluginModule.tools);
    }

    return {
      manifest,
      path: pluginDir,
      tools,
      toolHandlers: pluginModule.toolHandlers || undefined
    };
  } catch (error) {
    console.error(`Failed to load plugin: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * 加载所有插件
 */
export async function loadAllPlugins(): Promise<LoadedPlugin[]> {
  const manifests = scanPlugins();
  const pluginsDir = getPluginsDir();
  const loaded: LoadedPlugin[] = [];

  for (const manifest of manifests) {
    const pluginDir = path.join(pluginsDir, manifest.name);
    const plugin = await loadPlugin(pluginDir);
    if (plugin) {
      loaded.push(plugin);
    }
  }

  return loaded;
}

/**
 * 合并所有插件的工具定义
 */
export function mergePluginTools(plugins: LoadedPlugin[]): ToolDefinition[] {
  return plugins.flatMap(p => p.tools);
}

/**
 * 创建示例插件
 */
export function createExamplePlugin(pluginName: string): string {
  const pluginsDir = ensurePluginsDir();
  const pluginDir = path.join(pluginsDir, pluginName);

  if (fs.existsSync(pluginDir)) {
    throw new Error(`Plugin "${pluginName}" already exists`);
  }

  fs.mkdirSync(pluginDir, { recursive: true });

  const manifest: PluginManifest = {
    name: pluginName,
    version: '1.0.0',
    description: `Example plugin: ${pluginName}`,
    main: 'index.js',
    tools: [],
    permissions: [],
    author: 'bincode',
    license: 'MIT'
  };

  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify(manifest, null, 2)
  );

  const exampleCode = `// ${pluginName} plugin for bincode
// This file exports optional tools and handlers

export const tools = [
  {
    type: 'function',
    function: {
      name: '${pluginName}_hello',
      description: 'Say hello from the ${pluginName} plugin',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name to greet' }
        },
        required: ['name']
      }
    }
  }
];

export const toolHandlers = {
  '${pluginName}_hello': async (args) => {
    return \`Hello, \${args.name}! From ${pluginName} plugin.\`;
  }
};
`;

  fs.writeFileSync(path.join(pluginDir, 'index.js'), exampleCode);

  return pluginDir;
}
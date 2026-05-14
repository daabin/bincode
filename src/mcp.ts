
import { spawn, type ChildProcess } from 'node:child_process';
import type { ToolDefinition } from './types/core.js';

/**
 * MCP Server 配置
 */
export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

/**
 * MCP 工具定义
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP 工具调用结果
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * MCP Client 类
 */
export class MCPClient {
  private processes: Map<string, ChildProcess> = new Map();
  private tools: Map<string, { server: string; tool: MCPToolDefinition }> = new Map();
  private buffers: Map<string, string> = new Map();
  private initialized: Set<string> = new Set();

  /**
   * 连接到 MCP Server
   */
  async connect(config: MCPServerConfig): Promise<MCPToolDefinition[]> {
    if (config.enabled === false) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(config.command, config.args || [], {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.processes.set(config.name, proc);
      this.buffers.set(config.name, '');

      let initialized = false;
      const serverTools: MCPToolDefinition[] = [];

      proc.stdout?.on('data', (data: Buffer) => {
        const str = data.toString();
        const buffer = (this.buffers.get(config.name) || '') + str;
        this.buffers.set(config.name, '');

        // 解析 JSON-RPC 消息（按行分割）
        const lines = buffer.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          try {
            const message = JSON.parse(line);

            if (!initialized && message.method === 'notifications/initialized') {
              initialized = true;
              this.initialized.add(config.name);
              // 请求工具列表
              this.sendMessage(config.name, {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/list'
              });
            }

            if (message.result?.tools) {
              for (const tool of message.result.tools) {
                const mcpTool: MCPToolDefinition = {
                  name: `${config.name}__${tool.name}`,
                  description: tool.description || `MCP tool: ${tool.name}`,
                  inputSchema: tool.inputSchema || { type: 'object', properties: {} }
                };
                serverTools.push(mcpTool);
                this.tools.set(mcpTool.name, { server: config.name, tool: mcpTool });
              }
              resolve(serverTools);
            }
          } catch {
            // 不是 JSON，忽略
          }
        }

        // 保留未完成的行
        if (lines[lines.length - 1]) {
          this.buffers.set(config.name, lines[lines.length - 1]);
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        // MCP servers may use stderr for logging
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to start MCP server "${config.name}": ${error.message}`));
      });

      // 发送初始化请求
      this.sendMessage(config.name, {
        jsonrpc: '2.0',
        id: 0,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'bincode', version: '0.2.0' }
        }
      });

      // 超时处理
      setTimeout(() => {
        if (!initialized) {
          resolve([]); // 超时返回空工具列表
        }
      }, 5000);
    });
  }

  /**
   * 发送 JSON-RPC 消息
   */
  private sendMessage(serverName: string, message: Record<string, unknown>): void {
    const proc = this.processes.get(serverName);
    if (proc?.stdin) {
      proc.stdin.write(JSON.stringify(message) + '\n');
    }
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const entry = this.tools.get(toolName);
    if (!entry) {
      throw new Error(`MCP tool not found: ${toolName}`);
    }

    const originalName = toolName.replace(`${entry.server}__`, '');

    return new Promise((resolve, reject) => {
      const proc = this.processes.get(entry.server);
      if (!proc?.stdin) {
        reject(new Error(`MCP server "${entry.server}" is not connected`));
        return;
      }

      // 设置一次性监听器获取响应
      const responseHandler = (data: Buffer) => {
        const str = data.toString();
        try {
          const message = JSON.parse(str);
          if (message.result) {
            proc.stdout?.off('data', responseHandler);
            resolve(message.result as MCPToolResult);
          } else if (message.error) {
            proc.stdout?.off('data', responseHandler);
            resolve({
              content: [{ type: 'text', text: `MCP Error: ${message.error.message}` }],
              isError: true
            });
          }
        } catch {
          // Ignore non-JSON
        }
      };

      proc.stdout?.on('data', responseHandler);

      this.sendMessage(entry.server, {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: originalName,
          arguments: args
        }
      });

      // 超时
      setTimeout(() => {
        proc.stdout?.off('data', responseHandler);
        resolve({
          content: [{ type: 'text', text: 'MCP tool call timed out' }],
          isError: true
        });
      }, 30000);
    });
  }

  /**
   * 将 MCP 工具转换为 Agent 工具定义
   */
  toToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(({ tool }) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required,
          additionalProperties: false
        }
      }
    }));
  }

  /**
   * 断开所有连接
   */
  disconnect(): void {
    for (const [name, proc] of this.processes) {
      proc.kill('SIGTERM');
      this.processes.delete(name);
    }
    this.tools.clear();
    this.initialized.clear();
    this.buffers.clear();
  }

  /**
   * 获取已连接的服务器列表
   */
  getConnectedServers(): string[] {
    return Array.from(this.initialized);
  }

  /**
   * 获取所有工具名称
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

/**
 * MCP 配置管理
 */
export function getMCPServers(): MCPServerConfig[] {
  try {
    const configPath = `${process.env.HOME}/.bincode/config.json`;
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.mcpServers || [];
    }
  } catch {
    // Ignore
  }
  return [];
}

import * as fs from 'node:fs';
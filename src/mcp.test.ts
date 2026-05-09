import { describe, it, expect } from 'vitest';
import { MCPClient, type MCPServerConfig } from './mcp.js';

describe('mcp', () => {
  describe('MCPClient', () => {
    it('should create a client instance', () => {
      const client = new MCPClient();
      expect(client.getConnectedServers()).toEqual([]);
      expect(client.getToolNames()).toEqual([]);
    });

    it('should return empty tool definitions when no servers connected', () => {
      const client = new MCPClient();
      expect(client.toToolDefinitions()).toEqual([]);
    });

    it('should handle disconnect gracefully', () => {
      const client = new MCPClient();
      expect(() => client.disconnect()).not.toThrow();
    });

    it('should handle connect timeout gracefully', async () => {
      const client = new MCPClient();
      const config: MCPServerConfig = {
        name: 'test-timeout',
        command: 'sleep',
        args: ['100'],
        enabled: true
      };

      // Should resolve with empty tools after timeout
      const tools = await client.connect(config);
      expect(tools).toEqual([]);
      client.disconnect();
    }, 10000);

    it('should skip disabled servers', async () => {
      const client = new MCPClient();
      const config: MCPServerConfig = {
        name: 'disabled-server',
        command: 'echo',
        enabled: false
      };

      const tools = await client.connect(config);
      expect(tools).toEqual([]);
    });
  });
});
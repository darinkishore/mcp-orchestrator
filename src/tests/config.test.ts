import { test, expect, describe } from 'bun:test';
import { readFileSync } from 'fs';
import type { McpOrchestratorConfig } from '../types/config.js';

describe('Configuration', () => {
  test('mcp-config.json is valid', () => {
    const config: McpOrchestratorConfig = JSON.parse(
      readFileSync('./mcp-config.json', 'utf8')
    );
    
    expect(config.port).toBe(3000);
    expect(Array.isArray(config.apiKeys)).toBe(true);
    expect(config.apiKeys.length).toBeGreaterThan(0);
    expect(Array.isArray(config.servers)).toBe(true);
    expect(config.servers.length).toBeGreaterThan(0);
  });

  test('servers have required fields', () => {
    const config: McpOrchestratorConfig = JSON.parse(
      readFileSync('./mcp-config.json', 'utf8')
    );
    
    config.servers.forEach(server => {
      expect(typeof server.name).toBe('string');
      expect(server.name.length).toBeGreaterThan(0);
      expect(typeof server.command).toBe('string');
      expect(server.command.length).toBeGreaterThan(0);
      
      if (server.args) {
        expect(Array.isArray(server.args)).toBe(true);
      }
      
      if (server.env) {
        expect(typeof server.env).toBe('object');
      }
    });
  });

  test('filesystem server configured correctly', () => {
    const config: McpOrchestratorConfig = JSON.parse(
      readFileSync('./mcp-config.json', 'utf8')
    );
    
    const filesystem = config.servers.find(s => s.name === 'filesystem');
    expect(filesystem).toBeDefined();
    expect(filesystem!.command).toContain('start-filesystem.sh');
  });

  test('sequential-thinking server configured correctly', () => {
    const config: McpOrchestratorConfig = JSON.parse(
      readFileSync('./mcp-config.json', 'utf8')
    );
    
    const sequential = config.servers.find(s => s.name === 'sequential-thinking');
    expect(sequential).toBeDefined();
    expect(sequential!.command).toBe('/usr/bin/npx');
    expect(sequential!.args).toContain('@modelcontextprotocol/server-sequential-thinking');
  });

  test('API keys are properly configured', () => {
    const config: McpOrchestratorConfig = JSON.parse(
      readFileSync('./mcp-config.json', 'utf8')
    );
    
    expect(config.apiKeys).toContain('sk-mcp-hetzner-f4a8b2c9d1e3');
    config.apiKeys.forEach(key => {
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(10);
    });
  });

  test('server names are unique', () => {
    const config: McpOrchestratorConfig = JSON.parse(
      readFileSync('./mcp-config.json', 'utf8')
    );
    
    const names = config.servers.map(s => s.name);
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });
});
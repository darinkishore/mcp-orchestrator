import { test, expect, describe } from 'bun:test';
import type { McpServerConfig, McpOrchestratorConfig, ServerInstance, HealthStatus } from '../types/config.js';

describe('TypeScript Types', () => {
  test('McpServerConfig type works correctly', () => {
    const serverConfig: McpServerConfig = {
      name: 'test-server',
      command: '/usr/bin/npx',
      args: ['-y', '@test/server'],
      env: { NODE_ENV: 'test' }
    };
    
    expect(serverConfig.name).toBe('test-server');
    expect(serverConfig.command).toBe('/usr/bin/npx');
    expect(serverConfig.args).toEqual(['-y', '@test/server']);
    expect(serverConfig.env).toEqual({ NODE_ENV: 'test' });
  });

  test('McpServerConfig with minimal fields', () => {
    const serverConfig: McpServerConfig = {
      name: 'minimal-server',
      command: './start.sh'
    };
    
    expect(serverConfig.name).toBe('minimal-server');
    expect(serverConfig.command).toBe('./start.sh');
    expect(serverConfig.args).toBeUndefined();
    expect(serverConfig.env).toBeUndefined();
  });

  test('McpOrchestratorConfig type works correctly', () => {
    const config: McpOrchestratorConfig = {
      port: 3000,
      apiKeys: ['test-key-1', 'test-key-2'],
      servers: [
        {
          name: 'server1',
          command: '/usr/bin/npx',
          args: ['-y', '@test/server1']
        },
        {
          name: 'server2',
          command: './start-server2.sh',
          env: { DEBUG: 'true' }
        }
      ]
    };
    
    expect(config.port).toBe(3000);
    expect(config.apiKeys).toHaveLength(2);
    expect(config.servers).toHaveLength(2);
    expect(config.servers[0].name).toBe('server1');
    expect(config.servers[1].name).toBe('server2');
  });

  test('HealthStatus type works correctly', () => {
    const status: HealthStatus = {
      'server1': {
        port: 4000,
        pid: 12345,
        alive: true
      },
      'server2': {
        port: 4001,
        pid: 12346,
        alive: false
      }
    };
    
    expect(status.server1.port).toBe(4000);
    expect(status.server1.pid).toBe(12345);
    expect(status.server1.alive).toBe(true);
    expect(status.server2.alive).toBe(false);
  });

  test('ServerInstance type allows any process type', () => {
    // Mock ChildProcess-like object
    const mockProcess = {
      pid: 12345,
      kill: () => {},
      on: () => {}
    };
    
    const instance: ServerInstance = {
      port: 4000,
      process: mockProcess
    };
    
    expect(instance.port).toBe(4000);
    expect(instance.process.pid).toBe(12345);
    expect(typeof instance.process.kill).toBe('function');
  });
});
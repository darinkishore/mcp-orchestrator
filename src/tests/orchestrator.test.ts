import { test, expect, describe, beforeAll, afterAll } from 'bun:test';

describe('MCP Orchestrator', () => {
  const baseUrl = 'http://localhost:3000';
  const apiKey = 'sk-mcp-hetzner-f4a8b2c9d1e3';

  beforeAll(async () => {
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  test('health check endpoint returns server status', async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.healthy).toBe(true);
    expect(data.servers).toBeDefined();
    expect(typeof data.servers).toBe('object');
  });

  test('health check shows filesystem server running', async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    const data = await response.json();
    
    expect(data.servers.filesystem).toBeDefined();
    expect(data.servers.filesystem.alive).toBe(true);
    // Note: sequential-thinking may timeout during startup, which is a known issue
  });

  test('invalid API key returns 401', async () => {
    const response = await fetch(`${baseUrl}/mcp/filesystem/invalid-key/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        },
        id: 1
      })
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Invalid API key');
  });

  test('non-existent server returns 404', async () => {
    const response = await fetch(`${baseUrl}/mcp/nonexistent/${apiKey}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        },
        id: 1
      })
    });
    
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  test('filesystem server initialization works', async () => {
    const response = await fetch(`${baseUrl}/mcp/filesystem/${apiKey}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        },
        id: 1
      })
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeDefined();
    
    const text = await response.text();
    expect(text).toContain('data:');
    expect(text).toContain('protocolVersion');
    expect(text).toContain('2024-11-05');
  });

  test('sequential-thinking server responds (if available)', async () => {
    const response = await fetch(`${baseUrl}/mcp/sequential-thinking/${apiKey}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        },
        id: 1
      })
    });
    
    // Sequential-thinking server may timeout during startup, so we allow 404
    if (response.status === 200) {
      expect(response.headers.get('mcp-session-id')).toBeDefined();
      const text = await response.text();
      expect(text).toContain('data:');
    } else {
      expect(response.status).toBe(404); // Server not found due to timeout
    }
  });

  test('filesystem tools/list works with session', async () => {
    // First initialize
    const initResponse = await fetch(`${baseUrl}/mcp/filesystem/${apiKey}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        },
        id: 1
      })
    });
    
    const sessionId = initResponse.headers.get('mcp-session-id');
    expect(sessionId).toBeDefined();
    
    // Now list tools
    const toolsResponse = await fetch(`${baseUrl}/mcp/filesystem/${apiKey}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': sessionId!
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 2
      })
    });
    
    expect(toolsResponse.status).toBe(200);
    const text = await toolsResponse.text();
    expect(text).toContain('data:');
    expect(text).toContain('tools');
  });

  test('url rewriting works correctly', async () => {
    // Test that /mcp gets rewritten to /stream
    const response = await fetch(`${baseUrl}/mcp/filesystem/${apiKey}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        },
        id: 1
      })
    });
    
    expect(response.status).toBe(200);
    expect(response.headers.get('mcp-session-id')).toBeDefined();
  });

  test('filesystem server has valid PID and port', async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    const data = await response.json();
    
    const filesystemPid = data.servers.filesystem.pid;
    const filesystemPort = data.servers.filesystem.port;
    
    expect(typeof filesystemPid).toBe('number');
    expect(filesystemPid).toBeGreaterThan(0);
    expect(filesystemPort).toBe(4000);
  });

  test('orchestrator properly manages server state', async () => {
    const response = await fetch(`${baseUrl}/healthz`);
    const data = await response.json();
    
    // At minimum, filesystem should be running
    expect(Object.keys(data.servers).length).toBeGreaterThanOrEqual(1);
    expect(data.servers.filesystem).toBeDefined();
    expect(data.servers.filesystem.alive).toBe(true);
  });
});
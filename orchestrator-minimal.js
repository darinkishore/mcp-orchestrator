const express = require('express');
const httpProxy = require('http-proxy');
const { spawn } = require('child_process');
const fs = require('fs');

// Load configuration
const config = JSON.parse(fs.readFileSync('mcp-config.json', 'utf8'));

// Create proxy
const proxy = httpProxy.createProxyServer({});

// Track servers
const servers = new Map();
const processes = new Map();

// Clean up any existing mcp-proxy processes
async function cleanupExistingProcesses() {
  console.log('Cleaning up existing mcp-proxy processes...');
  try {
    const { exec } = require('child_process');
    await new Promise((resolve) => {
      exec('pkill -f mcp-proxy', (error) => {
        // Ignore errors (no processes to kill)
        resolve();
      });
    });
    // Give processes time to shut down
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (err) {
    console.log('Cleanup completed');
  }
}

// Spawn MCP servers using mcp-proxy CLI
async function startServers() {
  await cleanupExistingProcesses();
  
  for (let idx = 0; idx < config.servers.length; idx++) {
    const server = config.servers[idx];
    const port = 4000 + idx;
    
    console.log(`Starting ${server.name} on port ${port}...`);
    
    // Resolve npx commands to actual executables
    let command = server.command;
    let args = server.args || [];
    
    // Keep original npx command structure
    
    // Use mcp-proxy CLI to start the server
    const spawnArgs = [
      '--port', port.toString(),
      '--debug',
      command,
      ...args
    ];
    
    const proc = spawn('./node_modules/.bin/mcp-proxy', spawnArgs, {
      env: { ...process.env, ...server.env },
      stdio: 'inherit'
    });
    
    proc.on('error', (err) => {
      console.error(`Failed to start ${server.name}:`, err);
    });
    
    proc.on('exit', (code) => {
      console.log(`${server.name} exited with code ${code}`);
      // Clean up from maps when process exits
      servers.delete(server.name);
      processes.delete(proc.pid);
    });
    
    servers.set(server.name, { port, process: proc });
    processes.set(proc.pid, server.name);
    console.log(`Added ${server.name} to servers map (PID: ${proc.pid}, Port: ${port})`);
    
    // Give it time to start
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Create express app
const app = express();

// Health check (no auth)
app.get('/healthz', (req, res) => {
  const status = {};
  console.log(`Health check: Found ${servers.size} servers in memory`);
  
  servers.forEach((server, name) => {
    console.log(`Checking server ${name} with PID ${server.process.pid}`);
    // Check if process is actually running
    let isAlive = false;
    try {
      // process.kill(pid, 0) throws if process doesn't exist
      process.kill(server.process.pid, 0);
      isAlive = true;
      console.log(`Server ${name} is alive`);
    } catch (err) {
      // Process doesn't exist, clean up stale entry
      console.log(`Cleaning up stale server entry: ${name} (PID ${server.process.pid})`);
      servers.delete(name);
      processes.delete(server.process.pid);
      return; // Skip adding to status
    }
    
    status[name] = {
      port: server.port,
      pid: server.process.pid,
      alive: isAlive
    };
  });
  
  console.log(`Health check returning ${Object.keys(status).length} servers`);
  res.json({ healthy: true, servers: status });
});

// Proxy requests to the appropriate server
// Format: /mcp/:serverName/:apiKey/*
app.use('/mcp/:serverName/:apiKey', (req, res) => {
  const { serverName, apiKey } = req.params;
  const endpoint = req.path; // Get the remaining path
  
  console.log(`Request to ${serverName}, path: ${req.path}, url: ${req.url}`);
  
  // Validate API key
  if (!config.apiKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  console.log(`Available servers in map: ${Array.from(servers.keys()).join(', ')}`);
  console.log(`Looking for server: ${serverName}`);
  
  const server = servers.get(serverName);
  
  if (!server) {
    console.log(`Server '${serverName}' not found in map`);
    return res.status(404).json({ error: `Server '${serverName}' not found` });
  }
  
  console.log(`Found server ${serverName} with PID ${server.process.pid}`);;
  
  // Rewrite /mcp endpoint to /stream for mcp-proxy compatibility
  // After middleware, remaining path starts with /
  if (req.path === '/mcp' || req.path === '/') {
    req.url = '/stream';
    console.log(`Rewrote URL from ${req.path} to /stream`);
  } else if (req.path.endsWith('/mcp')) {
    req.url = req.path.replace('/mcp', '/stream');
    console.log(`Rewrote URL from ${req.path} to ${req.url}`);
  }
  
  console.log(`Forwarding ${serverName} request to port ${server.port}`);
  
  // Forward to the mcp-proxy instance
  proxy.web(req, res, {
    target: `http://localhost:${server.port}`,
    changeOrigin: true
  }, (err) => {
    console.error(`Proxy error for ${serverName}:`, err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Bad gateway' });
    }
  });
});

// Start everything
async function start() {
  await startServers();
  
  const port = config.port || 3000;
  const server = app.listen(port, () => {
    console.log(`\nMCP Orchestrator ready on port ${port}`);
    console.log(`Managing ${servers.size} MCP servers`);
    console.log(`URL format: /mcp/{server-name}/{api-key}/{endpoint}`);
    console.log('\nExample URLs:');
    servers.forEach((server, name) => {
      console.log(`  - http://localhost:${port}/mcp/${name}/${config.apiKeys[0]}/sse (legacy)`);
      console.log(`  - http://localhost:${port}/mcp/${name}/${config.apiKeys[0]}/mcp (modern)`);
    });
  });
  
  // Handle WebSocket upgrades
  server.on('upgrade', (req, socket, head) => {
    // Parse URL to get server name and API key
    const urlParts = req.url.split('/');
    if (urlParts[1] === 'mcp' && urlParts.length >= 4) {
      const serverName = urlParts[2];
      const apiKey = urlParts[3];
      
      // Validate API key
      if (!config.apiKeys.includes(apiKey)) {
        socket.destroy();
        return;
      }
      
      const server = servers.get(serverName);
      
      if (server) {
        // Rewrite URL to remove the /mcp/serverName/apiKey prefix
        req.url = '/' + urlParts.slice(4).join('/');
        proxy.ws(req, socket, head, {
          target: `http://localhost:${server.port}`
        });
      } else {
        socket.destroy();
      }
    } else {
      socket.destroy();
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  console.log('\nShutting down...');
  
  servers.forEach((server, name) => {
    console.log(`Stopping ${name}...`);
    server.process.kill();
  });
  
  setTimeout(() => process.exit(0), 1000);
}

// Start
start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
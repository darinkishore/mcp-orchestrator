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

// Spawn MCP servers using mcp-proxy CLI
async function startServers() {
  for (let idx = 0; idx < config.servers.length; idx++) {
    const server = config.servers[idx];
    const port = 4000 + idx;
    
    console.log(`Starting ${server.name} on port ${port}...`);
    
    // Resolve npx commands to actual executables
    let command = server.command;
    let args = server.args || [];
    
    if (command === 'npx' && args.length > 0) {
      // For npx commands, try to resolve to the actual package
      const packageName = args.find(arg => arg.startsWith('@') || (!arg.startsWith('-') && arg !== 'npx'));
      if (packageName === '@modelcontextprotocol/server-filesystem') {
        command = 'mcp-server-filesystem';
        args = args.filter(arg => !arg.startsWith('-') && arg !== packageName);
      }
    }
    
    // Use mcp-proxy CLI to start the server
    const spawnArgs = [
      'mcp-proxy',
      '--port', port.toString(),
      command,
      ...args
    ];
    
    const proc = spawn('npx', spawnArgs, {
      env: { ...process.env, ...server.env },
      stdio: 'inherit'
    });
    
    proc.on('error', (err) => {
      console.error(`Failed to start ${server.name}:`, err);
    });
    
    proc.on('exit', (code) => {
      console.log(`${server.name} exited with code ${code}`);
    });
    
    servers.set(server.name, { port, process: proc });
    processes.set(proc.pid, server.name);
    
    // Give it time to start
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Create express app
const app = express();

// Health check (no auth)
app.get('/healthz', (req, res) => {
  const status = {};
  servers.forEach((server, name) => {
    status[name] = {
      port: server.port,
      pid: server.process.pid,
      alive: !server.process.killed
    };
  });
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
  
  const server = servers.get(serverName);
  
  if (!server) {
    return res.status(404).json({ error: `Server '${serverName}' not found` });
  }
  
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
      console.log(`  - http://localhost:${port}/mcp/${name}/${config.apiKeys[0]}/sse`);
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
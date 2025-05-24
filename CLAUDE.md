# CLAUDE.md - MCP Orchestrator

## Overview
This is an MCP (Model Context Protocol) orchestrator that exposes stdio-based MCP servers over HTTP with API key authentication. It's deployed on a Hetzner box and managed with PM2.

## Current Setup
- **Main script**: `dist/orchestrator.js` (built from TypeScript)
- **Port**: 3000
- **API Key**: `sk-mcp-hetzner-f4a8b2c9d1e3` (configured in mcp-config.json)
- **Process manager**: PM2 (auto-starts on boot)
- **Runtime**: Node.js with Bun package manager

## Architecture
The orchestrator uses the `mcp-proxy` npm package to spawn MCP servers and expose them via HTTP:
- Each MCP server is spawned using `npx mcp-proxy --port <port> <command>`
- The orchestrator routes requests based on the URL path: `/mcp/{server-name}/{api-key}/{endpoint}`
- Supports both SSE (Server-Sent Events) and Streamable HTTP transports

## Key Files
- `src/orchestrator.ts` - Main TypeScript orchestrator source
- `dist/orchestrator.js` - Compiled JavaScript (built from TypeScript)
- `mcp-config.json` - Configuration (servers, API keys, port)
- `ecosystem.config.cjs` - PM2 configuration
- `src/scripts/start-filesystem.sh` - Wrapper script for filesystem server
- `src/tests/` - Comprehensive test suite (Bun test runner)
- `MCP_USAGE_GUIDE.md` - Comprehensive usage documentation
- `MCP_PROXY_INTERNALS.md` - Deep dive into mcp-proxy behavior and common pitfalls

## Available Endpoints
- `GET /healthz` - Health check (no auth required)
- `/mcp/{server-name}/{api-key}/sse` - Server-Sent Events transport
- `/mcp/{server-name}/{api-key}/stream` - Streamable HTTP transport

## How to Use

### Quick Test
```bash
# Health check
curl http://localhost:3000/healthz

# Run the test suite
bun test

# Manual integration test
curl -s http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

### Stream Endpoint (Recommended)
```bash
# 1. Initialize session
RESPONSE=$(curl -s -i -X POST http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}')

# 2. Extract session ID
SESSION_ID=$(echo "$RESPONSE" | grep -i "mcp-session-id:" | cut -d' ' -f2 | tr -d '\r')

# 3. Use session for requests
curl -s -X POST http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}' | grep "^data:" | cut -d' ' -f2-
```

## Management Commands
- `npm run build` - Build TypeScript to JavaScript
- `npm run test` - Run test suite with Bun
- `pm2 status` - Check status
- `pm2 logs` - View logs  
- `pm2 restart mcp-orchestrator` - Restart
- `pm2 stop mcp-orchestrator` - Stop
- `pm2 start ecosystem.config.cjs` - Start

## Adding New MCP Servers
1. Edit `mcp-config.json`
2. **PREFERRED**: Use absolute paths for simple servers:
   ```json
   {
     "name": "server-name",
     "command": "/usr/bin/npx",
     "args": ["-y", "@org/mcp-server", "--arg1", "value1"],
     "env": {}
   }
   ```
3. **FALLBACK**: Create wrapper script for complex servers:
   ```bash
   #!/bin/bash
   export PATH="/usr/bin:/bin:/usr/local/bin:$PATH"
   exec /usr/bin/npx -y @org/mcp-server --arg1 value1
   ```
4. Make executable: `chmod +x wrapper-script.sh`
5. Restart orchestrator: `pm2 restart mcp-orchestrator`

## Protocol Requirements
- **Accept Headers**: Must include `application/json, text/event-stream`
- **Session Management**: Stream endpoint requires initialization and session ID
- **Response Format**: Event stream format with `data:` prefix containing JSON
- **Two Endpoints**: `/stream` (stateful sessions) and `/sse` (Server-Sent Events)

## Important Notes
- Each MCP server gets its own port starting from 4000
- The orchestrator spawns child processes using mcp-proxy CLI
- Authentication via URL path: `/mcp/{server-name}/{api-key}/{endpoint}`
- Use wrapper scripts for complex commands (mcp-proxy uses `shell: false`)
- Logs are in `/root/projects/mcp_orchestrator/mcp-orchestrator/logs/`
- See `MCP_USAGE_GUIDE.md` for detailed examples and troubleshooting

## Debugging & Troubleshooting (Claude Notes)

### Express Route Pattern Issues
**CRITICAL**: The Express route pattern is sensitive. Use exactly this pattern:
```javascript
app.use('/mcp/:serverName/:apiKey', (req, res) => {
```

**DO NOT USE**:
- `app.all('/mcp/:serverName/:apiKey/*', ...)` - Causes path-to-regexp errors
- `app.all('/mcp/:serverName/:apiKey*', ...)` - Missing parameter name errors

### Server Startup Debugging
When servers aren't responding:

1. **Check processes are running**:
   ```bash
   ps aux | grep mcp-proxy
   ```

2. **Check health endpoint**:
   ```bash
   curl -s http://localhost:3000/healthz | jq .
   ```

3. **Check PM2 logs**:
   ```bash
   pm2 logs --lines 20 --nostream
   ```

4. **Test orchestrator directly** (to see startup logs):
   ```bash
   pm2 stop mcp-orchestrator
   timeout 15s node orchestrator-minimal.js
   ```

### Common Issues & Solutions

#### Health Check Shows Fewer Servers Than Expected
- **Symptom**: `ps aux | grep mcp-proxy` shows servers running but `/healthz` doesn't list them
- **Cause**: Server process crashed after startup or health check logic issue
- **Debug**: Check if process PIDs in health check match running processes

#### Command Resolution Workaround (AVOID)
- **DON'T** add command resolution logic that converts `@modelcontextprotocol/server-*` to `mcp-server-*`
- The original `npx` commands work correctly with mcp-proxy
- Command resolution was added as a debugging attempt but is unnecessary

#### Server Startup Timing
- Allow 5-10 seconds for servers to fully start after orchestrator startup
- Test direct server connection: `curl http://localhost:4001/stream` 
- If connection refused, server hasn't started yet or crashed

#### MCP Protocol Version
- Always use latest spec version: `"protocolVersion":"2024-11-05"`
- Ensure `Accept` headers include: `application/json, text/event-stream`

### Available Servers  
**🎉 100% WORKING MULTI-SERVER IMPLEMENTATION**

Current configuration includes:
- **filesystem** (port 4000): File operations in /tmp directory ✅ FULLY WORKING
- **sequential-thinking** (port 4001): Step-by-step reasoning server ✅ FULLY WORKING

Both servers verified working end-to-end with latest MCP spec (2024-11-05).

### Command Execution: Absolute Paths Required

**MANDATORY**: mcp-proxy uses `shell: false` in `spawn()`, requiring absolute paths:

✅ **Simple Servers**: Direct absolute npx paths work perfectly:
```json
{
  "name": "sequential-thinking",
  "command": "/usr/bin/npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
}
```

⚠️ **Complex Servers**: Some servers require wrapper scripts for environment setup:
```json
{
  "name": "filesystem", 
  "command": "./start-filesystem.sh",
  "args": []
}
```

**Technical Requirements**:
- **ALWAYS use absolute paths**: `/usr/bin/npx`, `/usr/bin/node`, etc.
- mcp-proxy spawns with `shell: false` (confirmed in `StdioClientTransport.ts:81`)
- No shell PATH resolution or environment variable expansion
- Simple servers (no args): Use direct absolute npx
- Complex servers (args/env): Use wrapper scripts with absolute paths

**Best Practice**: Start with absolute npx paths, fall back to wrapper scripts if needed.

### Debugging Commands
```bash
# Full restart and status check
pm2 restart mcp-orchestrator && sleep 5 && curl -s http://localhost:3000/healthz | jq .

# Check all MCP processes
ps aux | grep mcp-proxy | grep -v grep

# Test specific server directly
curl -X POST http://localhost:4000/stream -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

## Critical Debugging Lessons Learned

### 🚨 State Management Issues

**CRITICAL**: Always check for lingering root processes when experiencing stale PIDs:
```bash
ps aux | grep -E "(mcp|orchestrator)" | grep -v grep
# Look for root-owned processes that may persist across restarts
```

**Root Process Cleanup**: If stale PIDs persist despite Map clearing, kill any root processes:
```bash
# These can maintain old state in memory even after PM2 restarts
sudo pkill -f orchestrator  # May require root access
```

### 🔧 mcp-proxy Execution Patterns

**WRONG**: Nested npx calls cause connection failures:
```javascript
spawn('npx', ['mcp-proxy', '--port', '4000', 'npx', '-y', '@server/package'])
// Creates: npx → mcp-proxy → npx → server (FAILS)
```

**RIGHT**: Use wrapper scripts with proper PATH:
```bash
# start-server.sh
export PATH="/usr/bin:/bin:/usr/local/bin:$PATH"
exec /usr/bin/npx -y @server/package
```

```javascript
spawn('./node_modules/.bin/mcp-proxy', ['--port', '4000', './start-server.sh'])
// Creates: mcp-proxy → wrapper → server (WORKS)
```

### 📊 PM2 vs Manual Execution

**Key Difference**: PM2 has different timing than manual execution:
- **Manual**: Servers available immediately after "Ready" message
- **PM2**: Need 15-20 second delay for full startup
- **Health checks**: May show empty if called too early under PM2

**Solution**: Add startup delays when testing PM2 deployments:
```bash
pm2 start ecosystem.config.js
sleep 20  # Critical for PM2 startup
curl http://localhost:3000/healthz
```

### 🗺️ Map State Debugging

**Debug Map Contents**: Add comprehensive logging:
```javascript
console.log(`Current servers in map: ${Array.from(servers.keys()).map(k => `${k}(${servers.get(k).process.pid})`).join(', ')}`);
```

**Map Cleanup**: Always clear Maps during process cleanup:
```javascript
async function cleanupExistingProcesses() {
  // Kill processes
  exec('pkill -f mcp-proxy');
  // CRITICAL: Clear Maps to remove stale entries
  servers.clear();
  processes.clear();
}
```

### 🧪 Testing Strategies

**Create Debug Test Scripts**: Manual background execution with `&` doesn't work reliably:
```bash
# test-debug.sh - Proper testing approach
timeout 30s node orchestrator-minimal.js &
ORCH_PID=$!
sleep 15  # Wait for startup
# Run tests
kill $ORCH_PID  # Clean shutdown
```

**Subagent Investigation**: When mcp-proxy behaves unexpectedly:
- Use Task tool to explore node_modules/mcp-proxy source
- Check spawn arguments and shell execution patterns
- Verify command resolution and PATH issues

### 🔍 Express Route Debugging

**Route Pattern Sensitivity**: Use exactly this pattern:
```javascript
app.use('/mcp/:serverName/:apiKey', (req, res) => {
// NOT: app.all('/mcp/:serverName/:apiKey/*') - Causes path-to-regexp errors
```

**Debug Route Handlers**: Add comprehensive logging:
```javascript
console.log(`Available servers in map: ${Array.from(servers.keys()).join(', ')}`);
console.log(`Looking for server: ${serverName}`);
```

### 🎯 Multi-Server Success Patterns

**Verified Working Architecture**:
- ✅ Both servers start successfully with wrapper scripts
- ✅ Map state management with proper cleanup
- ✅ Health checks show current PIDs (not stale)
- ✅ Route handlers find servers in Map
- ✅ End-to-end MCP protocol working for both servers

**Final Test Commands**:
```bash
# Complete verification
curl -s http://localhost:3000/healthz | jq .
./test-working.sh  # Filesystem end-to-end
curl -s http://localhost:3000/mcp/sequential-thinking/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
```

### 🔬 Investigation Methodology

**When facing stale state issues**:
1. **Check all running processes** (including root-owned)
2. **Verify Map contents** with debug logging  
3. **Test manual vs PM2 execution** separately
4. **Use subagents** to investigate unfamiliar package behavior
5. **Create isolated test scripts** for reliable debugging
6. **Clean state comprehensively** (processes + Maps + temp files)

**Never assume package behavior** - investigate with subagents when things don't work as expected. 
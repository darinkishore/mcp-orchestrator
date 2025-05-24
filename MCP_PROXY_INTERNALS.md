# mcp-proxy Internals and Common Pitfalls

## Overview

`mcp-proxy` is a Node.js package that converts stdio-based MCP servers to HTTP endpoints. Understanding its internals is crucial for proper integration.

## Critical Architecture Details

### 1. Process Spawning with `shell: false`

**CRITICAL**: mcp-proxy spawns processes with `shell: false`, meaning:

```javascript
// From StdioClientTransport in mcp-proxy source
this.process = spawn(
  this.serverParams.command,
  this.serverParams.args ?? [],
  {
    cwd: this.serverParams.cwd,
    env: this.serverParams.env,
    shell: false,  // ← NO SHELL INTERPRETATION!
    signal: this.abortController.signal,
    stdio: ['pipe', 'pipe', this.serverParams.stderr ?? 'inherit']
  }
);
```

**Implications**:
- No environment variable expansion (`$HOME`, `$PATH`)
- No command substitution (`$(which python)`)
- No shell operators (`&&`, `||`, `|`)
- Must use absolute paths or rely on PATH
- Commands like `npx -y @pkg/server arg1 arg2` must be split properly

**Solution**: Use absolute paths (`/usr/bin/npx`) or wrapper scripts with absolute paths.

### 2. HTTP Server Endpoints

mcp-proxy creates an HTTP server with these exact endpoints:

```javascript
// From startHTTPServer in chunk-J47PRS2B.js
if (req.method === "GET" && req.url === `/ping`) {
  res.writeHead(200).end("pong");
  return;
}

if (await handleSSERequest({
  endpoint: "/sse",
  // ...
})) {
  return;
}

if (await handleStreamRequest({
  endpoint: "/stream", 
  // ...
})) {
  return;
}

// Everything else returns 404
res.writeHead(404).end();
```

**Available Endpoints**:
- `GET /ping` - Health check, returns "pong"
- `/sse` - Server-Sent Events endpoint
- `/stream` - Streamable HTTP endpoint
- All other paths return 404

### 3. SSE Endpoint Behavior

The SSE endpoint requires a two-step process:

```javascript
// Step 1: GET /sse establishes connection
curl http://localhost:4000/sse -H "Accept: text/event-stream"
// Returns:
// event: endpoint
// data: /messages?sessionId=SESSION_ID

// Step 2: POST /messages?sessionId=SESSION_ID sends messages
curl -X POST "http://localhost:4000/messages?sessionId=SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### 4. Stream Endpoint Behavior

The stream endpoint requires specific Accept headers:

```javascript
// From source: Client must accept both content types
if (!acceptsJSON || !acceptsSSE) {
  return this.sendError(res, -32000, 
    "Not Acceptable: Client must accept both application/json and text/event-stream");
}
```

**Required Headers**:
```bash
-H "Accept: application/json, text/event-stream"
```

## Common Mistakes and Solutions

### Mistake 1: Using Complex Commands Directly

❌ **Wrong**:
```json
{
  "command": "npx -y @modelcontextprotocol/server-filesystem /tmp"
}
```

✅ **Correct**:
```json
{
  "command": "./start-filesystem.sh",
  "args": []
}
```

```bash
#!/bin/bash
# start-filesystem.sh
exec npx -y @modelcontextprotocol/server-filesystem /tmp
```

### Mistake 2: Missing Accept Headers

❌ **Wrong**:
```bash
curl -X POST http://localhost:4000/stream \
  -H "Content-Type: application/json"
```

✅ **Correct**:
```bash
curl -X POST http://localhost:4000/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream"
```

### Mistake 3: Ignoring Session Management

❌ **Wrong**:
```bash
# Trying to call tools without initialization
curl -X POST http://localhost:4000/stream \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

✅ **Correct**:
```bash
# 1. Initialize first
RESPONSE=$(curl -s -i -X POST http://localhost:4000/stream \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize",...}')

# 2. Extract session ID
SESSION_ID=$(echo "$RESPONSE" | grep "mcp-session-id:" | cut -d' ' -f2)

# 3. Use session ID
curl -X POST http://localhost:4000/stream \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Mistake 4: Wrong Response Processing

❌ **Wrong**:
```bash
# Expecting plain JSON
curl ... | jq .
```

✅ **Correct**:
```bash
# Extract from event stream format
curl ... | grep "^data:" | cut -d' ' -f2- | jq .
```

## Error Codes and Meanings

### MCP Protocol Errors

- **-32000**: Generic MCP error
  - "Connection closed" - Child process died
  - "Not Acceptable" - Missing required headers
- **-32001**: Request timed out (60 second default)
- **-32603**: Internal error (often validation failures)

### Common Error Messages

1. **"could not start the proxy"** + "Connection closed"
   - Child process crashed immediately
   - Check command syntax and permissions
   - Verify server executable works standalone

2. **"Not Acceptable: Client must accept both application/json and text/event-stream"**
   - Missing Accept headers
   - Add both content types to Accept header

3. **"No active transport"**
   - Session expired or invalid
   - Reinitialize session

## Debugging Commands

### Test mcp-proxy directly
```bash
# Start mcp-proxy manually
npx mcp-proxy --port 5000 ./your-server.sh

# Test ping
curl http://localhost:5000/ping

# Test initialization
curl -X POST http://localhost:5000/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}' \
  -i
```

### Test stdio server directly
```bash
# Test the underlying server
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}' | ./your-server.sh
```

### Check process spawning
```bash
# Monitor processes
ps aux | grep mcp-proxy
ps aux | grep your-server

# Check ports
ss -tlnp | grep 4000
```

## Best Practices

1. **Use Wrapper Scripts**: Always wrap complex commands in shell scripts
2. **Test Standalone First**: Verify stdio servers work before using mcp-proxy
3. **Check Accept Headers**: Always include both required content types
4. **Manage Sessions**: Initialize, extract session ID, use consistently
5. **Handle Event Streams**: Process `data:` lines to extract JSON
6. **Error Handling**: Check for MCP error codes and handle appropriately

## Source Code References

Key files in `/node_modules/mcp-proxy/dist/`:
- `bin/mcp-proxy.js` - CLI entry point and argument parsing
- `chunk-J47PRS2B.js` - Core HTTP server and transport logic

Key functions:
- `startHTTPServer()` - Creates HTTP server with endpoints
- `handleSSERequest()` - Manages SSE connections
- `handleStreamRequest()` - Manages stream sessions
- `StdioClientTransport` - Spawns and communicates with child processes

## Configuration Examples

### Simple Server
```json
{
  "name": "simple",
  "command": "/usr/bin/python3",
  "args": ["/path/to/server.py"],
  "env": {}
}
```

### Complex Server with Wrapper
```json
{
  "name": "complex",
  "command": "./start-complex.sh", 
  "args": [],
  "env": {"CUSTOM_VAR": "value"}
}
```

```bash
#!/bin/bash
# start-complex.sh
cd /path/to/server
source venv/bin/activate
exec python server.py --config config.json
```

This documentation should prevent the common pitfalls we encountered and provide clear guidance for future MCP server integrations!
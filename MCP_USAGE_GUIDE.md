# MCP Orchestrator Usage Guide

## Overview

The MCP Orchestrator exposes stdio-based MCP servers over HTTP with API key authentication. It uses URL-based routing and spawns `mcp-proxy` processes for each configured server.

**CRITICAL**: All commands must use **absolute paths**. Uses custom mcp-proxy fork with `--shell` support.

## URL Formats

### New Format (Recommended)
```
http://localhost:3000/{server-name}/{api-key}/mcp
```

### Legacy Format  
```
http://localhost:3000/mcp/{server-name}/{api-key}/{endpoint}
```

Where:
- `{server-name}`: Name from mcp-config.json
- `{api-key}`: Valid API key from configuration
- `{endpoint}`: Either `stream` or `sse` (legacy format only)

## Endpoints

### 1. Stream Endpoint (Recommended)

The `/stream` endpoint provides stateful sessions with JSON responses.

#### Initialize Session

```bash
# New format (recommended)
curl -X POST http://localhost:3000/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "my-client", "version": "1.0"}
    },
    "id": 1
  }'

# Legacy format
curl -X POST http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "my-client", "version": "1.0"}
    },
    "id": 1
  }'
```

Response includes session ID in `mcp-session-id` header.

#### Use Session

```bash
# New format (recommended)
curl -X POST http://localhost:3000/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: {session-id}" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 2
  }'

# Legacy format
curl -X POST http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: {session-id}" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 2
  }'
```

#### Terminate Session

```bash
# New format (recommended)
curl -X DELETE http://localhost:3000/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/mcp \
  -H "mcp-session-id: {session-id}"

# Legacy format
curl -X DELETE http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "mcp-session-id: {session-id}"
```

### 2. SSE Endpoint

The `/sse` endpoint provides Server-Sent Events for real-time communication.

#### Connect

```bash
curl http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/sse \
  -H "Accept: text/event-stream"
```

Returns session endpoint in the event stream.

#### Send Messages

```bash
curl -X POST http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/messages?sessionId={session-id} \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Common MCP Methods

### Initialize
```json
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "client", "version": "1.0"}
  },
  "id": 1
}
```

### List Tools
```json
{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 2
}
```

### Call Tool
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "read_file",
    "arguments": {
      "path": "/tmp/test.txt"
    }
  },
  "id": 3
}
```

### List Resources
```json
{
  "jsonrpc": "2.0",
  "method": "resources/list",
  "id": 4
}
```

## Response Format

### Stream Endpoint
Returns event stream format:
```
event: message
id: {event-id}
data: {"jsonrpc":"2.0","result":{...},"id":1}
```

Extract JSON from `data:` line for processing.

### Error Responses

#### Invalid API Key
```json
{
  "error": "Invalid API key"
}
```

#### Server Not Found
```json
{
  "error": "Server 'invalid-name' not found"
}
```

#### MCP Protocol Errors
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Not Acceptable: Client must accept both application/json and text/event-stream"
  },
  "id": null
}
```

## Working Example Script

```bash
#!/bin/bash

# Initialize session (new format)
RESPONSE=$(curl -s -i -X POST http://localhost:3000/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}')

# Extract session ID
SESSION_ID=$(echo "$RESPONSE" | grep -i "mcp-session-id:" | cut -d' ' -f2 | tr -d '\r')

# List tools
TOOLS=$(curl -s -X POST http://localhost:3000/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}')

# Extract JSON from event stream
echo "$TOOLS" | grep "^data:" | cut -d' ' -f2- | jq .

# Call a tool
curl -s -X POST http://localhost:3000/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "list_directory",
      "arguments": {"path": "/tmp"}
    },
    "id": 3
  }' | grep "^data:" | cut -d' ' -f2- | jq .

# Terminate session
curl -s -X DELETE http://localhost:3000/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/mcp \
  -H "mcp-session-id: $SESSION_ID"
```

## Key Requirements

1. **Accept Headers**: Must include both `application/json, text/event-stream`
2. **Session Management**: Initialize session first, use session ID for subsequent requests
3. **URL Structure**: Use new format `{server-name}/{api-key}/mcp` or legacy `/mcp/{server-name}/{api-key}/{endpoint}`
4. **Response Processing**: Extract JSON from `data:` lines in event stream responses

## Configuration Best Practices

### ✅ Recommended: Absolute Path Configuration

```json
{
  "port": 3000,
  "apiKeys": ["sk-mcp-hetzner-f4a8b2c9d1e3"],
  "servers": [
    {
      "name": "filesystem",
      "command": "/usr/bin/npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": {}
    },
    {
      "name": "sequential-thinking", 
      "command": "/usr/bin/npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {}
    }
  ]
}
```

### 🚫 Don't Use: Relative Paths

```json
{
  "servers": [
    {
      "name": "broken-server",
      "command": "npx",  // ❌ No absolute path
      "args": ["-y", "@pkg/server"],
      "env": {}
    }
  ]
}
```

**Why Absolute Paths?** The orchestrator uses custom mcp-proxy fork with `--shell` support that requires absolute command paths for proper execution.

## Troubleshooting

### "Invalid API key"
- Check API key matches value in mcp-config.json
- Ensure API key is in URL path, not headers

### "Server not found"
- Verify server name matches configuration
- Check server is running with `curl http://localhost:3000/healthz`

### "Not Acceptable" errors
- Add both Accept headers: `application/json, text/event-stream`
- Ensure Content-Type is `application/json` for POST requests

### "No active transport"
- Session may have expired, reinitialize
- Ensure session ID is correctly extracted and used
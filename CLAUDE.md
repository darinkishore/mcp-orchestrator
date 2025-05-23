# CLAUDE.md - MCP Orchestrator

## Overview
This is an MCP (Model Context Protocol) orchestrator that exposes stdio-based MCP servers over HTTP with API key authentication. It's deployed on a Hetzner box and managed with PM2.

## Current Setup
- **Main script**: `orchestrator-minimal.js`
- **Port**: 3000
- **API Key**: `sk-mcp-hetzner-f4a8b2c9d1e3` (configured in mcp-config.json)
- **Process manager**: PM2 (auto-starts on boot)

## Architecture
The orchestrator uses the `mcp-proxy` npm package to spawn MCP servers and expose them via HTTP:
- Each MCP server is spawned using `npx mcp-proxy --port <port> <command>`
- The orchestrator routes requests based on the URL path: `/mcp/{server-name}/{api-key}/{endpoint}`
- Supports both SSE (Server-Sent Events) and Streamable HTTP transports

## Key Files
- `orchestrator-minimal.js` - Main orchestrator script
- `mcp-config.json` - Configuration (servers, API keys, port)
- `ecosystem.config.js` - PM2 configuration
- `test-working.sh` - Working test script that demonstrates full flow
- `MCP_USAGE_GUIDE.md` - Comprehensive usage documentation
- `MCP_PROXY_INTERNALS.md` - Deep dive into mcp-proxy behavior and common pitfalls
- `start-filesystem.sh` - Wrapper script for filesystem server

## Available Endpoints
- `GET /healthz` - Health check (no auth required)
- `/mcp/{server-name}/{api-key}/sse` - Server-Sent Events transport
- `/mcp/{server-name}/{api-key}/stream` - Streamable HTTP transport

## How to Use

### Quick Test
```bash
# Health check
curl http://localhost:3000/healthz

# Run the working test script
./test-working.sh
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
- `pm2 status` - Check status
- `pm2 logs` - View logs  
- `pm2 restart mcp-orchestrator` - Restart
- `pm2 stop mcp-orchestrator` - Stop
- `pm2 start ecosystem.config.js` - Start

## Adding New MCP Servers
1. Edit `mcp-config.json`
2. Add server configuration:
   ```json
   {
     "name": "server-name",
     "command": "./wrapper-script.sh",
     "args": [],
     "env": {}
   }
   ```
3. Create wrapper script (recommended for complex commands):
   ```bash
   #!/bin/bash
   exec npx -y @org/mcp-server --arg1 value1
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
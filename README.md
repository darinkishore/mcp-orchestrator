# MCP Orchestrator

A lightweight gateway that exposes stdio MCP (Model Context Protocol) servers over HTTP with API key authentication.

## Features

- 🚀 Exposes any stdio MCP server over HTTP following the official Streamable-HTTP spec
- 🔑 Simple API key authentication
- 🔄 Automatic process management for multiple MCP servers
- 📊 Health monitoring endpoint
- 🛡️ Production-ready with PM2 and Nginx integration
- 📝 Easy configuration via JSON

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure your MCP servers
Edit `mcp-config.json` (use **absolute paths only**):
```json
{
  "port": 3000,
  "apiKeys": ["your-api-key-here"],
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

### 3. Start the orchestrator
```bash
node orchestrator.js
```

Or with PM2:
```bash
pm2 start ecosystem.config.js
```

## Usage

### Initialize a session
```bash
curl -X POST http://localhost:3000/mcp \
  -H "X-API-Key: your-api-key-here" \
  -H "X-MCP-Server: weather" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {"protocolVersion": "0.1.0"},
    "id": 1
  }'
```

### Health check
```bash
curl http://localhost:3000/healthz
```

## Deployment

Use the provided `deploy.sh` script for automated deployment on Ubuntu/Debian servers:
```bash
./deploy.sh
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│ Orchestrator │────▶│ mcp-proxy   │
│ (API calls) │     │  (routing)   │     │ (instance)  │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                     │
                            │                     ▼
                            │              ┌─────────────┐
                            └─────────────▶│ stdio MCP   │
                                          │   server    │
                                          └─────────────┘
```

## Configuration

### API Keys
Add keys to the `apiKeys` array in `mcp-config.json`. Clients must include the key in either:
- `X-API-Key` header
- `Authorization: Bearer <key>` header

### Adding MCP Servers
Each server in the config needs:
- `name`: Unique identifier for routing
- `command`: **ABSOLUTE PATH** to executable (e.g., `/usr/bin/npx`)
- `args`: Array of arguments for the command
- `env`: Environment variables (optional)

**Important**: Use absolute paths due to `shell: false` in mcp-proxy.

## Production Setup

1. Use PM2 for process management
2. Configure Nginx for SSL/TLS (see `nginx.conf.example`)
3. Set up Let's Encrypt for certificates
4. Use environment variables for sensitive data

## Testing

Run the smoke test:
```bash
./test.sh
```

## License

MIT
# MCP Orchestrator

A modern, TypeScript-based gateway that exposes stdio MCP (Model Context Protocol) servers over HTTP with API key authentication. Built with Bun and comprehensive testing.

## Features

- 🚀 **Modern Architecture**: TypeScript-first with comprehensive type safety
- 🔄 **Multi-Server Support**: Orchestrate multiple MCP servers simultaneously  
- 🌐 **HTTP Transport**: Exposes stdio MCP servers via Streamable-HTTP and SSE
- 🔑 **API Authentication**: Simple but secure API key-based authentication
- ⚡ **High Performance**: Built with Bun package manager and optimized runtime
- 🧪 **Fully Tested**: Comprehensive test coverage with Bun test runner
- 📊 **Health Monitoring**: Built-in health checks and process monitoring
- 🛡️ **Production Ready**: PM2 integration, proper error handling, and logging
- 📝 **Easy Configuration**: Simple JSON-based configuration with validation

## Quick Start

### 1. Install dependencies
```bash
# Using Bun (recommended)
bun install

# Or using npm
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

### 3. Build and start the orchestrator
```bash
# Build TypeScript
npm run build

# Development mode (with auto-reload)
bun run dev

# Production mode  
npm start

# Run tests
npm test

# With PM2 (recommended for production)
npm run pm2:start
```

## Usage

### Initialize a session
```bash
curl -X POST http://localhost:3000/mcp/filesystem/your-api-key/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize", 
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0"}
    },
    "id": 1
  }'
```

### Health check
```bash
curl http://localhost:3000/healthz
```

## Development

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run the compiled application  
- `npm run dev` - Development mode with auto-reload (requires Bun)
- `npm run test` - Run the test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run typecheck` - Type-check without building
- `npm run clean` - Clean build artifacts

### Testing

The project includes comprehensive tests covering configuration, types, and integration:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
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
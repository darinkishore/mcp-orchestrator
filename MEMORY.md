# MEMORY.md - Learnings from MCP Orchestrator Implementation

## Key Learnings

### 1. MCP Transport Architecture
- MCP servers typically use stdio transport (stdin/stdout)
- The official spec supports HTTP transports: SSE and Streamable HTTP
- Converting stdio to HTTP requires careful handling of JSON-RPC protocol

### 2. mcp-proxy Package
- **Purpose**: Converts stdio MCP servers to HTTP endpoints
- **Not a library first**: It's primarily a CLI tool, not meant for programmatic orchestration
- **Usage**: `npx mcp-proxy --port 8080 <command>`
- **Endpoints**: Creates `/sse` and `/stream` endpoints automatically
- **Key insight**: Each mcp-proxy instance handles ONE stdio server

### 3. Initial Mistakes
- Tried to use mcp-proxy SDK programmatically - this was overcomplicating
- Attempted to implement custom stdio-to-HTTP bridge - unnecessary
- Misunderstood mcp-proxy's role - it's a complete solution, not a building block

### 4. Working Solution
- Simple orchestrator that spawns multiple mcp-proxy processes
- Each MCP server gets its own port (4000, 4001, etc.)
- Main orchestrator just routes requests based on headers
- Use http-proxy to forward requests to the right mcp-proxy instance

### 5. Process Management
- PM2 works well for managing the orchestrator
- Child processes (mcp-proxy instances) are managed by the orchestrator
- Graceful shutdown is important to clean up child processes

### 6. Configuration Pattern
- Followed Claude Desktop's config style (JSON with servers array)
- Each server needs: name, command, and optional env vars
- API keys stored in the same config for simplicity

### 7. Debugging Tips
- `pm2 logs` is essential for troubleshooting
- Test mcp-proxy directly first before orchestrating
- Check if ports are actually listening with curl
- SSE endpoints need special handling in nginx (proxy_buffering off)

### 8. What Worked
- Keep it simple - use mcp-proxy as designed (CLI tool)
- Let each tool do what it's good at
- Don't reinvent the wheel (mcp-proxy already handles the hard parts)

### 9. Architecture That Failed
- Custom TypeScript implementation with MCP SDK
- Trying to manage sessions and stdio directly
- Complex proxy configurations

### 10. Final Architecture
```
Client -> Orchestrator (port 3000) -> mcp-proxy (port 400X) -> stdio MCP server
        (routes by header)         (converts HTTP to stdio)
```

## Gotchas
- mcp-proxy exits if the stdio server exits
- Need to give servers time to start (2-3 second delay)
- Express route patterns need exact matches (not wildcards)
- PM2 cluster mode doesn't work well with child process spawning

## Future Improvements
- Dynamic server addition without restart
- Better error handling when servers fail
- Metrics and monitoring per server
- Rate limiting per API key
- WebSocket support for real-time updates
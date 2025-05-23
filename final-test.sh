#!/bin/bash

echo "=== MCP Orchestrator Final Test ==="
echo ""

# Health check
echo "1. Health check:"
curl -s http://localhost:3000/healthz | jq .

echo ""
echo "2. Testing without auth (should fail):"
curl -s -X POST http://localhost:3000/sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "test", "id": 1}'

echo ""
echo "3. Available servers:"
echo "   - sequential-thinking"
echo ""
echo "Configuration:"
echo "   - Port: 3000"
echo "   - API Key: sk-mcp-hetzner-f4a8b2c9d1e3"
echo "   - Endpoints: /sse (Server-Sent Events), /stream (Streamable HTTP)"
echo ""
echo "PM2 Status:"
pm2 status

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "To use the MCP orchestrator:"
echo "1. Send requests to http://localhost:3000/sse or /stream"
echo "2. Include header: X-API-Key: sk-mcp-hetzner-f4a8b2c9d1e3"
echo "3. Include header: X-MCP-Server: sequential-thinking"
echo ""
echo "Example curl command:"
echo 'curl -X POST http://localhost:3000/sse \'
echo '  -H "X-API-Key: sk-mcp-hetzner-f4a8b2c9d1e3" \'
echo '  -H "X-MCP-Server: sequential-thinking" \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{"jsonrpc":"2.0","method":"tools/list","id":1}'"'"
#!/bin/bash

echo "Testing MCP orchestrator with proper mcp-proxy protocol..."

# Test direct mcp-proxy
echo -e "\n1. Testing direct mcp-proxy on port 4000:"
echo "   GET /ping:"
curl -s http://localhost:4000/ping

echo -e "\n\n2. Initialize stream session:"
RESPONSE=$(curl -s -i -X POST http://localhost:4000/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}')

SESSION_ID=$(echo "$RESPONSE" | grep -i "mcp-session-id:" | cut -d' ' -f2 | tr -d '\r')
echo "   Session ID: $SESSION_ID"

echo -e "\n3. List tools using session:"
TOOLS_RESPONSE=$(curl -s -X POST http://localhost:4000/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}')
echo "$TOOLS_RESPONSE" | grep "^data:" | cut -d' ' -f2- | jq . 2>/dev/null || echo "$TOOLS_RESPONSE"

echo -e "\n4. Testing through orchestrator:"
echo "   URL: http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/stream"

# Initialize session through orchestrator
RESPONSE=$(curl -s -i -X POST http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}')

SESSION_ID=$(echo "$RESPONSE" | grep -i "mcp-session-id:" | cut -d' ' -f2 | tr -d '\r')
echo "   Session ID: $SESSION_ID"

echo -e "\n5. List tools through orchestrator:"
TOOLS_RESPONSE=$(curl -s -X POST http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}')
echo "$TOOLS_RESPONSE" | grep "^data:" | cut -d' ' -f2- | jq . 2>/dev/null || echo "$TOOLS_RESPONSE"
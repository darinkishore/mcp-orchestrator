#!/bin/bash
# MCP Orchestrator Smoke Test Script

set -e

# Configuration
BASE_URL="${MCP_URL:-http://localhost:3000}"
API_KEY="${MCP_API_KEY:-your-secret-api-key-1}"
MCP_SERVER="${MCP_SERVER:-weather}"

echo "=== MCP Orchestrator Smoke Test ==="
echo "Base URL: $BASE_URL"
echo "Testing server: $MCP_SERVER"
echo ""

# Test 1: Health check
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/healthz" | jq . || echo "Health check failed"
echo ""

# Test 2: Initialize MCP session
echo "2. Initializing MCP session..."
RESPONSE=$(curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "X-MCP-Server: $MCP_SERVER" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "0.1.0",
      "capabilities": {}
    },
    "id": 1
  }')

echo "Response:"
echo "$RESPONSE" | jq . || echo "$RESPONSE"

# Extract session ID
SESSION_ID=$(echo "$RESPONSE" | grep -o 'Mcp-Session-Id: [^"]*' | cut -d' ' -f2)
echo "Session ID: $SESSION_ID"
echo ""

# Test 3: List available tools (if session was created)
if [ ! -z "$SESSION_ID" ]; then
  echo "3. Listing available tools..."
  curl -s -X POST "$BASE_URL/mcp" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -H "X-MCP-Server: $MCP_SERVER" \
    -H "Mcp-Session-Id: $SESSION_ID" \
    -d '{
      "jsonrpc": "2.0",
      "method": "tools/list",
      "params": {},
      "id": 2
    }' | jq . || echo "Failed to list tools"
fi

echo ""
echo "=== Test Complete ===""
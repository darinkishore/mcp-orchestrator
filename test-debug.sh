#!/bin/bash
echo "Starting orchestrator test..."

# Kill any existing processes
pkill -f "node orchestrator-minimal.js" 2>/dev/null
pkill -f mcp-proxy 2>/dev/null
sleep 2

# Start orchestrator in background with timeout
timeout 30s node orchestrator-minimal.js &
ORCH_PID=$!

echo "Orchestrator PID: $ORCH_PID"
echo "Waiting for startup..."
sleep 15

echo ""
echo "=== Testing health check ==="
curl -s http://localhost:3000/healthz | jq .

echo ""
echo "=== Testing filesystem server ==="
curl -s http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}' | head -1

echo ""
echo "=== Testing sequential-thinking server ==="
curl -s http://localhost:3000/mcp/sequential-thinking/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}' | head -1

echo ""
echo "=== Checking running processes ==="
ps aux | grep mcp-proxy | grep -v grep

# Clean up
echo ""
echo "Cleaning up..."
kill $ORCH_PID 2>/dev/null
pkill -f mcp-proxy 2>/dev/null
sleep 2

echo "Test complete."
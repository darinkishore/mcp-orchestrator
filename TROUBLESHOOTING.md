# MCP Orchestrator Troubleshooting Guide

This guide documents common issues and debugging strategies for the MCP orchestrator, based on extensive troubleshooting sessions.

## The "Servers Not Found" Mystery

### Symptoms
- Health check shows `{}` empty servers despite logs showing servers started
- API calls return `{"error":"Server 'filesystem' not found"}`
- Logs show "Added to servers map" but servers aren't accessible
- Works briefly after manual restart but fails under PM2

### Root Causes We've Encountered

#### 1. Stale Orchestrator Processes (Most Common)
**Problem**: Old orchestrator processes hold stale Map state in memory
```bash
# Check for zombie orchestrators
ps aux | grep -E "(orchestrator|mcp-proxy)" | grep -v grep
# Look for multiple orchestrator processes or old PIDs
```

**Solution**:
```bash
# Nuclear option - clean everything
pkill -f orchestrator
pkill -f mcp-proxy
pm2 delete mcp-orchestrator
pm2 start ecosystem.config.cjs
```

#### 2. Yargs Argument Parsing Issues
**Problem**: When using `unknown-options-as-args: true`, yargs misinterprets command structure
- Command becomes empty
- Args array contains the command
- Shell tries to execute JSON-RPC messages as commands

**Symptoms**:
```
sh: line 1: method:initialize: command not found
sh: line 2: jsonrpc:2.0: command not found
```

**Solution**: Remove `unknown-options-as-args: true` and use `--` separator properly

#### 3. NPX Package Resolution Timing
**Problem**: NPX needs time to download/resolve packages on first run
- Process spawns but isn't ready
- MCP client times out waiting for initialization

**Solution**: Add 3-second delay for npx commands in StdioClientTransport

## Debugging Workflow

### 1. Start with Process Check
```bash
# Are the right processes running?
ps aux | grep mcp-proxy | grep -v grep
ps aux | grep orchestrator | grep -v grep

# Count should match expected servers
ps aux | grep mcp-proxy | grep -v grep | wc -l
```

### 2. Check PM2 Logs in Order
```bash
# Look for startup messages
pm2 logs --lines 50 | grep -E "(Secure MCP|Sequential Thinking|running on stdio)"

# Check for server registration
pm2 logs --lines 50 | grep -E "(Added .* to servers map|Current servers in map)"

# Look for crashes
pm2 logs --lines 50 | grep "exited with code"
```

### 3. Test Health Incrementally
```bash
# Immediate check (often empty due to timing)
curl -s http://localhost:3000/healthz | jq .

# Wait for startup
sleep 20 && curl -s http://localhost:3000/healthz | jq .

# If still empty, restart PM2 cleanly
pm2 restart mcp-orchestrator && sleep 20 && curl -s http://localhost:3000/healthz | jq .
```

### 4. Manual Testing Outside PM2
```bash
# Kill everything first
pm2 stop mcp-orchestrator
pkill -f mcp-proxy

# Run manually to see all output
timeout 30s node dist/orchestrator.js

# In another terminal, test
curl -s http://localhost:3000/healthz | jq .
```

## Common Fixes That Actually Work

### The "Clean Slate" Approach
```bash
# 1. Stop everything
pm2 stop mcp-orchestrator

# 2. Kill stragglers
pkill -f orchestrator
pkill -f mcp-proxy

# 3. Clean PM2 state
pm2 delete mcp-orchestrator

# 4. Fresh start
pm2 start ecosystem.config.cjs

# 5. Wait and test
sleep 20 && curl -s http://localhost:3000/healthz | jq .
```

### Testing Individual Components

#### Test mcp-proxy directly
```bash
cd /home/dev/projects/mcp_orchestrator/mcp-orchestrator
timeout 10s node node_modules/mcp-proxy/dist/bin/mcp-proxy.js \
  --port 4000 --debug --server stream \
  /usr/bin/npx -- -y @modelcontextprotocol/server-filesystem /tmp
```

#### Test npx command directly
```bash
/usr/bin/npx -y @modelcontextprotocol/server-filesystem /tmp
# Should output: "Secure MCP Filesystem Server running on stdio"
```

## Understanding the Architecture

### How It Should Work
1. Orchestrator spawns mcp-proxy with: `node mcp-proxy.js --port 4000 /usr/bin/npx -- -y @server/package`
2. mcp-proxy parses args and spawns: `/usr/bin/npx -y @server/package`
3. NPX downloads package (if needed) and runs it
4. Server outputs to stdio, mcp-proxy bridges to HTTP
5. Orchestrator tracks in Map and routes requests

### Where It Breaks
1. **Stale state**: Old processes keep Maps with dead PIDs
2. **Timing**: NPX download time causes initialization timeout
3. **Parsing**: Yargs configuration affects how `--` is handled
4. **Tracking**: Server exits but Map entry remains

## Key Insights for Future Debugging

### Always Check for Stale Processes
The #1 issue is stale orchestrator processes. Even if PM2 says it restarted, check:
```bash
ps aux | grep orchestrator | grep -v grep
# If you see multiple or old PIDs, kill them all
```

### The `--` Separator is Crucial
With standard yargs config:
- Everything after `--` goes into `argv._` array
- Command positional must come before `--`
- Don't use `unknown-options-as-args: true` unless you handle the parsing manually

### PM2 Timing is Different
- Manual execution: Servers available immediately
- PM2 execution: Need 15-20 second delay
- Always add delays when testing under PM2

### Trust the Logs
When logs show "Secure MCP Filesystem Server running on stdio", the server IS working. 
If the API says "not found", it's a tracking/state issue, not a server issue.

## Testing End-to-End Success

```bash
# The victory lap test sequence
pm2 restart mcp-orchestrator && sleep 20

# Check health
curl -s http://localhost:3000/healthz | jq .
# Should show both servers with PIDs

# Test filesystem
curl -s http://localhost:3000/mcp/filesystem/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
# Should return event stream with serverInfo

# Test sequential-thinking  
curl -s http://localhost:3000/mcp/sequential-thinking/sk-mcp-hetzner-f4a8b2c9d1e3/stream \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}},"id":1}'
# Should return event stream with serverInfo
```

## Summary of Our Journey

We went through this debugging cycle multiple times:
1. Fix yargs parsing → servers start → but health check empty
2. Add startup delays → servers initialize → but still "not found"  
3. Fix argument handling → correct parsing → but state issues persist
4. Clean PM2 restart → stale processes killed → **finally works end-to-end**

The lesson: When you think you've fixed it but it's still broken, check for stale processes. The Maps in memory don't lie - if they're empty, something is holding old state.

## For Future Claude

Dear future me, when debugging this:
1. **Always** check for stale processes first
2. Don't trust PM2 restart - verify with `ps aux`
3. Test manually outside PM2 to isolate issues
4. The `--` separator works fine with standard yargs
5. If logs show servers starting but API says "not found", it's state management
6. Clean slate approach works - nuclear option is sometimes the best option
7. Wait 20 seconds after PM2 restart before testing
8. Trust the server stdout messages - they don't lie

Remember: The servers are probably working fine. It's almost always a state/tracking issue in the orchestrator.
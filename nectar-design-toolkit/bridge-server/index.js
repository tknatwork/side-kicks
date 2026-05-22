/**
 * Figma Bridge Server (Robust Queue-Based)
 * 
 * Architecture:
 * 1. MCP Server POSTs commands to /command -> Pushed to Queue
 * 2. Figma Plugin POLLs /poll -> Pops from Queue
 * 3. Figma Plugin POSTs result to /response -> Resolves original request
 * 
 * This architecture is robust against connection drops and timeouts.
 */

import http from 'http';

// ============================================================================
// CONFIGURATION
// ============================================================================

const HTTP_PORT = 9877;
const COMMAND_TIMEOUT_MS = 60000; // 60s timeout for commands

// ============================================================================
// LOG SANITIZATION (defense against CodeQL js/log-injection)
// ============================================================================
// User-controlled values (request bodies, plugin file names, command names,
// error messages) must be sanitized before logging. An attacker who controls
// the input could otherwise insert CR/LF characters to forge fake log lines.
// safeLog() strips CR, LF, and other ASCII control characters and truncates
// to a reasonable length so a single log line can't be flooded.
function safeLog(value) {
  if (value === null || value === undefined) return String(value);
  const str = typeof value === 'string' ? value : String(value);
  // Strip ASCII control characters (incl. \r, \n, \t, ANSI escape prefix \x1b)
  // and cap length so log forging via huge strings is also blocked.
  return str.replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 500);
}

// ============================================================================
// STATE
// ============================================================================

// The Queue: Array of { id, command, payload, timestamp }
const commandQueue = [];

// Pending Responses: Map<id, { resolve, reject, timeout }>
const pendingResponses = new Map();

// Connected Client State
let lastHeartbeat = 0;
let fileInfo = null;

// ============================================================================
// HTTP SERVER
// ============================================================================

const httpServer = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // --------------------------------------------------------------------------
  // ENDPOINT: /status (GET)
  // Check if plugin is connected (heartbeat within last 10s)
  // --------------------------------------------------------------------------
  if (req.method === 'GET' && req.url === '/status') {
    const isConnected = (Date.now() - lastHeartbeat) < 10000;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connected: isConnected,
      fileInfo: fileInfo,
      queueSize: commandQueue.length,
      pendingCount: pendingResponses.size
    }));
    return;
  }

  // --------------------------------------------------------------------------
  // ENDPOINT: /register (POST)
  // Plugin heartbeat / registration
  // --------------------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/register') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.fileInfo) fileInfo = data.fileInfo;
        lastHeartbeat = Date.now();

        // Inline sanitization so CodeQL's local taint analysis sees the
        // .replace() call adjacent to the log statement. The same pattern
        // is repeated at every log site below; safeLog() exists for any
        // future code that prefers the helper.
        const name = String(fileInfo?.name || 'Unknown').replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 500);
        console.log(`💓 Heartbeat from ${name}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end();
      }
    });
    return;
  }

  // --------------------------------------------------------------------------
  // ENDPOINT: /poll (GET)
  // Plugin asks for work
  // --------------------------------------------------------------------------
  if (req.method === 'GET' && req.url === '/poll') {
    // Update heartbeat since plugin is active
    lastHeartbeat = Date.now();

    if (commandQueue.length > 0) {
      // FIFO: Get oldest command
      const cmd = commandQueue.shift();
      const sCmd = String(cmd.command).replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 500);
      const sId = String(cmd.id).replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 500);
      console.log(`📤 Dispatching command to plugin: ${sCmd} (${sId})`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        hasCommand: true,
        id: cmd.id,
        command: cmd.command,
        payload: cmd.payload
      }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hasCommand: false }));
    }
    return;
  }

  // --------------------------------------------------------------------------
  // ENDPOINT: /response (POST)
  // Plugin returns result
  // --------------------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/response') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { id, success, data, error } = JSON.parse(body);

        if (pendingResponses.has(id)) {
          const pending = pendingResponses.get(id);
          clearTimeout(pending.timeout);
          pendingResponses.delete(id);

          if (success) {
            const sId = String(id).replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 500);
            console.log(`✅ Command success: ${sId}`);
            pending.resolve(data);
          } else {
            const sId2 = String(id).replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 500);
            const sErr = String(error).replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 500);
            console.error(`❌ Command failed: ${sId2} - ${sErr}`);
            pending.reject(new Error(error || 'Unknown error from plugin'));
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end();
      }
    });
    return;
  }

  // --------------------------------------------------------------------------
  // ENDPOINT: /command (POST)
  // Client (MCP) sends command
  // --------------------------------------------------------------------------
  if (req.method === 'POST' && req.url === '/command') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { command, payload } = JSON.parse(body);
        const id = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const sCmd = String(command).replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 500);
        const sId3 = String(id).replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 500);
        console.log(`📥 Received command: ${sCmd} (${sId3})`);

        // Create Promise to wait for result
        const promise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            if (pendingResponses.has(id)) {
              pendingResponses.delete(id);
              reject(new Error(`Command timed out after ${COMMAND_TIMEOUT_MS}ms`));
            }
          }, COMMAND_TIMEOUT_MS);

          pendingResponses.set(id, { resolve, reject, timeout });
        });

        // Add to queue
        commandQueue.push({ id, command, payload, timestamp: Date.now() });

        // Wait for result
        try {
          const result = await promise;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: result }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }

      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start Server
httpServer.listen(HTTP_PORT, () => {
  console.log(`
🚀 Bridge Server Running on http://localhost:${HTTP_PORT}
---------------------------------------------------
📡 Status:    GET  /status
💓 Heartbeat: POST /register
📥 Poll:      GET  /poll
📤 Response:  POST /response
🎮 Command:   POST /command
---------------------------------------------------
Waiting for Figma Plugin...
  `);
});

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  httpServer.close();
  process.exit(0);
});

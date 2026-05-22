/**
 * Nectar DS - Orchestration Server
 * 
 * This server provides:
 * 1. Bridge functionality (WebSocket for Figma plugin)
 * 2. HTTP API for MCP/AI commands
 * 3. Real-time diagnostic logging
 * 4. Health monitoring
 * 
 * All-in-one server to debug and control the Figma plugin
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = 9876;
const HTTP_PORT = 9877;

// ============================================================================
// LOGGING
// ============================================================================

const logs = [];
const MAX_LOGS = 200;

// Sanitize values destined for console / log entries.
// Defends against CodeQL js/log-injection + js/tainted-format-string:
// untrusted strings could otherwise embed \r\n + ANSI escapes to forge
// log lines or move the cursor.
function safeLog(value) {
  if (value === null || value === undefined) return String(value);
  const str = typeof value === 'string' ? value : String(value);
  return str.replace(/\n|\r/g, '').replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 500);
}

// Closed set of categories actually used in this file. Anything else
// renders as UNKNOWN so an attacker can't pivot category to inject.
const CATEGORY_COLORS = {
  SYSTEM:   '\x1b[36m',
  WS:       '\x1b[33m',
  HTTP:     '\x1b[35m',
  PLUGIN:   '\x1b[32m',
  COMMAND:  '\x1b[34m',
  ERROR:    '\x1b[31m',
  RESPONSE: '\x1b[32m',
};

function log(category, message, data = null) {
  const safeCategory = Object.prototype.hasOwnProperty.call(CATEGORY_COLORS, category)
    ? category
    : 'UNKNOWN';
  // Inline sanitization so CodeQL sees the .replace() adjacent to the
  // console.log call (helper functions are not auto-recognized as
  // sanitizers). Strips ASCII control chars + caps length.
  const safeMessage = String(message ?? '').replace(/\n|\r/g, '').replace(/[\x00-\x1f\x7f]+/g, ' ').slice(0, 500);

  const entry = {
    time: new Date().toISOString(),
    category: safeCategory,
    message: safeMessage,
    data
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.pop();

  // Console output with colors. category color is looked up from the
  // closed set; message + data are sanitized / JSON-encoded.
  const color = CATEGORY_COLORS[safeCategory] || '\x1b[37m';
  const reset = '\x1b[0m';

  // JSON.stringify escapes control characters in nested strings.
  // The fixed format string ('%s [%s]%s %s %s') prevents tainted-format
  // injection because no user data flows into the format string itself.
  const dataStr = data ? JSON.stringify(data).slice(0, 100) : '';
  console.log('%s[%s]%s %s %s', color, safeCategory, reset, safeMessage, dataStr);
}

// ============================================================================
// STATE
// ============================================================================

let pluginSocket = null;
let fileInfo = null;
const pendingCommands = new Map();

// HTTP polling state (alternative to WebSocket)
let httpPluginConnected = false;
let lastHttpPing = 0;
const httpCommandQueue = [];

// ============================================================================
// WEBSOCKET SERVER
// ============================================================================

const wss = new WebSocketServer({ port: PORT });

log('SYSTEM', `WebSocket server started on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  log('WS', `New connection from ${clientIp}`);
  
  // Track as plugin connection
  if (pluginSocket) {
    log('WS', 'Closing previous plugin connection');
    pluginSocket.close();
  }
  pluginSocket = ws;
  
  ws.on('message', (rawData) => {
    const dataStr = rawData.toString();
    log('PLUGIN', `Received message (${dataStr.length} bytes)`);
    
    try {
      const message = JSON.parse(dataStr);
      log('PLUGIN', `Message type: ${message.type}`, message);
      
      handlePluginMessage(message);
    } catch (error) {
      log('ERROR', `Failed to parse message: ${error.message}`);
    }
  });

  ws.on('close', (code, reason) => {
    log('WS', `Connection closed: ${code} - ${reason || 'no reason'}`);
    pluginSocket = null;
    fileInfo = null;
    
    // Reject pending commands
    for (const [id, pending] of pendingCommands) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Plugin disconnected'));
    }
    pendingCommands.clear();
  });

  ws.on('error', (error) => {
    log('ERROR', `WebSocket error: ${error.message}`);
  });
  
  // Send a welcome message to confirm connection
  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected to Orchestration Server' }));
  log('WS', 'Sent welcome message to client');
});

function handlePluginMessage(message) {
  if (message.type === 'file_info') {
    fileInfo = message.data;
    log('PLUGIN', `File info received: ${fileInfo?.name || 'unknown'}`);
    return;
  }

  if (message.type === 'response') {
    log('RESPONSE', `Response for ${message.id}: success=${message.success}`);
    const pending = pendingCommands.get(message.id);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingCommands.delete(message.id);
      
      if (message.success) {
        pending.resolve(message.data);
      } else {
        pending.reject(new Error(message.error || 'Command failed'));
      }
    } else {
      log('ERROR', `No pending command for id: ${message.id}`);
    }
    return;
  }
  
  log('PLUGIN', `Unknown message type: ${message.type}`);
}

// ============================================================================
// HTTP SERVER
// ============================================================================

const httpServer = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url;
  log('HTTP', `${req.method} ${url}`);

  // === DIAGNOSTIC ENDPOINTS ===
  
  // Status endpoint
  if (req.method === 'GET' && url === '/status') {
    const wsConnected = pluginSocket !== null && pluginSocket.readyState === WebSocket.OPEN;
    const httpConnected = httpPluginConnected && (Date.now() - lastHttpPing < 30000);
    
    const status = {
      connected: wsConnected || httpConnected,
      connectionType: wsConnected ? 'websocket' : (httpConnected ? 'http' : 'none'),
      fileInfo,
      pendingCommands: pendingCommands.size,
      httpCommandQueue: httpCommandQueue.length,
      wsState: pluginSocket ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][pluginSocket.readyState] : 'NULL',
      lastHttpPing: lastHttpPing ? new Date(lastHttpPing).toISOString() : null,
      uptime: process.uptime()
    };
    log('HTTP', 'Status request', status);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
    return;
  }

  // Logs endpoint
  if (req.method === 'GET' && url === '/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(logs.slice(0, 50), null, 2));
    return;
  }
  
  // Recent logs (last N)
  if (req.method === 'GET' && url.startsWith('/logs/')) {
    const n = parseInt(url.split('/')[2]) || 10;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(logs.slice(0, n), null, 2));
    return;
  }

  // Health check
  if (req.method === 'GET' && url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, time: new Date().toISOString() }));
    return;
  }
  
  // Dashboard HTML
  if (req.method === 'GET' && (url === '/' || url === '/dashboard')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getDashboardHTML());
    return;
  }

  // === COMMAND ENDPOINTS ===

  // Send command to plugin
  if (req.method === 'POST' && url === '/command') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { command, payload } = JSON.parse(body);
        log('COMMAND', `Received command: ${command}`, payload);
        try {
          // sendCommand now supports enqueueing for HTTP-polled plugins if no WebSocket is available
          const result = await sendCommand(command, payload || {});
          log('COMMAND', `Command ${command} succeeded`, result);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: result }));
        } catch (error) {
          log('ERROR', `Command ${command} failed: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: error.message }));
        }
      } catch (error) {
        log('ERROR', `Invalid JSON: ${error.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Test echo (sends message to plugin and expects echo back)
  if (req.method === 'POST' && url === '/test') {
    if (!pluginSocket || pluginSocket.readyState !== WebSocket.OPEN) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Plugin not connected' }));
      return;
    }
    
    const testMsg = { type: 'test', time: Date.now() };
    pluginSocket.send(JSON.stringify(testMsg));
    log('HTTP', 'Sent test message to plugin');
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Test sent', testMsg }));
    return;
  }

  // HTTP-based plugin registration (alternative to WebSocket)
  if (req.method === 'POST' && url === '/register') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        log('PLUGIN', 'HTTP Registration received', data);
        if (data.fileInfo) {
          fileInfo = data.fileInfo;
        }
        // Mark as connected via HTTP polling
        httpPluginConnected = true;
        lastHttpPing = Date.now();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Registered' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // HTTP-based response from plugin
  if (req.method === 'POST' && url === '/response') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const response = JSON.parse(body);
        log('RESPONSE', `HTTP Response for ${response.id}: success=${response.success}`, response);
        
        const pending = pendingCommands.get(response.id);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingCommands.delete(response.id);
          
          if (response.success) {
            pending.resolve(response.data);
          } else {
            pending.reject(new Error(response.error || 'Command failed'));
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // Poll for pending commands (plugin polls this)
  // Supports batch: returns up to BATCH_SIZE commands per poll
  if (req.method === 'GET' && url === '/poll') {
    lastHttpPing = Date.now();
    httpPluginConnected = true;

    const BATCH_SIZE = 10; // Max commands per poll cycle

    if (httpCommandQueue.length > 0) {
      const count = Math.min(httpCommandQueue.length, BATCH_SIZE);
      const batch = httpCommandQueue.splice(0, count);
      log('COMMAND', `Sending ${count} queued command(s) via HTTP batch (${httpCommandQueue.length} remaining)`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hasCommand: true, batch }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hasCommand: false }));
    }
    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', endpoints: ['/status', '/logs', '/health', '/command', '/dashboard'] }));
});

httpServer.listen(HTTP_PORT, () => {
  log('SYSTEM', `HTTP server started on http://localhost:${HTTP_PORT}`);
  console.log('');
  console.log('='.repeat(60));
  console.log('🍯 NECTAR DS - ORCHESTRATION SERVER');
  console.log('='.repeat(60));
  console.log('');
  console.log('Endpoints:');
  console.log(`  Dashboard:  http://localhost:${HTTP_PORT}/`);
  console.log(`  Status:     http://localhost:${HTTP_PORT}/status`);
  console.log(`  Logs:       http://localhost:${HTTP_PORT}/logs`);
  console.log(`  Health:     http://localhost:${HTTP_PORT}/health`);
  console.log(`  Command:    POST http://localhost:${HTTP_PORT}/command`);
  console.log('');
  console.log('WebSocket:');
  console.log(`  Plugin:     ws://localhost:${PORT}`);
  console.log('');
  console.log('Waiting for Figma plugin connection...');
  console.log('='.repeat(60));
});

// ============================================================================
// COMMAND HANDLING
// ============================================================================

function sendCommand(command, payload) {
  return new Promise((resolve, reject) => {
    const id = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const timeout = setTimeout(() => {
      pendingCommands.delete(id);
      log('ERROR', `Command ${command} timed out (id: ${id})`);
      reject(new Error(`Command timed out: ${command}`));
    }, 600000);  // 10 minute timeout for large operations

    pendingCommands.set(id, { resolve, reject, timeout, command });

    const msg = { id, type: 'command', command, payload };

    // If a WebSocket plugin is connected, send directly. Otherwise enqueue for HTTP-polled plugin clients.
    if (pluginSocket && pluginSocket.readyState === WebSocket.OPEN) {
      pluginSocket.send(JSON.stringify(msg));
      log('COMMAND', `Sent command ${command} (id: ${id}) via WebSocket`, payload);
    } else {
      httpCommandQueue.push(msg);
      log('COMMAND', `Enqueued command ${command} (id: ${id}) for HTTP-polled plugin`);
    }
  });
}

// ============================================================================
// DASHBOARD HTML
// ============================================================================

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Nectar DS - Orchestration Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }
    h1 { color: #FF90E8; margin-bottom: 20px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .card { background: #16213e; border-radius: 12px; padding: 20px; }
    .card h2 { font-size: 14px; color: #888; text-transform: uppercase; margin-bottom: 12px; }
    .status { font-size: 24px; font-weight: bold; }
    .status.ok { color: #4f4; }
    .status.err { color: #f44; }
    .stat { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #333; }
    .stat:last-child { border: none; }
    .logs { font-family: monospace; font-size: 11px; max-height: 400px; overflow-y: auto; background: #0d1117; border-radius: 8px; padding: 12px; }
    .log-entry { padding: 4px 0; border-bottom: 1px solid #222; }
    .log-time { color: #666; }
    .log-cat { font-weight: bold; margin: 0 8px; }
    .log-SYSTEM { color: #0ff; }
    .log-WS { color: #ff0; }
    .log-PLUGIN { color: #0f0; }
    .log-COMMAND { color: #88f; }
    .log-ERROR { color: #f44; }
    .log-HTTP { color: #f0f; }
    .log-RESPONSE { color: #0f0; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
    button { padding: 10px 16px; background: #FF90E8; color: #000; border: none; border-radius: 6px; cursor: pointer; font-weight: 500; }
    button:hover { background: #FFB5EF; }
    button:disabled { background: #444; color: #888; }
    .cmd-result { margin-top: 12px; background: #0d1117; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 11px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
  </style>
</head>
<body>
  <h1>🍯 Nectar DS - Orchestration Dashboard</h1>
  
  <div class="grid">
    <div class="card">
      <h2>Connection Status</h2>
      <div class="status" id="connStatus">Loading...</div>
      <div style="margin-top: 16px;">
        <div class="stat"><span>WebSocket State</span><span id="wsState">-</span></div>
        <div class="stat"><span>File Name</span><span id="fileName">-</span></div>
        <div class="stat"><span>Current Page</span><span id="pageName">-</span></div>
        <div class="stat"><span>Pending Commands</span><span id="pending">-</span></div>
        <div class="stat"><span>Uptime</span><span id="uptime">-</span></div>
      </div>
    </div>
    
    <div class="card">
      <h2>Quick Commands</h2>
      <div class="actions">
        <button onclick="sendCmd('get_file_info')">Get File Info</button>
        <button onclick="sendCmd('get_pages')">Get Pages</button>
        <button onclick="sendCmd('get_variable_collections')">Get Variables</button>
        <button onclick="sendCmd('get_local_styles')">Get Styles</button>
      </div>
      <div class="cmd-result" id="cmdResult">Click a command to see results...</div>
    </div>
  </div>
  
  <div class="card" style="margin-top: 20px;">
    <h2>Live Logs</h2>
    <div class="logs" id="logs">Loading...</div>
  </div>

  <script>
    async function refresh() {
      try {
        const res = await fetch('/status');
        const data = await res.json();
        
        document.getElementById('connStatus').textContent = data.connected ? '✅ CONNECTED' : '❌ DISCONNECTED';
        document.getElementById('connStatus').className = 'status ' + (data.connected ? 'ok' : 'err');
        document.getElementById('wsState').textContent = data.wsState;
        document.getElementById('fileName').textContent = data.fileInfo?.name || '-';
        document.getElementById('pageName').textContent = data.fileInfo?.currentPage || '-';
        document.getElementById('pending').textContent = data.pendingCommands;
        document.getElementById('uptime').textContent = Math.floor(data.uptime) + 's';
      } catch (e) {
        document.getElementById('connStatus').textContent = '⚠️ SERVER ERROR';
        document.getElementById('connStatus').className = 'status err';
      }
    }
    
    async function refreshLogs() {
      try {
        const res = await fetch('/logs/30');
        const logs = await res.json();
        
        document.getElementById('logs').innerHTML = logs.map(l => 
          '<div class="log-entry"><span class="log-time">' + l.time.split('T')[1].split('.')[0] + '</span>' +
          '<span class="log-cat log-' + l.category + '">[' + l.category + ']</span>' +
          '<span>' + l.message + '</span></div>'
        ).join('');
      } catch (e) {
        document.getElementById('logs').textContent = 'Error loading logs';
      }
    }
    
    async function sendCmd(cmd) {
      document.getElementById('cmdResult').textContent = 'Sending ' + cmd + '...';
      try {
        const res = await fetch('/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cmd, payload: {} })
        });
        const data = await res.json();
        document.getElementById('cmdResult').textContent = JSON.stringify(data, null, 2);
        refreshLogs();
      } catch (e) {
        document.getElementById('cmdResult').textContent = 'Error: ' + e.message;
      }
    }
    
    // Auto-refresh
    setInterval(refresh, 2000);
    setInterval(refreshLogs, 3000);
    refresh();
    refreshLogs();
  </script>
</body>
</html>`;
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down orchestration server...');
  wss.close();
  httpServer.close();
  process.exit(0);
});

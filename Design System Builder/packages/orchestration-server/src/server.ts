/**
 * Orchestration Server — HTTP + WebSocket bridge between
 * MCP server and Figma plugin.
 *
 * Core routes:
 *   POST /command       — MCP server enqueues a command
 *   GET  /poll          — Plugin polls for pending commands
 *   POST /response      — Plugin returns command results
 *   POST /register      — Plugin registration + heartbeat
 *   GET  /status        — Connection and queue status
 *   GET  /health        — Health check
 *   POST /batch         — MCP server enqueues multiple commands
 *   DELETE /queue       — Clear pending commands (emergency stop)
 *
 * Config UI routes:
 *   GET    /config-ui       — Serve HTML wizard
 *   POST   /config-results  — Receive encrypted config from browser
 *   GET    /config-results  — Claude polls for config
 *   DELETE /config-results  — Claude clears config
 *   POST   /validate-license — License key validation
 *
 * Build status routes:
 *   GET /build-status — Real-time build progress
 *
 * Telemetry routes:
 *   POST /telemetry — Receive anonymized usage events
 *
 * Tamper / lockdown routes:
 *   POST /tamper-alert       — Daemon reports tampering
 *   GET  /lockdown-status    — Query lockdown state
 *   POST /lockdown/lift      — Lift lockdown
 *   POST /daemon/heartbeat   — Daemon heartbeat
 *   POST /daemon/update-mode — Enter update mode
 *   POST /daemon/resume-mode — Exit update mode
 *
 * WebSocket (ws://localhost:PORT/ws):
 *   MCP server can push commands and receive results in real time.
 *
 * @module orchestration-server/server
 */

import express from 'express';
import cors from 'cors';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { CommandQueue } from './command-queue';
import type { QueuedCommand, CommandResult } from './command-queue';
import { PluginRegistry } from './plugin-registry';
import { createConfigUiRouter } from './config-ui-routes';
import { createBuildStatusRouter } from './build-status-routes';
import { createTelemetryRouter } from './telemetry-routes';
import { createTamperRouter } from './tamper-routes';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface ServerConfig {
  readonly port: number;
  readonly sessionToken?: string;
  readonly enableWebSocket?: boolean;
  /** Analytics endpoint URL for telemetry forwarding. */
  readonly telemetryEndpoint?: string;
  /** Whether telemetry is opted in at startup. */
  readonly telemetryOptedIn?: boolean;
  /** Heartbeat timeout for tamper daemon (ms). */
  readonly heartbeatTimeoutMs?: number;
}

// ============================================================================
// SECTION 2: SESSION TOKEN AUTH
// ============================================================================

function createAuthMiddleware(sessionToken: string | undefined) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    if (!sessionToken) {
      next();
      return;
    }

    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${sessionToken}`) {
      res.status(401).json({ error: 'Invalid or missing session token.' });
      return;
    }

    next();
  };
}

// ============================================================================
// SECTION 3: SERVER CREATION
// ============================================================================

export function createServer(config: ServerConfig) {
  const app = express();
  const queue = new CommandQueue();
  const registry = new PluginRegistry();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const auth = createAuthMiddleware(config.sessionToken);

  // Track connected WebSocket clients for broadcast
  const wsClients: Set<WebSocket> = new Set();

  // ─── Health ─────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      queue: queue.getStats(),
      cache: queue.getCacheStats(),
      plugins: registry.getStatus(),
    });
  });

  // ─── Status ─────────────────────────────────────────────────────────
  app.get('/status', auth, (_req, res) => {
    res.json({
      queue: queue.getStats(),
      cache: queue.getCacheStats(),
      plugins: registry.getStatus(),
      wsClients: wsClients.size,
    });
  });

  // ─── Command Enqueue (MCP → Queue) ─────────────────────────────────
  app.post('/command', auth, async (req, res) => {
    const { type, payload } = req.body;

    if (!type) {
      res.status(400).json({ error: 'Missing "type" field.' });
      return;
    }

    if (!registry.hasConnectedPlugin()) {
      res.status(503).json({
        error: 'No Figma plugin connected. Open Figma and run the DSB plugin.',
      });
      return;
    }

    const command: QueuedCommand = {
      id: randomUUID(),
      type,
      payload: payload || {},
      enqueuedAt: Date.now(),
    };

    // Wait for the result (blocking until plugin processes it)
    try {
      const result = await queue.enqueue(command);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Command failed: ' + String(err) });
    }
  });

  // ─── Batch Command Enqueue ──────────────────────────────────────────
  app.post('/batch', auth, async (req, res) => {
    const { commands } = req.body;

    if (!Array.isArray(commands) || commands.length === 0) {
      res.status(400).json({ error: 'Missing or empty "commands" array.' });
      return;
    }

    if (!registry.hasConnectedPlugin()) {
      res.status(503).json({
        error: 'No Figma plugin connected. Open Figma and run the DSB plugin.',
      });
      return;
    }

    const queued: QueuedCommand[] = commands.map((cmd: { type: string; payload?: Record<string, unknown> }) => ({
      id: randomUUID(),
      type: cmd.type,
      payload: cmd.payload || {},
      enqueuedAt: Date.now(),
    }));

    // Enqueue all and wait for all results
    const resultPromises = queued.map(cmd => queue.enqueue(cmd));
    const results = await Promise.all(resultPromises);

    res.json({ results });
  });

  // ─── Poll (Plugin → Queue) ─────────────────────────────────────────
  app.get('/poll', auth, (_req, res) => {
    const commands = queue.dequeue(10);
    res.json({ commands });
  });

  // ─── Response (Plugin → Queue) ──────────────────────────────────────
  app.post('/response', auth, (req, res) => {
    const result: CommandResult = {
      commandId: req.body.commandId,
      success: req.body.success,
      data: req.body.data,
      error: req.body.error,
      completedAt: Date.now(),
    };

    queue.resolve(result);

    // Broadcast result to WebSocket clients
    broadcastToWs(wsClients, {
      type: 'result',
      result,
    });

    res.json({ ok: true });
  });

  // ─── Register (Plugin heartbeat) ────────────────────────────────────
  app.post('/register', auth, (req, res) => {
    const { pluginId } = req.body;

    if (!pluginId) {
      res.status(400).json({ error: 'Missing "pluginId" field.' });
      return;
    }

    const registration = registry.register(pluginId);
    res.json({
      ok: true,
      registeredAt: registration.registeredAt,
      connected: registration.connected,
    });
  });

  // ─── Clear Queue (Emergency Stop) ──────────────────────────────────
  app.delete('/queue', auth, (_req, res) => {
    const cleared = queue.clearPending();
    res.json({ cleared, message: `Cleared ${cleared} pending commands.` });
  });

  // ─── Clear Cache (Flush extraction data) ──────────────────────────
  app.delete('/cache', auth, (_req, res) => {
    const before = queue.getCacheStats();
    queue.clearCache();
    res.json({ cleared: before.entries, freedBytes: before.totalBytes });
  });

  // ─── Source Data Store (cross-file pipeline) ───────────────────────
  let sourceData: { data: unknown; fileName: string; extractedAt: string } | null = null;

  app.post('/source-data', auth, (req, res) => {
    const { data, fileName, extractedAt } = req.body;
    if (!data) {
      res.status(400).json({ error: 'Missing "data" field.' });
      return;
    }
    sourceData = { data, fileName: fileName || 'unknown', extractedAt: extractedAt || new Date().toISOString() };
    res.json({ ok: true, fileName: sourceData.fileName, extractedAt: sourceData.extractedAt });
  });

  app.get('/source-data', auth, (_req, res) => {
    if (!sourceData) {
      res.status(404).json({ error: 'No source data cached. Extract from source file first.' });
      return;
    }
    res.json(sourceData);
  });

  app.delete('/source-data', auth, (_req, res) => {
    const had = !!sourceData;
    sourceData = null;
    res.json({ cleared: had });
  });

  // ─── Command Result Query ──────────────────────────────────────────
  app.get('/result/:commandId', auth, (req, res) => {
    const result = queue.getResult(String(req.params.commandId));
    if (!result) {
      res.status(404).json({ error: 'Result not found.' });
      return;
    }
    res.json(result);
  });

  // ─── Mount Config UI Routes ──────────────────────────────────────────
  const configUiRouter = createConfigUiRouter(auth);
  app.use(configUiRouter);

  // ─── Mount Build Status Routes ───────────────────────────────────────
  const buildStatusRouter = createBuildStatusRouter();
  app.use(buildStatusRouter);

  // ─── Mount Telemetry Routes ──────────────────────────────────────────
  const telemetry = createTelemetryRouter({
    analyticsEndpoint: config.telemetryEndpoint || 'https://analytics.dsb.example/events',
    optedIn: config.telemetryOptedIn ?? false,
  });
  app.use(telemetry.router);

  // ─── Mount Tamper / Lockdown Routes ──────────────────────────────────
  const tamper = createTamperRouter(auth, {
    heartbeatTimeoutMs: config.heartbeatTimeoutMs,
  });
  app.use(tamper.router);

  // ─── Create HTTP Server ─────────────────────────────────────────────
  const httpServer = http.createServer(app);

  // ─── WebSocket Setup ────────────────────────────────────────────────
  let wss: WebSocketServer | null = null;

  if (config.enableWebSocket !== false) {
    wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    wss.on('connection', (ws, req) => {
      // Validate session token from query parameter
      if (config.sessionToken) {
        const url = new URL(req.url || '', `http://localhost:${config.port}`);
        const token = url.searchParams.get('token');
        if (token !== config.sessionToken) {
          ws.close(4001, 'Invalid session token');
          return;
        }
      }

      wsClients.add(ws);

      ws.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'command') {
            if (!registry.hasConnectedPlugin()) {
              ws.send(JSON.stringify({
                type: 'error',
                error: 'No Figma plugin connected.',
                requestId: msg.requestId,
              }));
              return;
            }

            const command: QueuedCommand = {
              id: msg.id || randomUUID(),
              type: msg.commandType,
              payload: msg.payload || {},
              enqueuedAt: Date.now(),
            };

            const result = await queue.enqueue(command);
            ws.send(JSON.stringify({
              type: 'result',
              result,
              requestId: msg.requestId,
            }));
          }

          if (msg.type === 'status') {
            ws.send(JSON.stringify({
              type: 'status',
              queue: queue.getStats(),
              plugins: registry.getStatus(),
              requestId: msg.requestId,
            }));
          }
        } catch (err) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message: ' + String(err),
          }));
        }
      });

      ws.on('close', () => {
        wsClients.delete(ws);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        queue: queue.getStats(),
        plugins: registry.getStatus(),
      }));
    });
  }

  // ─── Return Server Handle ──────────────────────────────────────────

  return {
    app,
    httpServer,
    wss,
    queue,
    registry,

    /** Lockdown manager — check isLocked() before MCP tool execution. */
    lockdown: tamper.lockdown,

    /** Telemetry control — toggle opt-in, get stats. */
    telemetry: {
      setOptedIn: telemetry.setOptedIn,
      getStats: telemetry.getStats,
    },

    /** Active update token for daemon communication. */
    getUpdateToken: tamper.getUpdateToken,

    start(): Promise<void> {
      return new Promise((resolve) => {
        httpServer.listen(config.port, () => {
          console.log(`DSB Orchestration Server running on port ${config.port}`);
          if (wss) {
            console.log(`WebSocket available at ws://localhost:${config.port}/ws`);
          }
          resolve();
        });
      });
    },

    async stop(): Promise<void> {
      // Stop subsystems
      await telemetry.stop();
      tamper.destroy();

      queue.destroyCache();
      queue.reset();
      registry.destroy();

      for (const ws of wsClients) {
        ws.close(1001, 'Server shutting down');
      }
      wsClients.clear();

      if (wss) {
        wss.close();
      }

      return new Promise((resolve) => {
        httpServer.close(() => {
          resolve();
        });
      });
    },
  };
}

// ============================================================================
// SECTION 4: HELPERS
// ============================================================================

function broadcastToWs(clients: Set<WebSocket>, message: unknown): void {
  const data = JSON.stringify(message);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { callContext } from "./call-context.js";
import type { BridgeRequest, BridgeResponse, ConnectedFile } from "./types.js";

interface PendingRequest {
  resolve: (resp: BridgeResponse) => void;
  reject: (err: Error) => void;
  /** Stall timer: refreshed by every plugin heartbeat that lists this request. */
  timeout: ReturnType<typeof setTimeout>;
  ws: WebSocket;
  fileKey: string;
  startedAt: number;
  /** Forwards heartbeats to the MCP client as progress (see call-context.ts). */
  onProgress?: () => void;
  /** Detaches the MCP-client cancel listener. */
  detachAbort?: () => void;
  /** Set while the plugin's socket is gone; a reconnected plugin that still
   *  lists the request (sync heartbeat) clears it and re-adopts the request. */
  orphanTimer: ReturnType<typeof setTimeout> | null;
}

interface ConnectionEntry {
  ws: WebSocket;
  fileKey: string;
  fileName: string;
  isAlive: boolean;
}

/** Plugin heartbeat: the requests it is still working on (queued or running).
 *  `sync` marks the first one after a (re)connect: it lists EVERYTHING the
 *  plugin knows about, so an orphaned request missing from it was lost. */
interface ProgressPayload {
  requestIds?: unknown;
  sync?: unknown;
}

/** Silence allowed before a request fails: no response and no heartbeat. */
const DEFAULT_TIMEOUT_MS = 30_000;
/** Cap on a caller-provided silence window. */
const MAX_TIMEOUT_MS = 300_000;
/** Absolute ceiling for one request, however long the plugin keeps reporting progress. */
export const HARD_CAP_MS = 30 * 60_000;
/** A request may run this many times its silence window before the plugin
 *  treats it as stuck — a hung await still lets heartbeats fire, so without a
 *  budget it would hold the edit queue until the hard cap. */
const RUN_BUDGET_FACTOR = 4;
const MIN_RUN_BUDGET_MS = 60_000;
/** How long in-flight requests survive a dropped plugin socket, waiting for it to reconnect. */
const RECONNECT_GRACE_MS = 15_000;
const PING_INTERVAL_MS = 30_000;

export interface BridgeOptions {
  hardCapMs?: number;
  reconnectGraceMs?: number;
  pingIntervalMs?: number;
}

export class Bridge {
  private wss: WebSocketServer;
  private connections = new Map<string, ConnectionEntry>();
  private pending = new Map<string, PendingRequest>();
  private counter = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private readonly hardCapMs: number;
  private readonly reconnectGraceMs: number;
  /** Invoked for plugin-initiated events (no requestId), e.g. doc-event. */
  onPluginEvent: ((fileKey: string, type: string, payload: Record<string, unknown>) => void) | null = null;
  /** Invoked when a plugin connection is established or lost for a fileKey. */
  onConnectionChange: ((fileKey: string, connected: boolean) => void) | null = null;

  constructor(options: BridgeOptions = {}) {
    this.hardCapMs = options.hardCapMs ?? HARD_CAP_MS;
    this.reconnectGraceMs = options.reconnectGraceMs ?? RECONNECT_GRACE_MS;
    this.wss = new WebSocketServer({ noServer: true });

    this.pingTimer = setInterval(() => {
      for (const [fileKey, entry] of this.connections) {
        if (!entry.isAlive) {
          entry.ws.terminate();
          this.connections.delete(fileKey);
          console.error(
            `Plugin dead (no pong): ${entry.fileName} (${fileKey})`
          );
          continue;
        }
        entry.isAlive = false;
        entry.ws.ping();
      }
    }, options.pingIntervalMs ?? PING_INTERVAL_MS);
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    if (request.url == undefined) {
      console.error("Plugin connected without url, rejecting");
      socket.destroy();
      return;
    }

    const url = new URL(request.url, "http://localhost");
    const { fileKey, fileName = "Unknown" } = Object.fromEntries(
      url.searchParams
    );

    if (!fileKey) {
      console.error("Plugin connected without fileKey, rejecting");
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.handleConnection(ws, fileKey, fileName);
    });
  }

  private handleConnection(
    ws: WebSocket,
    fileKey: string,
    fileName: string
  ): void {
    // Replace existing connection for the same file
    const existing = this.connections.get(fileKey);
    if (existing) {
      existing.ws.close();
    }
    this.connections.set(fileKey, {
      ws,
      fileKey,
      fileName,
      isAlive: true,
    });
    console.error(`Plugin connected: ${fileName} (${fileKey})`);
    this.onConnectionChange?.(fileKey, true);

    ws.on("pong", () => {
      const entry = this.connections.get(fileKey);
      if (entry && entry.ws === ws) entry.isAlive = true;
    });

    ws.on("message", (data) => {
      try {
        const resp = JSON.parse(data.toString()) as BridgeResponse & {
          payload?: Record<string, unknown>;
        };
        if (!resp.requestId && resp.type === "progress") {
          this.handleProgress(ws, fileKey, resp.payload ?? {});
          return;
        }
        if (!resp.requestId && resp.type && this.onPluginEvent) {
          // Plugin-initiated event (doc-event, etc.) — no pending request.
          this.onPluginEvent(fileKey, resp.type, resp.payload ?? {});
          return;
        }
        // Matched by id, not by socket: a response the plugin buffered while
        // disconnected arrives on its new socket and still settles the request.
        const pending = this.pending.get(resp.requestId);
        if (pending) {
          this.settle(resp.requestId, pending);
          pending.resolve(resp);
        }
      } catch {
        console.error("Invalid response from plugin");
      }
    });

    ws.on("close", () => {
      const current = this.connections.get(fileKey);
      if (current?.ws === ws) {
        this.connections.delete(fileKey);
        console.error(`Plugin disconnected: ${fileName} (${fileKey})`);
        this.onConnectionChange?.(fileKey, false);
      }
      this.orphanPendingForSocket(
        ws,
        `Plugin disconnected: ${fileName} (${fileKey})`
      );
    });

    ws.on("error", (err) => {
      console.error("WebSocket error:", err.message);
      const current = this.connections.get(fileKey);
      if (current?.ws === ws) {
        this.connections.delete(fileKey);
        this.onConnectionChange?.(fileKey, false);
      }
      this.orphanPendingForSocket(
        ws,
        `Plugin connection error (${fileName}): ${err.message}`
      );
    });
  }

  /** A heartbeat keeps every request it lists alive; a sync heartbeat also
   *  re-adopts orphaned requests the plugin still has and fails the rest. */
  private handleProgress(
    ws: WebSocket,
    fileKey: string,
    payload: ProgressPayload
  ): void {
    const ids = Array.isArray(payload.requestIds)
      ? payload.requestIds.filter((id): id is string => typeof id === "string")
      : [];
    const live = new Set(ids);
    for (const id of live) {
      const p = this.pending.get(id);
      if (!p || p.fileKey !== fileKey) continue;
      if (p.orphanTimer) {
        clearTimeout(p.orphanTimer);
        p.orphanTimer = null;
        p.ws = ws;
      }
      if (Date.now() - p.startedAt < this.hardCapMs) p.timeout.refresh();
      p.onProgress?.();
    }
    if (payload.sync !== true) return;
    for (const [id, p] of this.pending) {
      if (p.fileKey !== fileKey || !p.orphanTimer || live.has(id)) continue;
      this.settle(id, p);
      p.reject(
        new Error(
          `Plugin reconnected without this request: it was never delivered, or the plugin restarted while running it. ` +
            `Verify with a read before retrying a mutation.`
        )
      );
    }
  }

  /** Keeps a dead socket's requests for a grace period instead of failing
   *  them at once, so a plugin that reconnects can still finish them. */
  private orphanPendingForSocket(ws: WebSocket, reason: string): void {
    for (const [id, p] of this.pending) {
      if (p.ws !== ws || p.orphanTimer) continue;
      p.orphanTimer = setTimeout(() => {
        if (this.pending.get(id) !== p) return;
        this.settle(id, p);
        p.reject(
          new Error(
            `${reason}, and it did not reconnect within ${this.reconnectGraceMs}ms. ` +
              `The request may or may not have run — verify with a read before retrying a mutation.`
          )
        );
      }, this.reconnectGraceMs);
    }
  }

  private settle(id: string, p: PendingRequest): void {
    clearTimeout(p.timeout);
    if (p.orphanTimer) clearTimeout(p.orphanTimer);
    p.detachAbort?.();
    this.pending.delete(id);
  }

  /** Tells the plugin to drop a request the server gave up on. One still
   *  queued behind other edits is skipped; one already running finishes. */
  private sendCancel(p: PendingRequest, requestId: string): void {
    const conn = this.connections.get(p.fileKey)?.ws;
    if (!conn || conn.readyState !== WebSocket.OPEN) return;
    conn.send(JSON.stringify({ type: "cancel", requestId }), () => {
      /* best-effort */
    });
  }

  /**
   * Resolve which connection to use.
   * - If fileKey is provided, use that specific connection.
   * - If only one file is connected and no fileKey given, use it (backward compat).
   * - If multiple files connected and no fileKey, throw with a helpful message.
   */
  private resolveConnection(fileKey?: string): ConnectionEntry {
    if (fileKey) {
      const entry = this.connections.get(fileKey);
      if (!entry) {
        const available = this.listConnectedFiles();
        const hint =
          available.length > 0
            ? ` Connected files: ${available.map((f) => `"${f.fileName}" (fileKey: ${f.fileKey})`).join(", ")}`
            : " No files are currently connected.";
        throw new Error(`No plugin connected for fileKey "${fileKey}".${hint}`);
      }
      return entry;
    }

    if (this.connections.size === 0) {
      throw new Error(
        "No plugin connected. Open a Figma file and run the bridge plugin."
      );
    }

    if (this.connections.size === 1) {
      return this.connections.values().next().value!;
    }

    const files = this.listConnectedFiles();
    throw new Error(
      `Multiple files connected. Specify a fileKey to choose which file to query. Connected files: ${files.map((f) => `"${f.fileName}" (fileKey: ${f.fileKey})`).join(", ")}. Use the list_files tool to see all connected files.`
    );
  }

  listConnectedFiles(): ConnectedFile[] {
    return [...this.connections.values()].map((entry) => ({
      fileKey: entry.fileKey,
      fileName: entry.fileName,
    }));
  }

  isConnected(fileKey: string): boolean {
    return this.connections.has(fileKey);
  }

  send(
    requestType: string,
    nodeIds?: string[],
    fileKey?: string
  ): Promise<BridgeResponse> {
    return this.sendWithParams(requestType, nodeIds, undefined, fileKey);
  }

  /**
   * `timeoutMs` is a STALL window, not a total deadline: the request fails
   * only after that long with neither a response nor a plugin heartbeat
   * listing it. A plugin that keeps reporting progress can run up to the hard
   * cap. Plugin builds without heartbeats get the old absolute timeout.
   */
  sendWithParams(
    requestType: string,
    nodeIds?: string[],
    params?: Record<string, unknown>,
    fileKey?: string,
    timeoutMs?: number
  ): Promise<BridgeResponse> {
    return new Promise((resolve, reject) => {
      let entry: ConnectionEntry;
      try {
        entry = this.resolveConnection(fileKey);
      } catch (err) {
        reject(err);
        return;
      }
      const conn = entry.ws;

      if (conn.readyState !== WebSocket.OPEN) {
        reject(new Error("Plugin not connected"));
        return;
      }
      const ctx = callContext.getStore();
      if (ctx?.signal?.aborted) {
        reject(new Error("Cancelled by the MCP client before it was sent to the plugin."));
        return;
      }

      const requestId = this.nextId();
      const request: BridgeRequest = {
        type: requestType,
        requestId,
      };
      if (nodeIds && nodeIds.length > 0) {
        request.nodeIds = nodeIds;
      }
      if (params && Object.keys(params).length > 0) {
        request.params = params;
      }

      const stallMs = Math.min(
        timeoutMs && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
        MAX_TIMEOUT_MS
      );
      request.budgetMs = Math.max(MIN_RUN_BUDGET_MS, stallMs * RUN_BUDGET_FACTOR);
      const timeout = setTimeout(() => {
        const p = this.pending.get(requestId);
        if (!p) return;
        this.settle(requestId, p);
        this.sendCancel(p, requestId);
        const elapsed = Date.now() - p.startedAt;
        const why =
          elapsed >= this.hardCapMs
            ? `it ran past the ${this.hardCapMs}ms hard cap`
            : `no response or progress from the plugin for ${stallMs}ms`;
        reject(
          new Error(
            `Request timed out after ${elapsed}ms: ${why}. A cancel was sent — if it was still queued behind other edits it will not run, ` +
              `but if it had started it may still finish. Verify with a read before retrying a mutation.`
          )
        );
      }, stallMs);

      const pendingRequest: PendingRequest = {
        resolve,
        reject,
        timeout,
        ws: conn,
        fileKey: entry.fileKey,
        startedAt: Date.now(),
        onProgress: ctx?.onProgress,
        orphanTimer: null,
      };
      const signal = ctx?.signal;
      if (signal) {
        const onAbort = () => {
          if (this.pending.get(requestId) !== pendingRequest) return;
          this.settle(requestId, pendingRequest);
          this.sendCancel(pendingRequest, requestId);
          reject(
            new Error(
              "Cancelled by the MCP client. A cancel was sent — if it was still queued behind other edits it will not run, " +
                "but if it had started it may still finish. Verify with a read before retrying a mutation."
            )
          );
        };
        signal.addEventListener("abort", onAbort, { once: true });
        pendingRequest.detachAbort = () => signal.removeEventListener("abort", onAbort);
      }
      this.pending.set(requestId, pendingRequest);

      conn.send(JSON.stringify(request), (err) => {
        if (err) {
          const p = this.pending.get(requestId);
          if (p) this.settle(requestId, p);
          reject(err);
        }
      });
    });
  }

  private nextId(): string {
    this.counter++;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `req-${hh}${mm}${ss}-${this.counter}`;
  }

  close(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    // Reject all pending requests
    for (const [id, p] of this.pending) {
      this.settle(id, p);
      p.reject(new Error("Bridge closed"));
    }

    for (const [, entry] of this.connections) {
      entry.ws.close();
    }
    this.connections.clear();
    this.wss.close();
  }
}

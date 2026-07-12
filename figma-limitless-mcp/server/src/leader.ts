import http from "node:http";
import type { Duplex } from "node:stream";
import { Bridge } from "./bridge.js";
import { validateRpc } from "./schema.js";
import { executeSaveScreenshots } from "./tools.js";
import type { ExportFormat } from "./tools.js";
import type { BridgeResponse, RPCRequest, RPCResponse } from "./types.js";
import { VERSION } from "./version.js";
import {
  Orchestrator,
  META_TOOLS,
  JOURNALED_TOOLS,
  NON_INVALIDATING_TOOLS,
  journalPreview,
} from "./orchestration.js";

/**
 * Leader owns the WebSocket bridge to Figma and exposes HTTP endpoints for followers.
 * Endpoints:
 *   /ws   — WebSocket upgrade for the Figma plugin
 *   /ping — Health check
 *   /rpc  — JSON RPC for follower tool calls
 */
export class Leader {
  private bridge: Bridge;
  private server: http.Server | null = null;
  private orchestrator: Orchestrator;

  constructor(private port: number) {
    this.bridge = new Bridge();
    this.orchestrator = new Orchestrator();
    this.bridge.onPluginEvent = (fileKey, type, payload) => {
      if (type === "doc-event") {
        this.orchestrator.recordDocEvent(fileKey, payload);
      }
    };
    // Edits made while the plugin is closed produce no events — a cached
    // digest from a previous connection is unverifiable, so drop it on both
    // connect and disconnect.
    this.bridge.onConnectionChange = (fileKey) => {
      this.orchestrator.dropFileState(fileKey);
    };
  }

  getBridge(): Bridge {
    return this.bridge;
  }

  /**
   * Single execution choke point for every tool call on this leader —
   * from its own MCP client (via Node) AND from followers (via /rpc).
   * Meta tools resolve locally; get_file_digest is served from cache when
   * no doc-events arrived since it was cached; everything else forwards
   * to the plugin, and mutations are journaled.
   */
  async execute(
    tool: string,
    nodeIds: string[] | undefined,
    params: Record<string, unknown> | undefined,
    fileKey: string | undefined,
    agent: string | undefined,
    timeoutMs: number | undefined
  ): Promise<BridgeResponse> {
    const wrap = (data: unknown): BridgeResponse => ({
      type: tool,
      requestId: "",
      data,
    });

    if (META_TOOLS.has(tool)) {
      // Bucket meta state under the single connected file when the caller
      // didn't specify one — checkpoints and journal entries must land in
      // the same bucket.
      const resolvedMetaKey = this.resolveSingleFileKey(fileKey);
      const metaParams: Record<string, unknown> = {
        ...(params ?? {}),
        ...(resolvedMetaKey ? { fileKey: resolvedMetaKey } : {}),
      };
      if (typeof metaParams.agent !== "string" && agent) {
        metaParams.agent = agent;
      }
      return wrap(
        this.orchestrator.handleMeta(
          tool,
          metaParams,
          this.bridge.listConnectedFiles()
        )
      );
    }

    if (tool === "get_file_digest") {
      const scope =
        typeof params?.scope === "string" ? params.scope : "current-page";
      const resolvedKey = this.resolveSingleFileKey(fileKey);
      // Serve from cache only for a CURRENTLY CONNECTED file — otherwise a
      // stale digest would mask the "no plugin connected" state entirely.
      if (resolvedKey && this.bridge.isConnected(resolvedKey)) {
        const cached = this.orchestrator.getCachedDigest(resolvedKey, scope);
        if (cached) {
          return wrap({
            cached: true,
            cacheAgeS: Math.round((Date.now() - cached.cachedAt) / 1000),
            ...(cached.digest as Record<string, unknown>),
          });
        }
      }
      // Baseline BEFORE the fetch: events landing while the plugin computes
      // the digest must invalidate it, not get folded into the baseline.
      const baseline = resolvedKey
        ? this.orchestrator.getActivityCount(resolvedKey)
        : 0;
      const resp = await this.bridge.sendWithParams(
        tool,
        nodeIds,
        params,
        fileKey,
        timeoutMs
      );
      if (!resp.error && resolvedKey) {
        this.orchestrator.storeDigest(resolvedKey, scope, resp.data, baseline);
      }
      return resp;
    }

    const startedAt = Date.now();
    try {
      const resp = await this.bridge.sendWithParams(
        tool,
        nodeIds,
        params,
        fileKey,
        timeoutMs
      );
      this.journal(tool, nodeIds, params, fileKey, agent, !resp.error, resp.error, startedAt);
      return resp;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.journal(tool, nodeIds, params, fileKey, agent, false, message, startedAt);
      throw err;
    }
  }

  private journal(
    tool: string,
    nodeIds: string[] | undefined,
    params: Record<string, unknown> | undefined,
    fileKey: string | undefined,
    agent: string | undefined,
    ok: boolean,
    error: string | undefined,
    startedAt: number
  ): void {
    if (!JOURNALED_TOOLS.has(tool)) return;
    const resolvedKey = this.resolveSingleFileKey(fileKey) ?? "global";
    this.orchestrator.record({
      agent: agent ?? "unknown",
      tool,
      fileKey: resolvedKey,
      nodeIds,
      preview: journalPreview(params),
      ok,
      error,
      durMs: Date.now() - startedAt,
    });
    if (ok && resolvedKey !== "global" && !NON_INVALIDATING_TOOLS.has(tool)) {
      // Our own writes must invalidate the digest cache even if the plugin's
      // page-scoped change events miss them (e.g. style-only mutations).
      this.orchestrator.recordDocEvent(resolvedKey, {
        changes: 1,
        kinds: { SERVER_WRITE: 1 },
      });
    }
  }

  /** fileKey if given, else the single connected file's key, else null. */
  private resolveSingleFileKey(fileKey?: string): string | null {
    if (fileKey) return fileKey;
    const files = this.bridge.listConnectedFiles();
    return files.length === 1 ? files[0].fileKey : null;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (req.url === "/ping" && req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok", version: VERSION }));
          return;
        }

        if (req.url === "/rpc" && req.method === "POST") {
          this.handleRPC(req, res);
          return;
        }

        res.writeHead(404);
        res.end("Not found");
      });

      server.on(
        "upgrade",
        (req: http.IncomingMessage, socket: Duplex, head: Buffer) => {
          const pathname = new URL(req.url ?? "", "http://localhost").pathname;
          if (pathname === "/ws") {
            this.bridge.handleUpgrade(req, socket, head);
          } else {
            socket.destroy();
          }
        }
      );

      // Fail fast if port is already in use
      server.once("error", (err: NodeJS.ErrnoException) => {
        reject(
          err.code === "EADDRINUSE"
            ? new Error(`Port ${this.port} already in use`)
            : err
        );
      });

      server.listen(this.port, () => {
        this.server = server;
        console.error(`Leader listening on :${this.port}`);
        resolve();
      });
    });
  }

  private handleRPC(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const rpcReq: RPCRequest = JSON.parse(body);

        // Handle list_files as a special RPC (not forwarded to plugin)
        if (rpcReq.tool === "list_files") {
          this.sendJSON(res, 200, {
            data: this.bridge.listConnectedFiles(),
          });
          return;
        }

        const validationError = validateRpc(
          rpcReq.tool,
          rpcReq.nodeIds,
          rpcReq.params
        );
        if (validationError) {
          this.sendJSON(res, 400, { error: validationError });
          return;
        }

        const fileKey = rpcReq.fileKey;

        // Currently the only tool that is not forwarded to the plugin is save_screenshots
        // If more are added we need to refactor to a better abstraction.
        if (rpcReq.tool === "save_screenshots") {
          const params = rpcReq.params ?? {};
          // Create a sender bound to the specific fileKey
          const sender = {
            sendWithParams: (
              requestType: string,
              nodeIds?: string[],
              sendParams?: Record<string, unknown>
            ) =>
              this.bridge.sendWithParams(
                requestType,
                nodeIds,
                sendParams,
                fileKey
              ),
          };
          const result = await executeSaveScreenshots(
            sender,
            params.items as Parameters<typeof executeSaveScreenshots>[1],
            params.format as ExportFormat | undefined,
            params.scale as number | undefined,
            params.clip as boolean | undefined
          );
          this.sendJSON(res, 200, { data: result });
          return;
        }

        const resp = await this.execute(
          rpcReq.tool,
          rpcReq.nodeIds,
          rpcReq.params,
          fileKey,
          rpcReq.agent,
          rpcReq.timeoutMs
        );

        this.sendJSON(
          res,
          200,
          resp.error ? { error: resp.error } : { data: resp.data }
        );
      } catch (err) {
        this.sendJSON(res, 200, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  private sendJSON(
    res: http.ServerResponse,
    status: number,
    body: RPCResponse
  ): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }

  stop(): void {
    this.bridge.close();
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

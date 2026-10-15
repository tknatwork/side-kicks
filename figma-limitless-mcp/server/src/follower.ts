import { HARD_CAP_MS } from "./bridge.js";
import { callContext } from "./call-context.js";
import type { BridgeResponse, ConnectedFile, RPCRequest, RPCResponse, SendOpts } from "./types.js";

/**
 * Follower proxies MCP tool calls to the leader via HTTP /rpc.
 */
export class Follower {
  constructor(private leaderUrl: string) {}

  send(
    requestType: string,
    nodeIds?: string[],
    fileKey?: string
  ): Promise<BridgeResponse> {
    return this.sendWithParams(requestType, nodeIds, undefined, fileKey);
  }

  async sendWithParams(
    requestType: string,
    nodeIds?: string[],
    params?: Record<string, unknown>,
    fileKey?: string,
    opts?: SendOpts
  ): Promise<BridgeResponse> {
    const rpcReq: RPCRequest = { tool: requestType };
    if (nodeIds && nodeIds.length > 0) rpcReq.nodeIds = nodeIds;
    if (params && Object.keys(params).length > 0) rpcReq.params = params;
    if (fileKey) rpcReq.fileKey = fileKey;
    if (opts?.agent) rpcReq.agent = opts.agent;
    if (opts?.timeoutMs) rpcReq.timeoutMs = opts.timeoutMs;

    // timeoutMs is a stall window on the leader: a plugin that keeps sending
    // heartbeats can run until the leader's hard cap, so the HTTP layer waits
    // for that (the leader always answers by then) plus headroom.
    const httpTimeout = HARD_CAP_MS + 5_000;
    // A cancel from this follower's MCP client hangs up on the leader, which
    // passes it on to the plugin as a cancel.
    const timeoutSignal = AbortSignal.timeout(httpTimeout);
    const clientSignal = callContext.getStore()?.signal;
    const response = await fetch(`${this.leaderUrl}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcReq),
      // AbortSignal.any needs Node 20.3+; engines allow 20.0, which then just
      // loses cancel passthrough.
      signal:
        clientSignal && typeof AbortSignal.any === "function"
          ? AbortSignal.any([clientSignal, timeoutSignal])
          : timeoutSignal,
    });

    if (!response.ok) {
      throw new Error(`Leader returned status ${response.status}`);
    }

    const rpcResp = (await response.json()) as RPCResponse;

    if (rpcResp.error) {
      throw new Error(rpcResp.error);
    }

    return {
      type: requestType,
      requestId: "",
      data: rpcResp.data,
    };
  }

  async listConnectedFiles(): Promise<ConnectedFile[]> {
    const response = await fetch(`${this.leaderUrl}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "list_files" } as RPCRequest),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`Leader returned status ${response.status}`);
    }

    const rpcResp = (await response.json()) as RPCResponse;
    if (rpcResp.error) {
      throw new Error(rpcResp.error);
    }

    return (rpcResp.data as ConnectedFile[]) ?? [];
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.leaderUrl}/ping`, {
        signal: AbortSignal.timeout(2_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

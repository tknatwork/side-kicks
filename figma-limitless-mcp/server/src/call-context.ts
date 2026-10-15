import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Hooks from the MCP request a tool call is serving, carried to the bridge
 * through async context instead of being threaded through every tool handler.
 */
export interface CallContext {
  /** Called on each plugin heartbeat for a request made during this call. */
  onProgress?: () => void;
  /** Aborted when the MCP client cancels the call (or a follower hangs up). */
  signal?: AbortSignal;
}

export const callContext = new AsyncLocalStorage<CallContext>();

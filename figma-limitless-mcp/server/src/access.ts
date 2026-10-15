import type http from "node:http";

/**
 * Who may reach the leader on :1994. It serves the local Figma plugin and
 * local MCP clients only, and /rpc runs any tool — execute_code included — so
 * a request from the network, or from a web page open in the user's browser,
 * must never get through.
 */

/** This machine only: IPv4 loopback, IPv6 loopback, or IPv4-mapped loopback. */
export const isLoopbackAddress = (addr: string | undefined): boolean =>
  addr !== undefined &&
  (addr === "::1" || addr.startsWith("127.") || addr.startsWith("::ffff:127."));

/** The plugin UI is a sandboxed iframe (Origin "null", or a figma.com origin);
 *  local Node clients send no Origin. Any other origin is a web page trying to
 *  hijack the plugin socket. Exact matches only. */
const PLUGIN_ORIGINS = new Set(["null", "https://www.figma.com", "https://figma.com"]);

/** Why a /ws upgrade is refused, or null to accept it. */
export const upgradeDenial = (req: http.IncomingMessage): string | null => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return `peer ${req.socket.remoteAddress ?? "unknown"} is not on this machine`;
  }
  const origin = req.headers.origin;
  if (origin !== undefined && !PLUGIN_ORIGINS.has(origin)) {
    return `origin ${origin} is not the Figma plugin`;
  }
  return null;
};

/** Why an /rpc call is refused, or null to accept it. Followers use Node's
 *  fetch: no Origin, JSON body. A browser always sends an Origin on a POST,
 *  and a JSON Content-Type forces a CORS preflight the leader never approves,
 *  so together these shut out cross-site requests from web pages. */
export const rpcDenial = (req: http.IncomingMessage): string | null => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return `peer ${req.socket.remoteAddress ?? "unknown"} is not on this machine`;
  }
  if (req.headers.origin !== undefined) {
    return "browser requests are not accepted";
  }
  const type = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") {
    return "Content-Type must be application/json";
  }
  return null;
};

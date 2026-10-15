import React, { useEffect, useMemo, useRef, useState } from "react";

type RequestType =
  | "get_document"
  | "get_selection"
  | "get_node"
  | "get_styles"
  | "get_metadata"
  | "get_design_context"
  | "get_variable_defs"
  | "get_screenshot"
  | "set_node_visibility"
  | "set_text_content"
  | "set_text_properties"
  | "set_node_properties"
  | "set_solid_fill"
  | "set_gradient_fill"
  | "set_effects"
  | "set_stroke_properties"
  | "set_auto_layout"
  | "create_frame"
  | "create_text"
  | "create_shape"
  | "create_image"
  | "duplicate_nodes"
  | "reparent_nodes"
  | "group_nodes"
  | "ungroup_node"
  | "set_selection"
  | "scroll_and_zoom_into_view"
  | "delete_nodes";

type ServerRequest = {
  type: RequestType;
  requestId: string;
  nodeIds?: string[];
  params?: Record<string, unknown>;
};

type PluginResponse = {
  type: RequestType;
  requestId: string;
  data?: unknown;
  error?: string;
};

type PluginStatus = {
  fileName: string;
  fileKey: string;
  selectionCount: number;
  /** The server's pairing code as the user typed it ("" = never paired). */
  pairingToken: string;
  /** False until the main thread has read the saved code. */
  pairingLoaded: boolean;
};

const WS_BASE_URL = "ws://localhost:1994/ws";
/** Responses held while the socket is down; the server keeps their requests
 *  waiting for a short reconnect window, so delivering them late still counts. */
const MAX_OUTBOX = 200;

export default function App() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<PluginStatus>({
    fileName: "Unknown file",
    fileKey: "",
    selectionCount: 0,
    pairingToken: "",
    pairingLoaded: false
  });
  /** The server refused this plugin's code (or it had none). */
  const [needsPairing, setNeedsPairing] = useState(false);
  /** That refusal was of a code, not of a missing one. */
  const [codeRejected, setCodeRejected] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [checking, setChecking] = useState(false);
  /** Bumped on every Pair press: reconnects even when the code didn't change. */
  const [pairAttempt, setPairAttempt] = useState(0);
  const [served, setServed] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const outboxRef = useRef<string[]>([]);

  const statusLabel = useMemo(
    () =>
      !connected
        ? "Waiting for server · :1994"
        : needsPairing
          ? "Not paired · :1994"
          : "Connected · :1994",
    [connected, needsPairing]
  );

  // The window grows to fit the pairing form while it is shown.
  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: "pairing-ui", visible: needsPairing } }, "*");
  }, [needsPairing]);

  const submitPairing = (event: React.FormEvent) => {
    event.preventDefault();
    if (!codeInput.trim()) return;
    setChecking(true);
    parent.postMessage({ pluginMessage: { type: "set-pairing-token", token: codeInput } }, "*");
    setPairAttempt((n) => n + 1);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage;
      if (!msg) return;

      if (msg.type === "plugin-status") {
        setStatus(msg.payload);
        return;
      }

      if (msg.type === "doc-event" || msg.type === "progress") {
        // Plugin-initiated notification (digest invalidation, request
        // heartbeat) — forward without a requestId. Stale ones aren't worth
        // buffering: a reconnect drops the digest cache and resyncs requests.
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify(msg));
        }
        return;
      }

      if (!("requestId" in msg)) {
        return;
      }

      const wire = JSON.stringify(msg);
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        const outbox = outboxRef.current;
        outbox.push(wire);
        if (outbox.length > MAX_OUTBOX) outbox.shift();
        return;
      }
      socketRef.current.send(wire);
      setServed((n) => n + 1);
    };

    window.addEventListener("message", handleMessage);
    // Status posted before this listener existed is lost: ask again now.
    parent.postMessage({ pluginMessage: { type: "status-request" } }, "*");
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Connect/reconnect WebSocket when the file or the pairing code changes
  useEffect(() => {
    // Wait for the saved code, so a paired plugin never connects without it.
    if (!status.fileKey || !status.pairingLoaded) return;

    let disposed = false;

    const connect = () => {
      if (disposed) return;

      if (socketRef.current) {
        const previousSocket = socketRef.current;
        previousSocket.onopen = null;
        previousSocket.onclose = null;
        previousSocket.onerror = null;
        previousSocket.onmessage = null;
        previousSocket.close();
      }

      // Browsers can't set headers on a WebSocket, so the code rides in the
      // query; the server never logs it.
      const sentToken = status.pairingToken;
      const wsUrl =
        `${WS_BASE_URL}?fileKey=${encodeURIComponent(status.fileKey)}` +
        `&fileName=${encodeURIComponent(status.fileName)}` +
        `&token=${encodeURIComponent(sentToken)}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Buffered responses go first, so they settle their requests before
        // the sync heartbeat (sent on ui-ready) reconciles what is still live.
        const outbox = outboxRef.current;
        outboxRef.current = [];
        for (const wire of outbox) ws.send(wire);
        if (outbox.length > 0) setServed((n) => n + outbox.length);
        parent.postMessage({ pluginMessage: { type: "ui-ready" } }, "*");
      };

      ws.onclose = () => {
        if (disposed || socketRef.current !== ws) return;
        setConnected(false);
        if (reconnectTimer.current === null) {
          reconnectTimer.current = window.setTimeout(() => {
            reconnectTimer.current = null;
            connect();
          }, 1500);
        }
      };

      ws.onerror = () => {
        if (disposed || socketRef.current !== ws) return;
        setConnected(false);
      };

      ws.onmessage = (event) => {
        if (disposed || socketRef.current !== ws) return;
        const payload = JSON.parse(event.data) as ServerRequest | { type: "paired" | "pairing-required" };
        // Pairing verdicts are for this window, not requests for the main thread.
        if (payload.type === "pairing-required") {
          setNeedsPairing(true);
          setCodeRejected(sentToken !== "");
          setChecking(false);
          return;
        }
        if (payload.type === "paired") {
          setNeedsPairing(false);
          setCodeRejected(false);
          setChecking(false);
          setCodeInput("");
          return;
        }
        parent.postMessage({ pluginMessage: { type: "server-request", payload } }, "*");
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer.current !== null) {
        window.clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (socketRef.current) {
        const ws = socketRef.current;
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
        socketRef.current = null;
      }
    };
  }, [status.fileKey, status.fileName, status.pairingLoaded, status.pairingToken, pairAttempt]);



  return (
    <div className="container">
      <div className="info-section">
        <div className="info-row">
          <span className="info-label">File:</span>
          <span className="info-value">{status.fileName}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Selection:</span>
          <span className="info-value">{status.selectionCount} node(s)</span>
        </div>
      </div>

      {needsPairing && (
        <form className="pairing" onSubmit={submitPairing}>
          <div className="pairing-title">
            {codeRejected ? "That code doesn't match this server" : "Pair with your AI's Limitless server"}
          </div>
          <div className="pairing-hint">
            Ask your AI to run <code>get_pairing_code</code>, or open{" "}
            <code>~/.figma-limitless-mcp/pairing-token</code>. Needed once.
          </div>
          <div className="pairing-row">
            <input
              className="pairing-input"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={32}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-label="Pairing code"
            />
            <button className="pairing-button" type="submit" disabled={checking || !codeInput.trim()}>
              {checking ? "Checking…" : "Pair"}
            </button>
          </div>
        </form>
      )}

      <div className="footer">
        <div className={`badge ${!connected ? "disconnected" : needsPairing ? "unpaired" : "connected"}`}>
          <span className="dot" />
          <span className="badge-text">{statusLabel}</span>
        </div>
        <span className="served-counter">
          {served > 0 ? `${served} request${served === 1 ? "" : "s"} served` : "Limitless MCP for Figma"}
        </span>
      </div>
    </div>
  );
}

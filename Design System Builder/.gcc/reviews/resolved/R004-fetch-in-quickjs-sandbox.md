# R004: Plugin polling.ts uses fetch() — unavailable in Figma QuickJS sandbox

**Raised by:** claude-code | **Date:** 2026-02-25 | **Status:** resolved
**Target:** `packages/builder-plugin/src/polling.ts`
**Severity:** flaw

## What Was Found

`polling.ts` calls `fetch()` directly for HTTP requests to the orchestration server (register, poll, heartbeat, result posting). The Figma plugin runs inside a QuickJS sandbox that does **not** provide `fetch`, `XMLHttpRequest`, or any network APIs.

The polling module has 3 network call sites:
1. `fetch(\`http://localhost:${port}/register\`, ...)` — registration
2. `fetch(\`http://localhost:${port}/poll\`, ...)` — command polling
3. `fetch(\`http://localhost:${port}/response\`, ...)` — result posting

All will throw `ReferenceError: fetch is not defined` at runtime in Figma.

## Why It Matters

**This is a total blocker.** The entire command pipeline depends on polling. Without it, the plugin cannot receive commands from the MCP server. The build pipeline will fail at step 1.

## Suggested Fix

Figma plugins use `figma.ui.postMessage()` / `figma.ui.onmessage` to communicate with a UI iframe. The UI iframe (which runs in a real browser context) CAN use `fetch()`.

**Architecture should be:**
```
Plugin (QuickJS) ←postMessage→ UI iframe (browser) ←fetch→ Orchestration Server
```

1. Move all `fetch()` calls into the UI iframe HTML
2. Plugin sends `{ type: 'poll-request' }` via `figma.ui.postMessage()`
3. UI iframe does the `fetch()`, sends results back via `parent.postMessage()`
4. Plugin receives commands via `figma.ui.onmessage`

Alternatively, if the plugin already has a `showUI()` call that loads an HTML page, the polling can be done entirely within the UI iframe and forwarded to the plugin sandbox.

## Resolution

**Resolved by:** claude-code | **Date:** 2026-03-16
**Action:** Already resolved in prior session. `polling.ts` is now types-only. All HTTP communication moved to the UI iframe (`ui.html`), which has full Web API access including `fetch()`.

# Install Guide

## Required: Claude Code Only

DSB requires **Claude Code** (the Claude desktop app or Claude Code CLI).
It is **NOT** compatible with Cursor, VS Code Copilot, Windsurf, or other AI IDEs.

**Install Claude:** https://claude.ai/download

Why? Other AI tools inject proprietary intermediary code between the user
and the MCP server. This can corrupt build state, interfere with the
automated pipeline, and break crash recovery. Claude Code provides a
clean, direct MCP connection that DSB depends on.

## Prerequisites

- **Claude Code** (claude.ai/download) — REQUIRED
- **Node.js** >= 18 (`node --version`)
- **pnpm** >= 9 (`pnpm --version`)
- **Google Chrome** — Required for the configuration UI
- **Figma Desktop** app installed
- Ports **9876** and **9877** available on localhost
- **Stable internet connection** — Required for license validation, updates, telemetry

## Quick Start (Claude handles everything)

1. Download the DSB toolkit zip from your Gumroad purchase
2. Extract to any local folder (NOT in a cloud-synced directory)
3. Open Claude Code and tell Claude:
   > "Set up Design System Builder from /path/to/Design System Builder"
4. Claude will:
   - Present Terms & Conditions (you must accept to proceed)
   - Check prerequisites (Node.js, pnpm, Chrome, internet)
   - Create encrypted project folder structure
   - Configure Claude Code permissions (automatic)
   - Build all packages
   - Start the orchestration server
   - Open the configuration UI in Chrome
5. Enter your Gumroad license key in the browser UI
6. Fill out the design system configuration form
7. Click "Build My Design System"
8. Approve Claude's build plan in the chat
9. Build runs automatically — fully checkpointed, crash-recoverable

## Manual Setup

If you prefer to set up manually:

### 1. Install Dependencies

```bash
cd "Design System Builder"
pnpm install
pnpm run build
```

### 2. Configure MCP Server

Add to `~/.claude/settings.json` or project `.claude/settings.json`:
```json
{
  "mcpServers": {
    "design-system-builder": {
      "command": "node",
      "args": ["/path/to/Design System Builder/packages/mcp-server/dist/index.js"],
      "env": {
        "DSB_ORCHESTRATION_PORT": "9877",
        "DSB_LICENSE_KEY": "your-gumroad-license-key"
      }
    }
  }
}
```

### 3. Set Permissions for Automated Builds

Add to `.claude/settings.json`:
```json
{
  "permissions": {
    "allow": [
      "mcp__design-system-builder__*"
    ]
  }
}
```

This allows all DSB MCP tools to run automatically during builds.
Without this, Claude will pause at every tool call for permission approval.

### 4. Start the Orchestration Server

```bash
pnpm run server:start
```

Verify: `curl http://localhost:9877/health` should return `{ "status": "ok" }`.

### 5. Import Figma Plugin

1. Open Figma Desktop
2. Go to **Plugins > Development > Import plugin from manifest...**
3. Navigate to: `Design System Builder/packages/builder-plugin/manifest.json`
4. Click **Open**

### 6. Run the Plugin

1. In Figma, go to **Plugins > Development > DSB Builder**
2. The plugin UI should show a green connection indicator
3. Tell Claude: "Check DSB connection" — it should confirm the plugin is connected

## Verify Installation

Tell Claude:
> "Check if Design System Builder is set up correctly"

Claude will run:
- `dsb_system_check` — verifies integrity, deps, Chrome, connectivity
- `dsb_check_connection` — verifies plugin is responding
- `dsb_check_plan_limits` — confirms Figma plan detection
- `dsb_load_context` — verifies file I/O works through guardrails

## Updating

DSB includes an automatic update system. When updates are available:

1. Claude will notify you: "DSB v2.1.0 is available. Update now?"
2. Approve the update in Claude Code chat
3. DSB automatically: downloads, verifies signature, backs up, installs
4. If anything fails: automatic rollback to your current version
5. No manual steps required

If you prefer manual updates:
1. Download the new zip from Gumroad
2. Extract over the existing folder (workspace/ files are preserved)
3. Run `pnpm install && pnpm run build`
4. Restart the orchestration server

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `pnpm install` fails | Ensure Node.js >= 18 and pnpm >= 9 |
| Plugin not visible in Figma | Re-import manifest.json from Plugins > Development |
| Connection indicator is red | Restart orchestration server: `pnpm run server:start` |
| MCP tools not appearing | Restart Claude Code after adding MCP config |
| Port 9877 in use | Change `DSB_ORCHESTRATION_PORT` in .env and MCP config |
| "License required" on create tools | Enter valid license key in the config UI |
| Config UI doesn't open | Ensure Google Chrome is installed |
| "System locked" error | Unauthorized file modification detected. Run `dsb_system_check` |
| Build failed mid-pipeline | Tell Claude: "Resume the build" — it picks up from last checkpoint |
| Build paused (token limit) | Start a new Claude Code session and say "Resume the build" |
| Update failed | Automatic rollback preserves your current version. Try again later. |
| "Not connected" in non-Claude IDE | DSB requires Claude Code. Other IDEs are not supported. |

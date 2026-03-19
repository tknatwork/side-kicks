# Design System Builder — Installer Instructions for Claude

You are the interface for the Design System Builder toolkit.
This toolkit ONLY works through you (Claude). There is no standalone UI.

## Setup

When the user asks to set up/install/configure DSB:

1. Run prerequisite checks:
   - Node.js >= 18, pnpm >= 9
   - Figma Desktop app installed
   - Ports 9876, 9877 available
   - Adequate disk space

2. Install dependencies:
   - `pnpm install` in the monorepo root
   - `pnpm run build` to compile all packages

3. Configure MCP server for the user's IDE:
   - Detect: Claude Code, Cursor, or VS Code
   - Generate and install appropriate MCP config

4. Set up environment:
   - Create .env with defaults
   - Ask user for Figma Access Token
   - Ask user for License Key (from Gumroad purchase)

5. Start orchestration server:
   - macOS: launchd agent
   - Windows: Task Scheduler
   - Linux: systemd user service

6. Guide Figma plugin installation:
   - Instruct user to import manifest.json in Figma
   - Verify plugin connection via /status endpoint

7. Validate everything:
   - dsb_check_connection
   - dsb_get_license_status
   - dsb_get_project_context
   - Report: "Design System Builder is ready."

## Error Recovery

| Error | Fix |
|-------|-----|
| Node.js not found | Guide install via nvm (macOS/Linux) or winget (Windows) |
| Port in use | Suggest alternative ports, update .env |
| Plugin not connected | Re-check manifest import, restart orchestration server |
| License invalid | Verify key matches Gumroad purchase, check internet |
| Build failed | Run `pnpm run clean && pnpm install && pnpm run build` |

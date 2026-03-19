# Figma Design System Builder - Setup Guide

This guide explains how to set up and use the AI-controlled Figma Design System builder for the Portfolio project.

**Last Updated:** 2025-12-05  
**Plugin Version:** 2.0 (HTTP Polling)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VS Code / AI Agent                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    MCP Server                                │   │
│  │  - READ tools (direct Figma API)                            │   │
│  │  - WRITE tools (via Orchestration Server)                   │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ HTTP (localhost:9877)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Orchestration Server                             │
│                   (Node.js HTTP Polling)                            │
│                                                                     │
│  HTTP Server (9877)                                                 │
│  - POST /command      → Send command to plugin                      │
│  - GET /status        → Check plugin connection                     │
│  - GET /health        → Server health check                         │
│  - GET /poll          → Plugin polls for commands                   │
│  - POST /response     → Plugin returns results                      │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTP Polling (every 500ms)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Figma Desktop App                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │            Portfolio DS Builder Plugin (v2.0)                │   │
│  │  - HTTP polling client (WebSocket blocked by sandbox)       │   │
│  │  - Variable/Style/Page/Frame creation                       │   │
│  │  - Text update & node manipulation                          │   │
│  │  - Variable scoping & mode management                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                    Nectar Design System                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │
│  │📚 NDS Docs │ │ 🎯 Icons    │ │🧩 Components│                   │
│  │   (page)   │ │   (page)    │ │  (7 pages)  │                   │
│  └─────────────┘ └─────────────┘ └─────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Node.js** v18+ installed
2. **Figma Desktop App** (not web version - required for plugins)
3. **Figma Account** with edit access to the design files
4. **PM2** (optional, for process management): `npm install -g pm2`

## Step 1: Install Plugin Dependencies

```bash
cd "My Portfolio/AI_TOOLING/figma-plugin"
npm install
npx tsc  # Compile TypeScript
```

This compiles `code.ts` to `code.js`.

## Step 2: Load Plugin in Figma

1. Open Figma Desktop App
2. Go to **Plugins** → **Development** → **Import plugin from manifest...**
3. Navigate to `My Portfolio/AI_TOOLING/figma-plugin/manifest.json`
4. Select the manifest file
5. The plugin "Portfolio DS Builder" should now appear in your plugins

## Step 3: Start Orchestration Server

### Option A: Using PM2 (Recommended)

```bash
cd "My Portfolio/AI_TOOLING"
pm2 start orchestration-server/index.js --name nectar-server
pm2 logs nectar-server
```

### Option B: Direct Node

```bash
cd "My Portfolio/AI_TOOLING/orchestration-server"
npm install
node index.js
```

You should see:
```
� Nectar Orchestration Server running on http://localhost:9877

Available endpoints:
  GET  /health    - Server health check
  GET  /status    - Plugin connection status
  GET  /poll      - Plugin polls for commands
  POST /command   - Send command to plugin
  POST /response  - Plugin returns results

Waiting for Figma Plugin to connect...
```

## Step 4: Connect Plugin

1. Open your Figma design file (Nectar Design System)
2. Go to **Plugins** → **Development** → **Portfolio DS Builder**
3. The plugin auto-connects via HTTP polling
4. Check status: `curl http://localhost:9877/status`

Expected response:
```json
{
  "connected": true,
  "connectionType": "http",
  "fileInfo": {
    "name": "Nectar Design System",
    "currentPage": "📚 NDS Documentation"
  },
  "pendingCommands": 0
}
```

## Step 5: Reloading Plugin After Code Changes

After modifying `code.ts`:

```bash
# 1. Compile TypeScript
cd "My Portfolio/AI_TOOLING/figma-plugin"
npx tsc

# 2. In Figma: Right-click → Plugins → Development → Run Last Plugin
# Or close and reopen the plugin
```

## Available Commands

### Variable Commands
| Command | Description | Payload |
|---------|-------------|---------|
| `create_variable_collection` | Create collection with modes | `{ name, modes }` |
| `create_variable` | Create variable | `{ collectionId, name, type }` |
| `set_variable_value` | Set value for mode | `{ variableId, modeId, value }` |
| `set_variable_scopes` | Set variable scopes | `{ variableId, scopes }` |
| `get_variable_collections` | Get all collections | - |
| `get_variables` | Get variables in collection | `{ collectionId }` |
| `get_vars_detailed` | Get vars with scopes/values | `{ collectionId }` |

### Style Commands
| Command | Description | Payload |
|---------|-------------|---------|
| `create_color_style` | Create paint style | `{ name, color }` |
| `create_text_style` | Create text style | `{ name, fontFamily, fontSize, ... }` |
| `update_text_style` | Update existing text style | `{ styleId, ... }` |
| `create_effect_style` | Create shadow/blur | `{ name, effects }` |
| `get_local_styles` | Get all local styles | - |

### Page & Frame Commands
| Command | Description | Payload |
|---------|-------------|---------|
| `create_page` | Create new page | `{ name }` |
| `get_pages` | Get all pages | - |
| `set_current_page` | Navigate to page | `{ pageId }` |
| `create_frame` | Create frame | `{ name, x, y, width, height, parentId? }` |

### Node Commands
| Command | Description | Payload |
|---------|-------------|---------|
| `create_text` | Create text node | `{ text, x, y, fontSize, fontFamily }` |
| `update_text` | **NEW** Update text content | `{ nodeId, text, fontFamily?, fontStyle? }` |
| `create_rectangle` | Create rectangle | `{ width, height, x, y, fills?, cornerRadius? }` |
| `get_node_info` | Get node details | `{ nodeId }` |
| `delete_node` | Delete a node | `{ nodeId }` |
| `rename_node` | Rename a node | `{ nodeId, name }` |
| `set_node_position` | Move node | `{ nodeId, x, y }` |
| `resize_node` | Resize node | `{ nodeId, width, height }` |
| `bind_variable_to_node` | Bind variable | `{ nodeId, variableId, field }` |
| `set_node_fills` | Set fill color | `{ nodeId, fills }` |

### Mode Commands
| Command | Description | Payload |
|---------|-------------|---------|
| `create_mode` | Add mode to collection | `{ collectionId, name }` |
| `set_explicit_variable_modes` | Set mode on frame | `{ nodeId, modeValues }` |
| `get_explicit_variable_modes` | Get frame modes | `{ nodeId }` |

## Usage Examples

### Update Text Node Content

```bash
curl -X POST http://localhost:9877/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "update_text",
    "payload": {
      "nodeId": "106:1108",
      "text": "fg/default + type/body/md"
    }
  }'
```

### Set Variable Scopes (TEXT_FILL for text colors)

```bash
curl -X POST http://localhost:9877/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "set_variable_scopes",
    "payload": {
      "variableId": "VariableID:94:308",
      "scopes": ["TEXT_FILL", "FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"]
    }
  }'
```

### Create a Variable Collection

```bash
curl -X POST http://localhost:9877/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "create_variable_collection",
    "payload": {
      "name": "Brand",
      "modes": ["Default"]
    }
  }'
```

### Create a Color Variable

```bash
curl -X POST http://localhost:9877/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "create_variable",
    "payload": {
      "collectionId": "VariableCollectionId:90:2",
      "name": "pink/500",
      "type": "COLOR"
    }
  }'
```

## Variable Scopes Reference

| Scope | Description |
|-------|-------------|
| `ALL_FILLS` | All fill properties |
| `FRAME_FILL` | Frame backgrounds |
| `SHAPE_FILL` | Shape fills |
| `TEXT_FILL` | Text color ⚠️ Required for fg/ tokens |
| `STROKE_COLOR` | Stroke/border color |
| `EFFECT_COLOR` | Shadow/effect color |
| `GAP` | Auto layout gap |
| `WIDTH_HEIGHT` | Size properties |
| `CORNER_RADIUS` | Border radius |

## Troubleshooting

### Plugin won't connect
- Ensure Orchestration Server is running on port 9877
- Check status: `curl http://localhost:9877/health`
- Verify you're using Figma Desktop, not web

### Commands timeout
- Check plugin is open in Figma
- Look at server status: `curl http://localhost:9877/status`
- Check `pendingCommands` count - if stuck, restart plugin

### Variables not appearing in text fill menu
- Ensure `TEXT_FILL` scope is set on the variable
- Use `set_variable_scopes` command to add the scope

### "Node not found" error
- Node ID may be stale after page changes
- Use `get_node_info` to verify node exists
- IDs change when nodes are deleted/recreated

### Server shows connected but commands fail
- Reload plugin in Figma (Plugins → Development → Run Last Plugin)
- Restart server: `pm2 restart nectar-server`

## Token Architecture

The design system uses a 4-tier token architecture:

| Collection | Variables | Modes | Visibility |
|------------|-----------|-------|------------|
| **Brand** | 68 | 1 | 🔒 Hidden |
| **Alias** | 353 | 1 | 🔒 Hidden |
| **Mapped** | 366 | Light/Dark | ✅ Published |
| **Breakpoints** | 240 | Desktop/Tablet/Mobile | ✅ Published |

### Foreground (Text) Tokens

All `fg/` tokens now have `TEXT_FILL` scope:

| Token | Usage |
|-------|-------|
| `fg/default` | Primary text |
| `fg/muted` | Secondary text |
| `fg/subtle` | Tertiary text |
| `fg/disabled` | Disabled text |
| `fg/inverse` | Inverted text |
| `fg/onEmphasis` | Text on emphasis bg |
| `primary/fg/default` | Accent text |
| `success/fg/default` | Success text |
| `warning/fg/default` | Warning text |
| `danger/fg/default` | Error text |
| `info/fg/default` | Info text |
| `link/fg/default` | Link text |

## File Structure

```
My Portfolio/
├── AI_TOOLING/
│   ├── figma-plugin/
│   │   ├── manifest.json     # Plugin manifest
│   │   ├── code.ts           # Plugin logic (TypeScript)
│   │   ├── code.js           # Compiled plugin
│   │   ├── ui.html           # Plugin UI
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── nectar-style-generator/
│   │   ├── manifest.json     # Style generator plugin manifest
│   │   ├── code.ts           # Plugin logic (TypeScript)
│   │   ├── code.js           # Compiled plugin
│   │   ├── ui.html           # Plugin UI
│   │   ├── README.md         # Plugin documentation
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── orchestration-server/
│   │   ├── index.js          # HTTP polling server
│   │   └── package.json
│   ├── bridge-server/        # (Legacy WebSocket - deprecated)
│   └── mcp-server/
│       └── src/index.ts      # MCP server
├── docs/
│   ├── NDS/                  # Design system documentation
│   ├── TASKS.md              # Task tracking
│   └── FIGMA_PLUGIN_SETUP.md # This file
└── src/tokens/
    └── tokens.json           # Local token definitions
```

## Nectar Style Generator Plugin

The Nectar Style Generator is a separate plugin for generating Figma Styles from Variable Modes.

### Purpose

Figma variables cannot be directly applied to text styles or effect styles. This plugin bridges that gap by:

1. Reading variable values from Mapped (COLOR) and Breakpoints (FLOAT) collections
2. Generating Figma Styles with the `🍯` prefix
3. Supporting theme modes (Light/Dark) and breakpoint modes (Desktop/Tablet/Mobile)

### Generated Styles

| Type | Count | Source |
|------|-------|--------|
| Color Styles | 136 | Mapped collection (COLOR variables) |
| Text Styles | 44 | Breakpoints collection (typescale/) |
| Effect Styles | 4 | Breakpoints collection (elevation/) |
| Grid Styles | 8 | Breakpoints collection (grid/) |
| **Total** | **192** | |

### Usage

1. Open Figma Desktop
2. Plugins → Development → Import plugin from manifest...
3. Select `AI_TOOLING/nectar-style-generator/manifest.json`
4. Run the plugin and select theme + breakpoint modes
5. Click "Generate Styles"

### Building

```bash
cd "My Portfolio/AI_TOOLING/nectar-style-generator"
npm install
npx tsc  # Compile TypeScript
```

See `AI_TOOLING/nectar-style-generator/README.md` for full documentation.

## PM2 Commands

```bash
# Start server
pm2 start orchestration-server/index.js --name nectar-server

# View logs
pm2 logs nectar-server

# Restart after code changes
pm2 restart nectar-server

# Stop server
pm2 stop nectar-server

# Check status
pm2 status
```

---

**Last updated:** 2025-12-05

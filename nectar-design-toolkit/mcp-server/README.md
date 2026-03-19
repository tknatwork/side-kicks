# Nectar Design Toolkit — MCP Server

A Model Context Protocol (MCP) server for building and managing the Nectar Core design system in Figma.

## Overview

This MCP server enables AI agents (Claude Desktop, Cursor, VS Code Copilot, etc.) to:

- **READ** design tokens from Figma via REST API
- **WRITE** variables, styles, pages, frames, and text nodes via the orchestration server + plugin
- **BUILD** the complete design system automatically with `run_build_ds`
- Sync tokens bi-directionally between code and Figma

## Architecture

```
AI Agent (Claude Desktop / Cursor / VS Code)
      │
      │ MCP Protocol (JSON-RPC over stdio)
      ▼
MCP Server (this package)
      │
      ├── READ: Figma REST API (requires FIGMA_ACCESS_TOKEN)
      │
      └── WRITE: HTTP POST → Orchestration Server (localhost:9877)
                                    │
                                    │ HTTP Polling (50ms)
                                    ▼
                              Figma Plugin
                                    │
                                    ▼
                              Figma File
```

## Setup

### 1. Install & Build

```bash
cd mcp-server
npm install
npm run build
```

### 2. Configure Environment

For READ operations (Figma REST API), create `.env.local`:

```dotenv
FIGMA_ACCESS_TOKEN=your_figma_personal_access_token
FIGMA_FILE_ID=your_figma_file_id
```

For WRITE operations, start the orchestration server + plugin (see main README).

### 3. Connect to AI Agent

#### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "nectar-figma": {
      "command": "node",
      "args": ["/path/to/nectar-design-toolkit/mcp-server/build/index.js"]
    }
  }
}
```

#### VS Code (`.vscode/mcp.json`)
```json
{
  "servers": {
    "nectar-figma": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/build/index.js"]
    }
  }
}
```

## Available Tools

### Read Operations (Figma REST API)

| Tool | Description |
|------|-------------|
| `fetch_figma_tokens` | Fetch design tokens from Figma without saving |
| `sync_figma_tokens` | Fetch and save tokens to project files |
| `get_figma_file_info` | Get Figma file metadata and page structure |
| `get_figma_components` | List all published components |
| `get_figma_styles` | List all styles (colors, text, effects) |
| `read_project_tokens` | Read current project tokens from disk |

### Write Operations (Orchestration Server + Plugin)

| Tool | Description |
|------|-------------|
| `check_bridge_status` | Check orchestration server and plugin connection |
| `run_build_ds` | Run automated full DS build (variables + styles + pages) |
| `create_variable_collection` | Create collection with optional modes |
| `create_variable` | Create a variable in a collection |
| `set_variable_value` | Set variable value for a mode |
| `set_variable_scopes` | Set variable scopes (which properties it applies to) |
| `delete_variable` | Delete a variable |
| `create_color_style` | Create a paint style |
| `create_text_style` | Create a text style |
| `create_effect_style` | Create an effect style (shadow/blur) |
| `create_frame` | Create a frame with optional auto-layout |
| `create_text` | Create a text node |
| `update_text` | Update text content |
| `delete_node` | Delete any node |
| `bind_variable_to_node` | Bind a variable to a node property |
| `create_figma_page` | Create a new page |
| `set_current_page` | Navigate to a page |
| `get_figma_pages_live` | Get pages from open file |
| `get_variable_collections_live` | Get variable collections from open file |
| `get_variables_live` | Get variables from open file |
| `get_local_styles_live` | Get local styles from open file |

### Prompts

| Prompt | Description |
|--------|-------------|
| `sync-design-tokens` | Guided workflow to sync tokens from Figma to code |
| `build-design-system` | Guided workflow to build the full Nectar Core DS in Figma |

## Quick Start: Build Full Design System

```
1. Start orchestration server: cd orchestration-server && node index.js
2. Open Figma Desktop → load plugin → verify connection
3. Ask AI agent: "Use run_build_ds to build the design system"
```

The `run_build_ds` tool creates 122 variables, 18 styles, and 5 pages automatically.

## Development

```bash
npm run dev    # Watch mode
npm run build  # Production build
```

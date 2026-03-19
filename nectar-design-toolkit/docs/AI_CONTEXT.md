> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file must NEVER be deleted during cleanup or overhaul operations.
> Instead, rewrite its contents to reflect the new direction.

# Nectar Design Toolkit - AI Context

**Project**: Nectar Design Toolkit (Multi-component Figma orchestration system)  
**Location**: `Side-Kicks/nectar-design-toolkit/`  
**Status**: Migrated from Portfolio archive, Ready for development  
**Last Updated**: 2025-12-27

---

## 🎯 Project Overview

The Nectar Design Toolkit is a comprehensive suite of tools for AI-controlled design system building in Figma. It enables AI agents to programmatically create, modify, and manage design tokens, styles, components, and documentation directly in Figma files.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **AI → Figma Control** | Full bidirectional communication between AI agents and Figma |
| **Variable Management** | Create/edit/delete design tokens (colors, spacing, typography) |
| **Style Generation** | Generate Figma styles from variable modes |
| **Component Building** | Programmatic component creation |
| **Documentation** | In-Figma documentation automation |

---

## 🗂️ Project Structure

```
nectar-design-toolkit/
├── TASKS.md                         ← Task tracking
├── .github/
│   ├── copilot-instructions.md      ← AI coding rules
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
├── docs/                            ← Documentation
│   ├── AI_CONTEXT.md                ← This file (PROTECTED)
│   ├── CHANGELOG.md                 ← Version history (PROTECTED)
│   ├── WALKTHROUGH.md               ← Step-by-step implementation guide
│   ├── FIGMA_PLUGIN_SETUP.md        ← Plugin installation & usage
│   ├── PROJECT_STRUCTURE.md         ← Directory layout
│   ├── DESIGN_SYSTEM_STRUCTURE.md   ← Token architecture
│   └── NECTAR_DESIGN_SYSTEM.md      ← NDS specification
│
├── figma-plugin/                    ← 🔌 Main Figma Plugin
│   ├── manifest.json                ← Plugin config (Portfolio DS Builder)
│   ├── code.ts                      ← TypeScript source
│   ├── code.js                      ← Compiled output
│   ├── ui.html                      ← Plugin UI
│   └── package.json
│
├── nds-builder/                     ← 🏗️ Standalone NDS Bootstrapper
│   ├── manifest.json                ← NDS Builder plugin
│   ├── src/code.ts                  ← TypeScript source
│   ├── code.js                      ← Compiled output
│   └── ui.html
│
├── nectar-style-generator/          ← 🎨 Style Generation Plugin
│   ├── manifest.json
│   ├── code.ts
│   ├── code.js
│   ├── ui.html
│   └── README.md
│
├── orchestration-server/            ← 🎭 HTTP Polling Server
│   ├── index.js                     ← Main server
│   ├── package.json
│   └── [various scripts]            ← Migration, import utilities
│
├── bridge-server/                   ← 🌉 WebSocket Bridge
│   ├── index.js
│   └── package.json
│
├── mcp-server/                      ← 🤖 VS Code MCP Integration
│   ├── src/index.ts
│   ├── build/index.js
│   └── README.md
│
├── build-design-system.py           ← Python build script
├── set-colors.py                    ← Color utility
├── ecosystem.config.js              ← PM2 config
├── nectar-cli.sh                    ← CLI utility
└── logs/                            ← Server logs
```

---

## 🔧 Components

### 1. figma-plugin (Portfolio DS Builder)
**Purpose**: Main AI-controlled Figma plugin for design system building

**Capabilities**:
- Variable/Collection CRUD
- Style creation (Color, Text, Effect)
- Frame/Component creation
- Text manipulation
- Variable scoping & mode management

**Connection**: HTTP polling via orchestration-server

### 2. nds-builder
**Purpose**: Standalone plugin for bootstrapping new NDS files

**Features**:
- Create 69-page structure with separators
- Generate 37 text styles
- Generate 7 effect styles
- Generate 5 grid styles
- Cleanup utilities

**Note**: No server required - works independently

### 3. nectar-style-generator
**Purpose**: Generate Figma Styles from Variable Modes

**Solves**: Typography/Effect variables can't be applied via "Apply Variable Mode"

**Output**:
- 136 Color Styles
- 44 Text Styles (22 base + 22 emphasized)
- 4 Effect Styles
- 8 Grid Styles

### 4. orchestration-server
**Purpose**: HTTP polling server for AI → Plugin communication

**Endpoints**:
| Route | Method | Description |
|-------|--------|-------------|
| `/command` | POST | Send command to plugin |
| `/poll` | GET | Plugin polls for commands |
| `/response` | POST | Plugin returns results |
| `/status` | GET | Check plugin connection |
| `/health` | GET | Server health |

**Port**: 9877

### 5. bridge-server
**Purpose**: WebSocket bridge (alternative to HTTP polling)
**Port**: 9876 (WS), 9877 (HTTP)

### 6. mcp-server
**Purpose**: MCP integration for VS Code AI agents

**Tools**:
- `fetch_figma_tokens` - Preview tokens
- `sync_figma_tokens` - Sync to project
- `get_figma_file_info` - File metadata
- `get_figma_components` - List components
- `get_figma_styles` - List styles

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+
- Figma Desktop App
- PM2 (optional): `npm install -g pm2`

### Setup

```bash
# 1. Install dependencies for each component
cd figma-plugin && npm install && npx tsc
cd ../nds-builder && npm install && npx tsc
cd ../nectar-style-generator && npm install && npx tsc
cd ../orchestration-server && npm install
cd ../bridge-server && npm install
cd ../mcp-server && npm install && npm run build

# 2. Start orchestration server
cd orchestration-server
node index.js
# Or with PM2: pm2 start index.js --name nectar-server

# 3. Load plugin in Figma
# Plugins → Development → Import plugin from manifest
# Select: figma-plugin/manifest.json
```

---

## 🔗 Related Files

| File | Purpose |
|------|---------|
| [WALKTHROUGH.md](WALKTHROUGH.md) | Step-by-step implementation guide |
| [FIGMA_PLUGIN_SETUP.md](FIGMA_PLUGIN_SETUP.md) | Plugin setup & architecture |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [../TASKS.md](../TASKS.md) | Current task tracking |

---

## 🗑️ Bin Folder (Fail-Safe)

Before deleting any file, move it to `bin/` first:
```bash
mv file.md ../../../bin/
```

---

## 📝 For AI Agents

### Before Making Changes
1. Read this file and [../TASKS.md](../TASKS.md)
2. Check [WALKTHROUGH.md](WALKTHROUGH.md) for implementation patterns
3. Update documentation after changes

### Key Patterns
- All plugins use TypeScript → compile with `npx tsc`
- Figma sandbox restrictions: No spread operators, limited async
- HTTP polling interval: 500ms
- Variable naming: `category/subcategory/token` (e.g., `bg/surface/default`)

---

*Maintained by AI Agents - Last AI: GitHub Copilot (Claude Opus 4.5)*

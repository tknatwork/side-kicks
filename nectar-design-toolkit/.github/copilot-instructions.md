# Nectar Design Toolkit - Copilot Instructions

> Comprehensive AI operational guide for the Nectar Design Toolkit

---

## 🚀 QUICK START: How to Use This Plugin

### Step-by-Step Setup (REQUIRED before any Figma operations)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SETUP CHECKLIST                             │
│                                                                     │
│  1. □ Start Orchestration Server                                    │
│  2. □ Open Figma Desktop App (NOT web version)                      │
│  3. □ Open target design file in Figma                              │
│  4. □ Load & Run the Plugin                                         │
│  5. □ Verify Connection                                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### Step 1: Start Orchestration Server
```bash
cd "/Users/tusharkant/Github Project/design-docs/Side-Kicks/nectar-design-toolkit/orchestration-server"
node index.js
```
Expected output:
```
🎭 Nectar Orchestration Server running on http://localhost:9877
Waiting for Figma Plugin to connect...
```

#### Step 2: Open Figma Desktop App
⚠️ **MUST use Desktop app** - Plugins don't work in web version

#### Step 3: Open Target Design File
Open the Figma file you want to modify (e.g., "Nectar Design System")

#### Step 4: Load & Run Plugin
1. Go to **Plugins** → **Development** → **Import plugin from manifest...**
2. Select: `nectar-design-toolkit/figma-plugin/manifest.json`
3. Then: **Plugins** → **Development** → **Portfolio DS Builder**
4. Plugin UI opens and auto-connects

#### Step 5: Verify Connection
```bash
curl http://localhost:9877/status
```
Expected response:
```json
{
  "connected": true,
  "connectionType": "http",
  "fileInfo": { "name": "Nectar Design System" }
}
```

---

## 🔌 Architecture Overview

```
VS Code/AI Agent
       │
       │ MCP Server (READ tools + WRITE via HTTP)
       │
       ▼
Orchestration Server (localhost:9877)
       │
       │ HTTP Polling (every 500ms)
       │
       ▼
Figma Plugin (Portfolio DS Builder)
       │
       ▼
Figma Design File
```

### Communication Flow
1. **AI sends command** → Orchestration Server (POST /command)
2. **Plugin polls** → Gets pending command (GET /poll)
3. **Plugin executes** → Performs action in Figma
4. **Plugin responds** → Returns result (POST /response)
5. **AI receives result** → From original POST /command

---

## 📋 Available Commands

### Variable Commands
| Command | Description | Payload |
|---------|-------------|---------|
| `create_variable_collection` | Create collection with modes | `{ name, modes }` |
| `create_variable` | Create variable | `{ collectionId, name, type }` |
| `set_variable_value` | Set value for mode | `{ variableId, modeId, value }` |
| `set_variable_scopes` | Set variable scopes | `{ variableId, scopes }` |
| `delete_variable` | Delete a variable | `{ variableId }` |
| `get_variable_collections` | Get all collections | - |
| `get_variables` | Get variables in collection | `{ collectionId }` |

### Style Commands
| Command | Description | Payload |
|---------|-------------|---------|
| `create_color_style` | Create paint style | `{ name, color }` |
| `create_text_style` | Create text style | `{ name, fontFamily, fontSize, ... }` |
| `create_effect_style` | Create shadow/blur | `{ name, effects }` |
| `get_local_styles` | Get all local styles | - |

### Page & Frame Commands
| Command | Description | Payload |
|---------|-------------|---------|
| `create_page` | Create new page | `{ name }` |
| `get_pages` | Get all pages | - |
| `set_current_page` | Navigate to page | `{ pageId }` |
| `create_frame` | Create frame | `{ name, x, y, width, height }` |

### Node Commands
| Command | Description | Payload |
|---------|-------------|---------|
| `create_text` | Create text node | `{ text, x, y, fontSize }` |
| `update_text` | Update text content | `{ nodeId, text }` |
| `delete_node` | Delete a node | `{ nodeId }` |
| `bind_variable_to_node` | Bind variable | `{ nodeId, variableId, field }` |

---

## 🔧 Command Examples

### Check Server Health
```bash
curl http://localhost:9877/health
```

### Check Plugin Connection
```bash
curl http://localhost:9877/status
```

### Send Command to Plugin
```bash
curl -X POST http://localhost:9877/command \
  -H "Content-Type: application/json" \
  -d '{
    "command": "get_pages",
    "payload": {}
  }'
```

### Create Variable Collection
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

### Create Color Variable
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

---

## 🐛 Troubleshooting

### Connection Issues

| Problem | Solution |
|---------|----------|
| `"connected": false` | 1. Check server running 2. Reload plugin in Figma |
| Commands timeout | Plugin may be closed - reopen it |
| "Node not found" | Node ID stale - re-query the node |
| Port 9877 in use | Kill existing process: `lsof -ti:9877 \| xargs kill` |

### Server Not Starting
```bash
# Check if port is in use
lsof -i :9877

# Kill existing process
kill $(lsof -ti:9877)

# Restart server
node index.js
```

### Plugin Not Connecting
1. Ensure using **Figma Desktop** (not web)
2. Close and reopen plugin
3. Check server logs for connection attempts

### Reloading After Code Changes
```bash
# After editing code.ts:
cd figma-plugin
npx tsc

# In Figma: Right-click → Plugins → Development → Run Last Plugin
```

---

## 🗑️ Bin Folder (Fail-Safe)

Before deleting any file, move it to `bin/` first:
```bash
# Do: mv file.md ../../../bin/
# Don't: rm file.md
```

---

## ⚠️ Protected Files

These files must NEVER be deleted - rewrite instead:
- `docs/AI_CONTEXT.md`
- `docs/CHANGELOG.md`
- `TASKS.md`
- `.github/copilot-instructions.md`

---

## 📂 Project Structure

```
nectar-design-toolkit/
├── figma-plugin/           ← 🔌 Main AI-controlled Figma plugin
│   ├── manifest.json       ← Plugin config
│   ├── code.ts            ← Source (edit this)
│   ├── code.js            ← Compiled (generated)
│   └── ui.html            ← Plugin UI
│
├── nds-builder/            ← 🏗️ Standalone NDS bootstrapper
├── nectar-style-generator/ ← 🎨 Style generation from variables
│
├── orchestration-server/   ← 🎭 HTTP Polling Server (port 9877)
│   └── index.js           ← Main server file
│
├── bridge-server/          ← 🌉 WebSocket bridge (alternative)
├── mcp-server/             ← 🤖 VS Code MCP integration
└── docs/                   ← 📚 Documentation
    ├── AI_CONTEXT.md       ← Project context (PROTECTED)
    ├── CHANGELOG.md        ← Version history (PROTECTED)
    ├── WALKTHROUGH.md      ← Implementation guide
    └── FIGMA_PLUGIN_SETUP.md
```

---

## 🔧 Development Rules

### TypeScript Compilation
All plugins use TypeScript. Always compile after changes:
```bash
cd <plugin-folder>
npx tsc
```

### Figma Sandbox Restrictions
⚠️ Figma plugins run in a sandboxed environment:
- ❌ No spread operators (`...obj`) in plugin code
- ❌ Limited async/await patterns
- ❌ No external network calls (except dev domains)
- ✅ Use explicit object copying
- ✅ Use callback patterns when needed

### Server Ports
| Service | Port | Protocol |
|---------|------|----------|
| Orchestration Server | 9877 | HTTP |
| Bridge Server (WS) | 9876 | WebSocket |

### Variable Naming (Figma)
Follow the Nectar Design System convention:
```
category/subcategory/token

Examples:
- bg/surface/default
- fg/primary
- spacing/component/md
- elevation/sm
```

---

## ✅ Pre-Flight Checklist for AI Agents

Before performing ANY Figma operations:

```
□ 1. Is orchestration-server running? 
     Check: curl http://localhost:9877/health
     
□ 2. Is plugin connected?
     Check: curl http://localhost:9877/status
     Look for: "connected": true
     
□ 3. Is correct Figma file open?
     Check: status response → fileInfo.name
     
□ 4. Do I have the correct node/variable IDs?
     Query first: get_pages, get_variable_collections
```

---

## 🔗 Key References

| Document | Purpose |
|----------|---------|
| [docs/AI_CONTEXT.md](../docs/AI_CONTEXT.md) | Project overview & structure |
| [docs/CHANGELOG.md](../docs/CHANGELOG.md) | Version history |
| [TASKS.md](../TASKS.md) | Task tracking |
| [docs/WALKTHROUGH.md](../docs/WALKTHROUGH.md) | Implementation guide |
| [docs/FIGMA_PLUGIN_SETUP.md](../docs/FIGMA_PLUGIN_SETUP.md) | Full plugin setup |
| [mcp-server/README.md](../mcp-server/README.md) | MCP tools reference |

---

*Last Updated: 2025-12-27*

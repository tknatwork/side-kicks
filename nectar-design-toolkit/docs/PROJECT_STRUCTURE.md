# Project Structure - Nectar Design System

**Purpose**: Document the organized project structure for scalability and clarity.

---

## Current Directory Layout

```
design-docs/
├── My Portfolio/                    ← 🔷 GitHub Repo (Portfolio Codebase)
│   │
│   ├── 📁 src/                      ← React Application Source
│   │   ├── components/              ← Reusable UI components
│   │   │   ├── Hero.jsx
│   │   │   ├── ProjectCard.jsx
│   │   │   ├── ProjectGrid.jsx
│   │   │   └── Resume.jsx
│   │   ├── projects/                ← Project-specific pages
│   │   │   ├── project-1/
│   │   │   └── project-3/
│   │   ├── tokens/                  ← Design token exports
│   │   │   └── tokens.json          ← SOURCE OF TRUTH
│   │   ├── App.jsx                  ← Main app component
│   │   ├── main.jsx                 ← Entry point
│   │   ├── style.css                ← Global styles
│   │   ├── variables.css            ← CSS variables (from tokens)
│   │   └── supabaseClient.js        ← Supabase configuration
│   │
│   ├── 📁 public/                   ← Static assets
│   │
│   ├── 📁 docs/                     ← Documentation
│   │   ├── FIGMA_PLUGIN_SETUP.md    ← Plugin installation guide
│   │   ├── TASKS.md                 ← Task tracking
│   │   ├── WALKTHROUGH.md           ← AI implementation guide
│   │   ├── DESIGN_SYSTEM_STRUCTURE.md  ← Token architecture
│   │   └── PROJECT_STRUCTURE.md     ← This file
│   │
│   ├── 📁 scripts/                  ← Build scripts
│   │   ├── build-tokens.js          ← Convert tokens to CSS
│   │   └── fetch-figma.js           ← Fetch tokens from Figma API
│   │
│   ├── 📁 AI_TOOLING/               ← 🤖 AI Agent Infrastructure
│   │   │
│   │   ├── 📁 figma-plugin/         ← Figma Plugin (runs in Figma)
│   │   │   ├── manifest.json        ← Plugin manifest
│   │   │   ├── code.ts              ← Plugin source (TypeScript)
│   │   │   ├── code.js              ← Compiled output
│   │   │   ├── ui.html              ← Plugin UI
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   │
│   │   ├── 📁 bridge-server/        ← WebSocket Bridge
│   │   │   ├── index.js             ← Bridge server code
│   │   │   └── package.json
│   │   │
│   │   └── 📁 mcp-server/           ← MCP Server (for VS Code/Claude)
│   │       ├── src/
│   │       │   └── index.ts         ← Server source
│   │       ├── build/
│   │       │   └── index.js         ← Compiled output
│   │       ├── package.json
│   │       ├── tsconfig.json
│   │       └── README.md
│   │
│   ├── .env.example                 ← Environment template
│   ├── .env.local                   ← Local environment (gitignored)
│   ├── .gitignore
│   ├── AI_CONTEXT.md                ← Context for AI assistants
│   ├── CHANGELOG.md                 ← Version history
│   ├── LICENSE
│   ├── index.html                   ← Vite entry HTML
│   ├── package.json                 ← Root dependencies
│   └── vite.config.js               ← Vite configuration
│
├── Portfolio Files/                 ← 📂 External Assets (Not in Git)
│   └── Resume.pdf                   ← Resume PDF
│
└── Extension for VS Code/           ← 🧩 VS Code Extensions
    └── figma.figma-vscode-extension-0.4.3.vsix
```

---

## Directory Purposes

### 🔷 My Portfolio/ (GitHub Repository)
**What goes here**: Everything that should be version controlled
- React application source code
- Design tokens and CSS
- Documentation
- Build configuration
- AI tooling infrastructure

**Git Strategy**: This entire folder is the Git root

---

### 🤖 AI_TOOLING/ (AI Agent Infrastructure)
**Location**: `My Portfolio/AI_TOOLING/`

**Purpose**: Houses all tools that enable AI agents (Claude, VS Code Copilot) to interact with Figma.

**Why inside the repo**: 
- Version controlled alongside the codebase
- Consistent deployment
- Single source of truth for configuration

**Components**:

| Component | Port | Purpose |
|-----------|------|---------|
| `figma-plugin/` | N/A | Runs inside Figma Desktop |
| `bridge-server/` | 9876 (WS), 9877 (HTTP) | Relays messages between MCP and Plugin |
| `mcp-server/` | stdio | Provides tools to AI assistants |

---

### 📂 Portfolio Files/ (External Assets)
**What goes here**: Files that should NOT be in the Git repository
- Large binary files (PDFs, videos, high-res images)
- Personal documents
- Temporary exports

**Current Contents**:
- `Resume.pdf` - Uploaded to Supabase Storage

---

### 🧩 Extension for VS Code/ (VS Code Extensions)
**What goes here**: Downloaded VS Code extensions (VSIX files)
- Figma VS Code extension
- Other development tools

**Note**: These are installable packages, not source code

---

## Migration Required

### Current State → Target State

The AI tooling is currently at the root level of "My Portfolio". We need to move it:

```bash
# Current location
My Portfolio/figma-plugin/
My Portfolio/bridge-server/
My Portfolio/mcp-server/

# Target location
My Portfolio/AI_TOOLING/figma-plugin/
My Portfolio/AI_TOOLING/bridge-server/
My Portfolio/AI_TOOLING/mcp-server/
```

### Migration Steps

1. Create `AI_TOOLING/` directory
2. Move `figma-plugin/` to `AI_TOOLING/figma-plugin/`
3. Move `bridge-server/` to `AI_TOOLING/bridge-server/`
4. Move `mcp-server/` to `AI_TOOLING/mcp-server/`
5. Update any import paths (none expected - isolated modules)
6. Update documentation paths
7. Update VS Code MCP configuration (if applicable)

---

## .gitignore Recommendations

```gitignore
# Dependencies
node_modules/
AI_TOOLING/*/node_modules/

# Build outputs
dist/
AI_TOOLING/figma-plugin/code.js
AI_TOOLING/mcp-server/build/

# Environment
.env.local
.env

# IDE
.DS_Store
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json

# Logs
*.log
```

---

## Package Scripts Reference

### Root (My Portfolio/)
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "build:tokens": "node scripts/build-tokens.js",
    "fetch:figma": "node scripts/fetch-figma.js"
  }
}
```

### AI Tooling Scripts (run from respective directories)
```bash
# Build Figma Plugin
cd AI_TOOLING/figma-plugin && npm run build

# Start Bridge Server
cd AI_TOOLING/bridge-server && npm start

# Build MCP Server
cd AI_TOOLING/mcp-server && npm run build
```

---

## File Ownership

| Path | Owner | Edits By |
|------|-------|----------|
| `src/` | Developer | Developer, AI with approval |
| `docs/` | Developer | AI can update |
| `AI_TOOLING/` | AI/Developer | Both |
| `tokens/tokens.json` | Design System | AI updates from Figma |
| `Portfolio Files/` | Developer | Developer only |

---

*Last Updated: 2025-01-17*

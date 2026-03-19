# Nectar Design System - Implementation Walkthrough

**Project**: Portfolio Design System (Nectar)  
**Purpose**: Step-by-step guide for AI agents to build the design system  
**Last Updated**: 2025-01-14  
**AI Model**: Claude Opus 4.5 (Preview)

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Prerequisites & Setup](#2-prerequisites--setup)
3. [Building Tokens in Figma](#3-building-tokens-in-figma)
4. [Building Styles in Figma](#4-building-styles-in-figma)
5. [Building Components in Figma](#5-building-components-in-figma)
6. [Syncing to Code](#6-syncing-to-code)
7. [Applying to React Components](#7-applying-to-react-components)
8. [NDS Builder Plugin](#8-nds-builder-plugin)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. System Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NECTAR DESIGN SYSTEM                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┐          ┌──────────────────────┐                │
│  │    FIGMA (Design)    │          │   CODEBASE (Dev)     │                │
│  │                      │          │                      │                │
│  │  ┌────────────────┐  │  Sync    │  ┌────────────────┐  │                │
│  │  │ Nectar-Tokens  │──┼──────────┼──│  tokens.json   │  │                │
│  │  │ (Variables)    │  │          │  │  (Source)      │  │                │
│  │  └────────────────┘  │          │  └───────┬────────┘  │                │
│  │                      │          │          │           │                │
│  │  ┌────────────────┐  │          │  ┌───────▼────────┐  │                │
│  │  │ Nectar-Icons   │  │          │  │ variables.css  │  │                │
│  │  │ (SVG Library)  │  │          │  │ (Generated)    │  │                │
│  │  └────────────────┘  │          │  └───────┬────────┘  │                │
│  │                      │          │          │           │                │
│  │  ┌────────────────┐  │          │  ┌───────▼────────┐  │                │
│  │  │ Nectar-Comps   │  │  Refer   │  │  Components    │  │                │
│  │  │ (Components)   │──┼──────────┼──│  (React/JSX)   │  │                │
│  │  └────────────────┘  │          │  └────────────────┘  │                │
│  │                      │          │                      │                │
│  └──────────────────────┘          └──────────────────────┘                │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                        AI CONTROL LAYER                               │ │
│  │                                                                       │ │
│  │   VS Code ──► MCP Server ──► Bridge Server ──► Figma Plugin ──► Figma │ │
│  │      │                           │                                    │ │
│  │      └───────── HTTP ────────────┘                                    │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Design Phase**: AI creates variables/styles/components in Figma via Plugin
2. **Validation Phase**: MCP Server reads Figma to validate structure
3. **Sync Phase**: Export tokens from Figma → tokens.json → variables.css
4. **Implementation Phase**: Apply CSS variables to React components

---

## 2. Prerequisites & Setup

### Before Starting Any Work

1. **Start Bridge Server**
   ```bash
   cd AI_TOOLING/bridge-server
   npm start
   ```
   Expected output:
   ```
   🔌 WebSocket server started on ws://localhost:9876
   🌐 HTTP server started on http://localhost:9877
   ```

2. **Open Figma Desktop App**
   - Must use Desktop app (not web)
   - Open the target design file

3. **Run Plugin**
   - Plugins → Development → Portfolio DS Builder
   - Click "Connect" in plugin UI
   - Verify "Connected" status

4. **Verify Connection via MCP**
   ```
   Use tool: check_bridge_status
   ```
   Expected: "✅ Bridge Server connected!"

---

## 3. Building Tokens in Figma

### 3.1 Token Hierarchy (4-Tier System) - Mobile-First

```
TIER 1: BRAND (Primitives) - 68 variables, HIDDEN
├── colors/
│   ├── pink/50-950 (11 shades)
│   ├── neutral/50-950 (11 shades)
│   ├── success/, warning/, danger/, info/ (state colors)
│   └── white/pure, black/pure
└── fonts/
    ├── family/sans, serif, mono
    └── size/xs-9xl

TIER 2: ALIAS (Semantic) - ~300 variables, HIDDEN, **MOBILE BASE VALUES**
├── bg/ (backgrounds)
│   ├── page, canvas, surface/default-inverse
│   └── card/default-elevated
├── fg/ (foreground/text)
│   └── primary, secondary, tertiary, muted, inverse
├── border/ (borders)
│   └── default, subtle, strong, focus, error
├── layout/ (responsive - MOBILE values as defaults)
│   ├── container/max = 9999 (full-width on mobile)
│   ├── container/narrow = 9999
│   └── maxWidth/, minHeight/ etc.
├── grid/ (MOBILE values as defaults)
│   ├── gap/default = 16 (mobile)
│   ├── gutter/default = 16
│   └── margin/default = 20
└── size/component/ (MOBILE values as defaults)
    ├── nav/height = 56 (mobile nav)
    ├── logo = 32 (mobile logo)
    └── touch/min = 44 (larger on mobile)

TIER 3.1: MAPPED (Component Tokens) - 141 variables, Light/Dark modes
├── button/ (primary, secondary, ghost, danger - bg/fg/border)
├── input/ (bg, fg, border, placeholder, focus, error)
├── card/ (bg, border, shadow)
├── shape/ (radius for button, card, input, badge, modal, tooltip)
├── elevation/ (shadows sm-2xl)
├── motion/ (easing STRING tokens)
└── icon/ (default, muted, inverse, interactive)

TIER 3.2: BREAKPOINTS (Responsive Tokens) - 385 variables, Desktop/Tablet/Mobile modes
├── Mobile mode → ALIASES to Alias (inherits mobile base values)
├── Tablet mode → DIRECT values (e.g., container/max = 720)
├── Desktop mode → DIRECT values (e.g., container/max = 1280)
├── typescale/ (display, heading/h1-h6, body/lg-xs, ui/*)
├── space/ (component/xs-2xl, section/xs-2xl)
├── gap/ (xs-2xl)
├── size/ (touch/min-comfortable, button/*, input/height, modal/*, icon/*)
├── grid/ (columns, gap, margin)
└── container/ (max, prose, padding)

TOTAL: ~900 variables across 4 collections
```

### Mobile-First Architecture

The design system follows **mobile-first principles**:

| Mode | Source | Example: container/max |
|------|--------|------------------------|
| **Mobile** | Alias to base value | → 9999 (full-width) |
| **Tablet** | Direct FLOAT | → 720px |
| **Desktop** | Direct FLOAT | → 1280px |

**Benefits:**
- Single source of truth for mobile values in Alias
- Tablet/Desktop values clearly visible in Breakpoints
- No redundant /mobile, /tablet suffixed variables
- Cleaner, more maintainable architecture

### 3.2 Step-by-Step Token Creation

#### Step 1: Create Brand Collection
```
Use tool: create_variable_collection
Parameters:
  name: "Brand"
  modes: ["Default"]

Save the returned collection ID for later use.
```

#### Step 2: Create Pink Color Scale
```
For each color (50, 100, 200, 300, 400, 500, 600, 700, 800, 900):

Use tool: create_variable
Parameters:
  collectionId: "<brand_collection_id>"
  name: "colors/pink/500"  (example)
  type: "COLOR"

Then set value:
Use tool: set_variable_value
Parameters:
  variableId: "<returned_variable_id>"
  modeId: "<default_mode_id>"
  value: { hex: "#FF90E8" }  (example for pink-500)
```

#### Gumroad Color Values Reference
| Token | Hex Value |
|-------|-----------|
| pink/50 | #FFF5FB |
| pink/100 | #FFE5F5 |
| pink/200 | #FFD4F0 |
| pink/300 | #FFC0E9 |
| pink/400 | #FFA8E0 |
| pink/500 | #FF90E8 |
| pink/600 | #E57FD0 |
| pink/700 | #CC6FB9 |
| pink/800 | #B25FA1 |
| pink/900 | #994F8A |
| black/pure | #000000 |
| white/cream | #FEFEFE |
| accent/yellow | #FFC900 |
| accent/cyan | #23A094 |
| accent/blue | #36B3FF |
| accent/green | #4DDE80 |
| accent/orange | #FF6B35 |
| accent/purple | #9055FF |

#### Step 3: Create Alias Collection with Modes
```
Use tool: create_variable_collection
Parameters:
  name: "Alias"
  modes: ["Light", "Dark"]

This creates a collection with two modes for theming.
```

#### Step 4: Create Semantic Variables with Aliases
```
Create variable:
Use tool: create_variable
Parameters:
  collectionId: "<alias_collection_id>"
  name: "color/background/primary"
  type: "COLOR"

Set Light mode value (alias to Brand):
Use tool: set_variable_value
Parameters:
  variableId: "<variable_id>"
  modeId: "<light_mode_id>"
  value: { aliasId: "<brand_white_cream_variable_id>" }

Set Dark mode value:
Use tool: set_variable_value
Parameters:
  variableId: "<variable_id>"
  modeId: "<dark_mode_id>"
  value: { aliasId: "<brand_black_900_variable_id>" }
```

#### Step 5: Create Breakpoints Collection

```
Use tool: create_variable_collection
Parameters:
  name: "Breakpoints"
  modes: ["Desktop", "Tablet", "Mobile"]
```

---

## 4. Building Styles in Figma

### 4.1 Color Styles

Color styles should reference variables for automatic theme support.

```
Use tool: create_color_style
Parameters:
  name: "Brand/Primary"
  hex: "#FF90E8"
  description: "Primary brand color - Gumroad pink"
```

Style naming convention:
- `Brand/Primary`, `Brand/Secondary`
- `Background/Primary`, `Background/Secondary`
- `Text/Primary`, `Text/Secondary`, `Text/Accent`
- `Border/Primary`, `Border/Accent`
- `Status/Success`, `Status/Error`, `Status/Warning`

### 4.2 Text Styles

```
Use tool: create_text_style
Parameters:
  name: "Heading/H1"
  fontFamily: "Switzer"
  fontStyle: "Bold"
  fontSize: 48
  lineHeight: { value: 1.1, unit: "PERCENT" }
  letterSpacing: { value: -0.02, unit: "PERCENT" }
  description: "Main page headings"
```

Text style naming convention:
- `Heading/H1` through `Heading/H6`
- `Body/Large`, `Body/Regular`, `Body/Small`
- `Label/Large`, `Label/Regular`, `Label/Small`
- `Code/Block`, `Code/Inline`

### 4.3 Effect Styles (Gumroad Hard Shadows)

```
Use tool: create_effect_style
Parameters:
  name: "Shadow/Hard-MD"
  effects: [{
    type: "DROP_SHADOW",
    color: { hex: "#000000", alpha: 1 },
    offset: { x: 4, y: 4 },
    radius: 0,
    spread: 0
  }]
  description: "Medium hard shadow - Gumroad style"
```

Shadow naming convention:
- `Shadow/Hard-SM` (2px offset)
- `Shadow/Hard-MD` (4px offset)
- `Shadow/Hard-LG` (6px offset)
- `Shadow/Hard-XL` (8px offset)
- `Shadow/Hover` (6px - for hover states)
- `Shadow/Active` (2px - for pressed states)

---

## 5. Building Components in Figma

### 5.1 Component Structure

Each component should follow this structure:
```
ComponentName/
├── Variants (property=value naming)
│   ├── State=Default, State=Hover, State=Active, State=Disabled
│   ├── Size=Small, Size=Medium, Size=Large
│   └── Type=Primary, Type=Secondary, Type=Ghost
└── Documentation frame with usage notes
```

### 5.2 Button Component Example

```
Use tool: create_frame
Parameters:
  name: "Button/State=Default, Type=Primary, Size=Medium"
  width: 120
  height: 44
  fillHex: "#FF90E8"
  layoutMode: "HORIZONTAL"
  padding: { top: 12, right: 24, bottom: 12, left: 24 }

Then add text, apply border, shadow, etc.
```

### 5.3 Component Properties Checklist

For each component, define:
- [ ] States: Default, Hover, Active, Disabled, Focus
- [ ] Sizes: Small, Medium, Large (if applicable)
- [ ] Types/Variants: Primary, Secondary, etc.
- [ ] Responsive behavior notes
- [ ] Accessibility requirements (contrast, focus states)

---

## 6. Syncing to Code

### 6.1 Export Tokens from Figma

After all tokens are created in Figma:

```
Use tool: fetch_figma_tokens
# Preview the tokens

Use tool: sync_figma_tokens
# Syncs to tokens.json and generates variables.css
```

### 6.2 Manual Token Build (if needed)

```bash
cd "My Portfolio"
npm run fetch-tokens
```

### 6.3 Verify Generated Files

Check `src/tokens/tokens.json`:
- All collections present
- All variables with correct values
- Proper hierarchy maintained

Check `src/variables.css`:
- CSS custom properties generated
- Proper naming convention (--color-background-primary)
- All modes represented

---

## 7. Applying to React Components

### 7.1 Using CSS Variables

```css
/* In component CSS */
.button-primary {
  background-color: var(--color-interactive-primary);
  color: var(--color-text-inverse);
  border: 3px solid var(--color-border-primary);
  box-shadow: var(--shadow-hard-md);
  transition: all var(--animation-duration-fast) var(--animation-easing-easeOut);
}

.button-primary:hover {
  box-shadow: var(--shadow-hover);
  transform: translate(-2px, -2px);
}

.button-primary:active {
  box-shadow: var(--shadow-active);
  transform: translate(0, 0);
}
```

### 7.2 Theme Switching

```jsx
// In App.jsx or theme context
const [theme, setTheme] = useState('light');

useEffect(() => {
  document.documentElement.setAttribute('data-theme', theme);
}, [theme]);
```

```css
/* In variables.css */
:root, [data-theme="light"] {
  --color-background-primary: var(--alias-background-primary-light);
}

[data-theme="dark"] {
  --color-background-primary: var(--alias-background-primary-dark);
}
```

### 7.3 Responsive Tokens

```css
/* Mobile first */
:root {
  --container-max-width: 100%;
  --container-padding: var(--spacing-4);
  --grid-columns: 4;
}

@media (min-width: 768px) {
  :root {
    --container-max-width: 720px;
    --container-padding: var(--spacing-8);
    --grid-columns: 8;
  }
}

@media (min-width: 1024px) {
  :root {
    --container-max-width: 960px;
    --container-padding: var(--spacing-12);
    --grid-columns: 12;
  }
}

@media (min-width: 1440px) {
  :root {
    --container-max-width: 1200px;
    --container-padding: var(--spacing-16);
  }
}
```

---

## 9. Icon Import from Central Icon System

### 9.1 Overview

The Nectar Icon System contains **2620 icons** across **33 categories**, extracted from the Central Icon System with consistent parameters (stroke=1, radius=3, join=round).

### 9.2 Prerequisites

1. **Source icons in NDS file** - Copy icons from Central Icon System to a "Temporary Icons" page in NDS
2. **Plugin running** - Figma plugin must be loaded and connected
3. **Orchestration server** - Running on port 9877

### 9.3 Icon Import Commands

```bash
cd AI_TOOLING/orchestration-server

# List all categories on Temporary Icons page
node extract-temp-icons.cjs list-categories

# Scan icons (dry run - shows what will be extracted)
node extract-temp-icons.cjs scan

# Extract ALL icons (batch mode - one category at a time)
node extract-temp-icons.cjs extract

# Extract single category (for testing or retry)
node extract-temp-icons.cjs extract-category "Arrows"
```

### 9.4 How Batch Extraction Works

The script processes one category at a time to avoid Figma plugin timeouts:

1. **Get category list** - Fetches all category frames from source page
2. **Process each category** - For each category:
   - Scans for COMPONENT_SET nodes
   - Finds variants matching: `stroke=1, radius=3, join=round`
   - Extracts both `filled=off` (outline) and `filled=on` (filled) variants
   - Clones and flattens each icon to vector
   - Binds colors to `fg/default` variable
   - Creates category frame with auto-layout
   - Converts category frame to component

### 9.5 Icon Naming Convention

| Type | Format | Example |
|------|--------|---------|
| Outline | `icon-name` | `arrow-up` |
| Filled | `icon-name_filled` | `arrow-up_filled` |

### 9.6 Category Structure

Each category is a component containing:
```
icon-category/arrows (Component)
├── "Arrows" (Title text)
└── Icons (Auto-layout frame)
    ├── arrow-up (24x24 frame)
    │   └── icon (flattened vector, bound to fg/default)
    ├── arrow-up_filled
    ├── arrow-down
    └── ...
```

### 9.7 Icon Specifications

| Property | Value |
|----------|-------|
| Base Size | 24×24px |
| Stroke | 1px |
| Radius | 3px |
| Join | Round |
| Color Binding | `fg/default` (Mapped collection) |
| Inner Vector Name | `icon` |

### 9.8 Troubleshooting

**Category extraction fails:**
- Check plugin connection: `curl http://localhost:9877/status`
- Verify source page ID in script (default: 138:478)
- Check server logs for errors

**Variable binding failed:**
- Ensure `fg/default` variable exists in Mapped collection
- Check variable is COLOR type with proper scopes

**Icons not appearing:**
- Verify target page ID (default: 110:2)
- Check category Y positions (auto-calculated)

---

## 10. NDS Documentation Enhancement

### 10.1 Documentation Structure

The 📚 NDS Documentation page contains comprehensive design system documentation with accurate token data.

**Documentation Sections (Frame IDs):**
| Section | Frame ID | X Position | Content |
|---------|----------|------------|----------|
| Cover | 179:3136 | 0 | Hero with system overview |
| Architecture | 179:3163 | 1540 | 4-tier token flow diagram |
| Color System | 179:3193 | 3080 | Complete color documentation |
| Typography | 179:3323 | 4620 | Text styles reference |
| Spacing | 179:3395 | 6160 | Spacing scale |
| Effects | 179:3441 | 7700 | Shadows, radius, blur |
| Theming | 181:3468 | 9240 | Light/Dark mode |
| Responsive | 181:3483 | 10780 | Breakpoints |
| Usage Guidelines | 181:3501 | 12320 | Best practices |
| Quick Reference | 181:3511 | 13860 | Token lookup |

### 10.2 Color System Documentation (Enhanced Dec 2, 2025)

**New Frames Added:**
| Frame | ID | Content |
|-------|-----|----------|
| Brand Primitives Reference | 183:3689 | 68 brand tokens with hex values |
| Semantic Alias Tokens Reference | 183:3692 | Alias→Brand mappings |
| Mapped Colors Light/Dark | 183:3695 | Component tokens per mode |
| Component Color Tokens | 183:3698 | UI component tokens |

**Brand Color Scales (Verified):**
```
PINK (Primary):    100:#FFEBF8 → 900:#804673
PURPLE (Secondary): 100:#EEF0F9 → 900:#465273
GREEN (Success):   100:#E1F7F5 → 900:#0A4D46
ORANGE (Warning):  100:#FFF7E1 → 900:#806300
RED (Danger):      100:#FBECEA → 900:#69180E
YELLOW (Tertiary): 100:#FDFDE1 → 900:#787918
NEUTRAL:           0:#FFFFFF → 1000:#000000
```

**Semantic Alias Mappings:**
```
primary/*    → pink/*
secondary/*  → purple/*
tertiary/*   → yellow/*
quaternary/* → orange/*
success/*    → green/*
warning/*    → orange/*
danger/*     → red/*
info/*       → purple/*
```

### 10.3 Typography Documentation (Enhanced Dec 2, 2025)

**Complete Text Styles Reference (183:3701):**
- Display: Lg/Md/Sm (64-40px, Weight 700)
- Heading: H1-H6 (36-16px, Weight 600-700)
- Body: Lg/Md/Sm (18-14px, Weight 400)
- Label: Lg/Md/Sm (16-12px, Weight 500)
- Caption: 12px, Weight 400
- Overline: 12px, Weight 600, UPPERCASE
- Code: JetBrains Mono, 14px
- Quote: Merriweather Italic, 18px
- Button: Lg/Md/Sm (16-12px, Weight 500)

### 10.4 Responsive Documentation (Enhanced Dec 2, 2025)

**Breakpoints Reference (183:3704):**

| Mode | ID | Viewport |
|------|-----|----------|
| Desktop | 101:0 | ≥ 1280px |
| Tablet | 101:1 | 768-1279px |
| Mobile | 101:2 | < 768px |

**Responsive Token Categories:**
- Typography sizes (display, heading, body, label, caption, code, quote)
- Section spacing (3xl-sm)
- Layout spacing (3xl-sm)
- Stack spacing (xl-xs)
- Gap system (2xl-xs)
- Grid columns (12/8/4)
- Border radius (xl-sm)

### 10.5 Commands Used for Documentation

```bash
# Get variable collection details
curl -X POST http://localhost:9877/command \
  -d '{"command": "get_vars_detailed", "payload": {"collectionId": "VariableCollectionId:90:2"}}'

# Create documentation frame
curl -X POST http://localhost:9877/command \
  -d '{"command": "create_frame", "payload": {"name": "Frame Name", "width": 1200, "height": 600}}'

# Set auto-layout
curl -X POST http://localhost:9877/command \
  -d '{"command": "set_auto_layout", "payload": {"nodeId": "ID", "layoutMode": "VERTICAL"}}'

# Create text content
curl -X POST http://localhost:9877/command \
  -d '{"command": "create_text", "payload": {"text": "Content", "fontSize": 14}}'

# Append to parent frame
curl -X POST http://localhost:9877/command \
  -d '{"command": "append_to_frame", "payload": {"frameId": "PARENT_ID", "childIds": ["CHILD_ID"]}}'

# Delete orphaned nodes
curl -X POST http://localhost:9877/command \
  -d '{"command": "delete_node", "payload": {"nodeId": "NODE_ID"}}'
```

---

## 8. NDS Builder Plugin

### Overview

The **NDS Builder** is a standalone Figma plugin for bootstrapping new Nectar Design System files. Unlike the Portfolio DS Builder (which requires the orchestration server), NDS Builder works independently.

**Location**: `AI_TOOLING/nds-builder/`

### Purpose

Use this plugin when:
- Creating a new Nectar DS Figma file from scratch
- Building foundational pages, text styles, effect styles, and grid styles
- Need a quick way to set up DS structure without the full orchestration server

### Usage

1. **Build the Plugin**
   ```bash
   cd AI_TOOLING/nds-builder
   pnpm build
   ```

2. **Load in Figma**
   - Figma → Plugins → Development → Import plugin from manifest
   - Select `AI_TOOLING/nds-builder/manifest.json`

3. **Run the Plugin**
   - Plugins → Development → NDS Builder
   - Use the buttons to build or clean various assets

### Features

| Button | Action | Output |
|--------|--------|--------|
| **Build Pages** | Creates page structure | 69 pages with separators |
| **Build Text Styles** | Creates typography styles | 37 text styles |
| **Build Effects** | Creates shadow/effect styles | 7 effect styles |
| **Build Grid Styles** | Creates layout grid styles | 5 grid styles |
| **Inspect Grids** | Reads existing grid styles | Logs to console |
| **Clean All/Text/Effects/Pages/Grids** | Removes assets | Deletes selected types |

### Built-in Data

**Page Structure (69 pages)**:
- Getting Started pages
- Foundations (Color, Typography, Spacing, etc.)
- Components (Atoms, Molecules, Organisms)
- Templates
- Utilities
- Documentation

**Text Styles (37 styles)**:
- Display 1-4 (Merriweather serif)
- Headline 1-6 (Plus Jakarta Sans)
- Title 1-3 (Plus Jakarta Sans)
- Body S/M/L/XL + emphasized
- Label S/M/L
- Code S/M/L (Roboto Mono)

**Effect Styles (7 styles)**:
- Elevation: xs, sm, md, lg, xl
- Inner Shadow: small, large
- Neo-brutalism shadow (8px offset)

**Grid Styles (5 styles)**:
- Layout Grid/Desktop: 24 columns
- Layout Grid/Tablet: 12 columns
- Layout Grid/Mobile: 4 columns
- Baseline/4px: Square grid
- Baseline/8px: Square grid

### Technical Notes

- **No server required**: Works standalone
- **Figma sandbox compatible**: Avoids spread operators (`...`)
- **Uses async APIs**: `figma.getLocalTextStylesAsync()` etc.
- **TypeScript**: Source in `src/code.ts`, compiled to `code.js`

---

## 9. Troubleshooting

### Common Issues

#### Plugin Won't Connect
1. Verify Bridge Server is running
2. Check Figma Desktop (not web)
3. Restart plugin and try reconnect
4. Check browser console in Figma for errors

#### Variables Not Appearing
1. Refresh Figma file (Cmd/Ctrl + Shift + R)
2. Check variable collection permissions
3. Verify mode IDs are correct

#### Sync Fails
1. Check FIGMA_ACCESS_TOKEN in .env.local
2. Verify FIGMA_FILE_ID is correct
3. Check network connectivity

#### CSS Variables Not Working
1. Ensure variables.css is imported in main.jsx
2. Check variable naming (lowercase, hyphens)
3. Verify build process ran successfully

### Getting Help

1. Check `docs/FIGMA_PLUGIN_SETUP.md` for detailed setup
2. Check `docs/DESIGN_SYSTEM_STRUCTURE.md` for token architecture
3. Check `CHANGELOG.md` for recent changes
4. Check `AI_CONTEXT.md` for project context

---

## Appendix: MCP Tool Quick Reference

### READ Tools (Direct API)
| Tool | Purpose |
|------|---------|
| `fetch_figma_tokens` | Get tokens from Figma |
| `sync_figma_tokens` | Sync tokens to project |
| `get_figma_file_info` | File metadata |
| `get_figma_components` | List components |
| `get_figma_styles` | List styles |
| `read_project_tokens` | Read local tokens.json |

### WRITE Tools (via Bridge)
| Tool | Purpose |
|------|---------|
| `check_bridge_status` | Verify connection |
| `create_variable_collection` | Create collection |
| `create_variable` | Create variable |
| `set_variable_value` | Set variable value |
| `create_color_style` | Create color style |
| `create_text_style` | Create text style |
| `create_effect_style` | Create shadow/blur |
| `create_figma_page` | Create page |
| `create_frame` | Create frame |
| `get_variable_collections_live` | Get collections via plugin |
| `get_variables_live` | Get variables via plugin |

---

*This walkthrough is maintained by AI Agents - Last AI: Claude Opus 4.5 (Preview)*

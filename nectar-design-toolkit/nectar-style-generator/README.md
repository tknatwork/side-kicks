# 🍯 Nectar Style Generator

A Figma plugin that generates static Figma Styles from Variable Modes, solving the limitation where typography and spacing variables cannot be directly applied through Figma's "Apply Variable Mode" feature.

## The Problem

When using Figma's Variable Modes:
- **Color variables** work seamlessly through the Fill property
- **Typography variables** (font size, line height, letter spacing) **don't work** because text styles are static and not mode-aware
- **Effect variables** (shadows) face the same limitation

This plugin bridges that gap by extracting variable values for your selected mode combination and creating actual Figma Styles.

## Features

- 🎨 **Theme Selection**: Choose between Light and Dark modes (from Mapped collection)
- 📱 **Breakpoint Selection**: Choose Desktop, Tablet, or Mobile (from Breakpoints collection)
- 🔍 **Font Check**: Scan required fonts before generating to identify missing fonts/weights
- ⚡ **One-Click Generation**: Generate all styles for selected modes
- 🗑️ **Clean Regeneration**: Automatically clears old styles when switching modes
- 📊 **Style Statistics**: See how many styles were generated (Colors, Text, Effects, Grids)
- 🔤 **Emphasized Typography**: Base + emphasized text styles with font inheritance
- 🛡️ **Smart Font Fallback**: Emphasized styles prefer heavier weights (Bold) over lighter (Regular)

## Installation

### For Development

1. Clone or download this folder
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. In Figma Desktop:
   - Go to **Plugins → Development → Import plugin from manifest...**
   - Select the `manifest.json` file from this folder

### For Production (Publishing)

1. Build the plugin: `npm run build`
2. In Figma, go to **Plugins → Manage plugins...**
3. Click **Publish new plugin**
4. Select the `manifest.json` file
5. Fill in the required information and submit

## Usage

1. Open the plugin in Figma
2. Select your desired **Theme Mode** (Light or Dark)
3. Select your desired **Breakpoint Mode** (Desktop, Tablet, or Mobile)
4. **🔍 Check Required Fonts** (recommended):
   - Click the "Check Required Fonts" button
   - Review which fonts are installed vs missing
   - Install any missing fonts before generating
5. Click **⚡ Generate Styles**
6. The plugin will:
   - Clear any previously generated Nectar styles
   - Extract values from your variables for the selected modes
   - Create new Figma Styles (Color, Text, Effect, Grid)

## Generated Styles

The plugin creates styles with the `🍯` prefix for easy identification:

### Color Styles (136 styles)

- `🍯 bg/default` - Background colors
- `🍯 fg/default` - Foreground colors
- `🍯 primary/bg/default` - Semantic colors

### Text Styles (44 styles = 22 base + 22 emphasized)

- `🍯 text/display/xl` - Base display text
- `🍯 text/display/xl-emphasized` - Emphasized display text (inherits size/lineHeight from base)
- `🍯 text/heading/h1` - Heading styles
- `🍯 text/body/md` - Body text styles
- `🍯 text/label/md` - Label styles
- `🍯 text/code` - Monospace code text (JetBrains Mono)
- `🍯 text/quote` - Quote text (Merriweather)

### Effect Styles (4 styles)

- `🍯 elevation/sm` - Small shadow
- `🍯 elevation/md` - Medium shadow
- `🍯 elevation/lg` - Large shadow
- `🍯 elevation/xl` - Extra large shadow

### Grid Styles (8 styles)

Layout Grid styles for frame-level alignment guides:

| Style | Use Case |
|-------|----------|
| `🍯 grid/main` | Page-level layouts, main content wrapper |
| `🍯 grid/base` | General purpose, inherits page grid values |
| `🍯 grid/default` | Standard components, cards, forms |
| `🍯 grid/compact` | Dense UIs, data tables, toolbars (8px gap) |
| `🍯 grid/loose` | Hero sections, marketing (32px gap) |
| `🍯 grid/sm` | Small components (4 columns) |
| `🍯 grid/md` | Medium components (8 columns) |
| `🍯 grid/lg` | Large components (12 columns) |

**How to apply:** Select Frame → Right panel → Layout Grid → Click 4-dot icon → Choose from Local Styles

## Variable Naming Conventions

The plugin works with the Nectar Design System's 4-tier architecture:

### Mapped Collection (COLOR + STRING variables)

```text
bg/default           → Background colors
fg/default           → Foreground/text colors
border/default       → Border colors
primary/bg/default   → Semantic colors
```

### Breakpoints Collection (FLOAT variables)

```text
typescale/display/xl      → Font size
typescale/display/xl/lineHeight    → Line height  
typescale/display/xl/letterSpacing → Letter spacing
typescale/display/xl/weight        → Font weight (base)
typescale/display/xl-emphasized/weight → Font weight (emphasized)
```

### Effects (in Breakpoints)

```text
elevation/md/blur     → Shadow blur
elevation/md/y        → Shadow Y offset
elevation/md/spread   → Shadow spread
elevation/md/x        → Shadow X offset
```

## Requirements

- Figma Desktop app (for development)
- Variable collections matching Nectar DS architecture:
  - **Mapped collection** with modes: `Light`, `Dark`
    - Contains: 136 COLOR variables + 5 STRING variables (motion easings)
  - **Breakpoints collection** with modes: `Desktop`, `Tablet`, `Mobile`
    - Contains: 385 FLOAT variables (typography, spacing, effects)

## Development

```bash
# Install dependencies
npm install

# Build once
npm run build

# Watch for changes
npm run watch

# Clean build
npm run clean
```

## How It Works

1. **Collection Detection**: Identifies "Mapped" (COLOR/STRING) and "Breakpoints" (FLOAT) collections by name
2. **Mode Resolution**: Resolves variable values for selected theme mode (Light/Dark) and breakpoint mode (Desktop/Tablet/Mobile)
3. **Color Styles**: Creates 136 paint styles from COLOR variables in Mapped collection
4. **Text Styles**:
   - Groups typography variables by base name (`typescale/display/xl`)
   - Creates base styles with fontSize, lineHeight, letterSpacing, fontWeight
   - Creates emphasized variants (`-emphasized`) that inherit size/lineHeight from base
   - Applies font family based on style type:
     - `quote` → Merriweather (serif)
     - `code` → JetBrains Mono (mono)
     - others → Switzer (sans)
5. **Effect Styles**: Groups elevation variables (`elevation/md/blur`, `elevation/md/y`, etc.) into drop shadow effects
6. **Grid Styles**: Creates Layout Grid styles from grid variables (`grid/columns`, `grid/gap`, `grid/margin`)
   - Inherits columns from base for compact/loose variants
   - sm/md/lg variants get different column counts (4/8/12)
7. **Cleanup**: Styles prefixed with `🍯` are cleared before regeneration to prevent duplicates

## Limitations

- **Font Families**: Maps to Alias collection typography/fontFamily/* variables:
  - Switzer (sans) - default for most styles
  - Merriweather (serif) - for `quote` styles  
  - JetBrains Mono (mono) - for `code` styles
- **Font Weights**: Uses smart fallback logic:
  - For emphasized/heavier styles (weight ≥ 500): prefers Bold over Regular
  - For regular styles: prefers lighter weights first
  - Supports Regular, Medium, Semibold, Bold, Extrabold, Black
- **Complex Effects**: Only generates simple drop shadows, not layered effects
- **Variable Structure**: Expects Nectar DS naming patterns (`typescale/`, `elevation/`)

## Font Weight Mapping

| Weight Value | Font Style |
|--------------|------------|
| 100-400 | Regular |
| 401-500 | Medium |
| 501-600 | Semibold |
| 601-700 | Bold |
| 701-800 | Extrabold |
| 801-900 | Black |

If a font weight is unavailable, the plugin falls back: Extrabold → Bold → Semibold → Medium → Regular

## License

MIT License - Feel free to modify and distribute.

---

Made with 💗 for the Nectar Design System

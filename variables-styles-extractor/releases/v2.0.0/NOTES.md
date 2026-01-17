# Variables & Styles Extractor v2.0.0

**Release Date:** January 2025

## 🎉 Major Release - Complete UI Overhaul

### ✨ New Features

- **Library Support** - Full support for library variables with detection and linking
- **Automatic Rollback** - Import failures automatically restore previous state
- **Smart Search** - Real-time search across all item types
- **Inline Edit Mode** - Edit JSON directly in the preview panel
- **Import All / Export All** - One-click operations for all item types

### 🎨 UI Changes

- Complete redesign with Export/Import two-panel layout
- Sticky navigation and search header
- Unified button bar with consistent styling
- Color-coded item type badges
- Improved visual feedback with animations

### ⚡ Performance Improvements

- **Web Worker** - JSON parsing offloaded to background thread
- **Result Caching** - LRU cache (10 entries, 60s TTL) for repeated operations
- **Throttled Validation** - 300ms debounce for smooth typing
- **Async Operations** - Non-blocking JSON stringify/parse

### 🛡️ Reliability

- Import button disables during processing (prevents double-clicks)
- Clear button flashes red after import (visual cue for next action)
- Comprehensive error handling with user-friendly messages
- Automatic state preservation during failures

### 📁 Files Included

- `code.js` - Compiled plugin backend
- `ui.html` - Plugin UI
- `manifest.json` - Figma plugin configuration
- `LICENSE` - MIT License

### 📝 Installation

1. Download all files in this folder
2. In Figma Desktop: Plugins → Development → Import plugin from manifest...
3. Select the `manifest.json` file

### 🔗 Links

- [Figma Community](https://www.figma.com/community/plugin/variables-styles-extractor)
- [GitHub Repository](https://github.com/tknatwork/side-kicks)
- [Documentation](../docs/)

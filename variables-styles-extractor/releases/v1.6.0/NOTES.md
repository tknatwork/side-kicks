# v1.6.0 - 2025-12-22

## 🎉 First Public Release

**Status:** Published to Figma Community

### What's Included
- Full variable export/import with mode support
- All 4 style types (Color, Text, Effect, Grid)
- Variable aliases preserved
- Style-to-variable bindings preserved
- Plan-based mode limits validation
- Universal color parser

### Files
- `code.js` - Minified plugin code (Terser)
- `ui.html` - Plugin UI
- `manifest.json` - Figma plugin manifest
- `LICENSE` - MIT License

### Build Info
- TypeScript target: ES2017
- Minification: Terser (--compress --mangle --keep-fnames)
- Source lines: ~1900 → Minified: 10 lines

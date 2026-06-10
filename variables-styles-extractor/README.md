# Variables & Styles Extractor

[![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-ff69b4)](https://www.figma.com/community/plugin/1584331992332668732/variables-and-styles-extractor)
[![Source: MIT](https://img.shields.io/badge/Source-MIT-yellow.svg)](./LICENSE)
[![Distribution: CFRL](https://img.shields.io/badge/Figma%20Distribution-CFRL-blueviolet.svg)](https://www.figma.com/community-free-resource-license/)
[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](./package.json)

**Move your design system anywhere. Export and import Figma variables and styles — selectively, safely, and in Tokens Studio–compatible JSON.**

> 🔍 **Status:** v2.1.0 in final testing — v2.0.0 published to Figma Community (17 January 2026)

## Features

### Variables
- ✅ Color, Number, String, Boolean variables
- ✅ Variable collections with multiple modes (up to 20+)
- ✅ Variable aliases and references
- ✅ Library-linked variable detection

### Styles
- ✅ Color styles (solid, gradient, image fills)
- ✅ Text styles (full typography settings)
- ✅ Effect styles (shadows, blur)
- ✅ Grid styles (rows, columns, grid)
- ✅ Multi-paint color styles

### Import safety
- ✅ Automatic rollback on failure
- ✅ One-click undo for last import
- ✅ Pre-import snapshots
- ✅ Smart merge / clean import / custom merge

### Validation
- ✅ Font availability checking
- ✅ Library connection status
- ✅ Plan compatibility (Starter/Pro/Org/Enterprise)
- ✅ External dependency detection

### Performance
- ✅ Web Worker JSON parsing (handles 1MB+ files)
- ✅ Result caching for repeated operations
- ✅ Skeleton loaders during load
- ✅ 4-column layout (1200×628 px)
- ✅ Activity log with copy/clear controls

## Installation

### From Figma Community (Recommended)
1. Visit the [plugin page](https://www.figma.com/community/plugin/1584331992332668732/variables-and-styles-extractor)
2. Click "Try it out" or "Save"
3. Open any Figma file
4. Run: Plugins → Variables & Styles Extractor

### From Source
1. Clone this repository
2. In Figma: Plugins → Development → Import plugin from manifest
3. Select the `manifest.json` file

## Usage

### Export
1. Open a Figma file with variables/styles
2. Run the plugin
3. Go to Export tab
4. Select collections to export
5. Click "Export Selected"

### Import
1. Open the target Figma file
2. Run the plugin
3. Go to Import tab
4. Drop JSON file or paste contents
5. Click "Import"

## Privacy

- 🔒 No network access - fully local
- 🔒 No data collection
- 🔒 Open source

## Support

- [Report a Bug](https://github.com/tknatwork/side-kicks/issues/new?template=bug_report.md)
- [Request a Feature](https://github.com/tknatwork/side-kicks/issues/new?template=feature_request.md)
- [Known Issues](./docs/KNOWN_ISSUES.md)

## License

This project uses a **two-surface license model**:

| Surface | License | Governs |
|---------|---------|---------|
| Source code (this repository) | [MIT](./LICENSE) | Fork, modify, redistribute, relicense derivative source |
| Figma Community distribution | [Community Free Resource License](https://www.figma.com/community-free-resource-license/) | End-user install + redistribution on Figma Community |

The MIT license applies to the source code in this repository. When the plugin is installed from the [Figma Community listing](https://www.figma.com/community/plugin/1584331992332668732/variables-and-styles-extractor), the Figma Community Free Resource License (CFRL) governs that distribution channel — this is Figma's platform-level license and is automatically applied to free community resources.

Forks may republish the plugin to Figma Community under their own listing; CFRL will apply to their listing independently. The MIT grant on the source is not affected.

See [LICENSE](./LICENSE) for the full MIT text.

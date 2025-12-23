# ☕️ Variables & Styles Extractor

[![Figma Plugin](https://img.shields.io/badge/Figma-Plugin-ff69b4)](https://www.figma.com/community/plugin/1584331992332668732)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-1.6.0-blue.svg)](./package.json)

**Export and import Figma variables and styles with full fidelity.**

> 🔍 **Status:** Published to Figma Community

## Features

- ✅ Export variable collections (COLOR, FLOAT, STRING, BOOLEAN)
- ✅ Export all style types (Color, Text, Effect, Grid)
- ✅ Preserves variable aliases and mode values
- ✅ Maintains style-to-variable bindings
- ✅ Smart plan validation (Starter/Pro/Org/Enterprise)

## Installation

### From Figma Community (Recommended)
1. Visit the [plugin page](https://www.figma.com/community/plugin/1584331992332668732)
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
- [Known Issues](./KNOWN_ISSUES.md)

## License

MIT License - see [LICENSE](./LICENSE) for details.

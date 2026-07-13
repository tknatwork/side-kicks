# Variables & Styles Extractor - JSON Format Specification

> This document describes the JSON format expected by the plugin for importing variables and styles into Figma.

## Table of Contents
- [Overview](#overview)
- [Variables Format](#variables-format)
- [Styles Format](#styles-format)
- [Complete Examples](#complete-examples)
- [AI Prompt Template](#ai-prompt-template)

---

## Overview

The plugin accepts two types of JSON:

1. **Variables JSON** - For variable collections with modes
2. **Styles JSON** - For color, text, effect, and grid styles

You can import them separately or together in a combined file.

---

## Top-Level Array Structure

The JSON can be structured in two ways:

### Option 1: Single Object (Recommended)

```json
{
  "CollectionName1": { "modes": { ... } },
  "CollectionName2": { "modes": { ... } },
  "colorStyles": [...],
  "textStyles": [...],
  "effectStyles": [...],
  "gridStyles": [...]
}
```

### Option 2: Array of Collections

```json
[
  {
    "CollectionName1": { "modes": { ... } }
  },
  {
    "CollectionName2": { "modes": { ... } }
  }
]
```

### Combined Variables + Styles

```json
{
  "Primitives": {
    "modes": {
      "Default": {
        "colors": { ... },
        "spacing": { ... }
      }
    }
  },
  "Semantic": {
    "modes": {
      "Light": { ... },
      "Dark": { ... }
    }
  },
  "colorStyles": [
    { "name": "Brand/Primary", "paints": [...] }
  ],
  "textStyles": [
    { "name": "Heading/H1", "fontFamily": "Inter", ... }
  ],
  "effectStyles": [
    { "name": "Shadow/MD", "effects": [...] }
  ],
  "gridStyles": [
    { "name": "Layout/12 Column", "layoutGrids": [...] }
  ]
}
```

---

## Variables Format

### Structure

```json
{
  "CollectionName": {
    "modes": {
      "ModeName": {
        "group-name": {
          "variable-name": {
            "$scopes": ["ALL_SCOPES"],
            "$type": "color",
            "$value": {
              "hex": "#FF5733",
              "rgb": { "r": 255, "g": 87, "b": 51 },
              "css": "rgb(255, 87, 51)",
              "hsl": { "h": 11, "s": 100, "l": 60 },
              "hsb": { "h": 11, "s": 80, "b": 100 }
            },
            "$description": "Optional description"
          }
        }
      }
    }
  }
}
```

### Variable Types

#### 1. Color Variable

```json
{
  "$scopes": ["ALL_SCOPES"],
  "$type": "color",
  "$value": {
    "hex": "#3B82F6",
    "rgb": { "r": 59, "g": 130, "b": 246 },
    "css": "rgb(59, 130, 246)",
    "hsl": { "h": 217, "s": 91, "l": 60 },
    "hsb": { "h": 217, "s": 76, "b": 96 }
  },
  "$description": "Primary brand color"
}
```

#### 2. Number (Float) Variable

```json
{
  "$scopes": ["ALL_SCOPES"],
  "$type": "float",
  "$value": 16,
  "$description": "Base spacing unit"
}
```

#### 3. String Variable

```json
{
  "$scopes": ["ALL_SCOPES"],
  "$type": "string",
  "$value": "Inter",
  "$description": "Primary font family"
}
```

#### 4. Boolean Variable

```json
{
  "$scopes": ["ALL_SCOPES"],
  "$type": "boolean",
  "$value": true,
  "$description": "Feature flag"
}
```

### Variable Scopes

Available scopes (use one or more):
- `"ALL_SCOPES"` - All contexts (recommended default)
- `"ALL_FILLS"` - Fill colors
- `"FRAME_FILL"` - Frame backgrounds
- `"SHAPE_FILL"` - Shape fills
- `"TEXT_FILL"` - Text colors
- `"STROKE_COLOR"` - Stroke/border colors
- `"STROKE_FLOAT"` - Stroke width
- `"EFFECT_COLOR"` - Effect colors (shadows)
- `"EFFECT_FLOAT"` - Effect numbers (blur radius, spread)
- `"OPACITY"` - Layer opacity
- `"GAP"` - Auto-layout gaps
- `"CORNER_RADIUS"` - Border radius
- `"WIDTH_HEIGHT"` - Dimensions
- `"TEXT_CONTENT"` - Text content (string variables)
- `"FONT_FAMILY"` - Font family (string variables)
- `"FONT_STYLE"` - Font style (string variables)
- `"FONT_WEIGHT"` - Font weight (number variables)
- `"FONT_SIZE"` - Text size
- `"LINE_HEIGHT"` - Line height
- `"LETTER_SPACING"` - Letter spacing
- `"PARAGRAPH_SPACING"` - Paragraph spacing
- `"PARAGRAPH_INDENT"` - Paragraph indent

If a scope isn't recognized by your Figma build, import keeps the recognized
scopes and logs what was dropped (it never silently drops them all).

#### Forward compatibility

`$type` values outside `color` / `float` / `string` / `boolean` (from future
Figma variable types, e.g. easing) are exported verbatim in lowercase and
tried verbatim on import — Figma builds that support the type accept it;
older builds skip that variable with a warning. Timing tokens are regular
`float` variables (milliseconds) and round-trip today.

### Variable Aliases (References)

To reference another variable (alias):

```json
{
  "$scopes": ["ALL_SCOPES"],
  "$type": "color",
  "$value": "{Colors/primary/500}",
  "$description": "References the primary-500 color"
}
```

The format is `{CollectionName/path/to/variable}`.

### Multiple Modes

```json
{
  "Theme": {
    "modes": {
      "Light": {
        "background": {
          "primary": {
            "$scopes": ["ALL_FILLS"],
            "$type": "color",
            "$value": { "hex": "#FFFFFF", "rgb": { "r": 255, "g": 255, "b": 255 }, "css": "rgb(255, 255, 255)", "hsl": { "h": 0, "s": 0, "l": 100 }, "hsb": { "h": 0, "s": 0, "b": 100 } }
          }
        }
      },
      "Dark": {
        "background": {
          "primary": {
            "$scopes": ["ALL_FILLS"],
            "$type": "color",
            "$value": { "hex": "#1A1A1A", "rgb": { "r": 26, "g": 26, "b": 26 }, "css": "rgb(26, 26, 26)", "hsl": { "h": 0, "s": 0, "l": 10 }, "hsb": { "h": 0, "s": 0, "b": 10 } }
          }
        }
      }
    }
  }
}
```

---

## Styles Format

### Structure

```json
{
  "colorStyles": [...],
  "textStyles": [...],
  "effectStyles": [...],
  "gridStyles": [...]
}
```

### 1. Color Styles

#### Solid Color

```json
{
  "colorStyles": [
    {
      "name": "Brand/Primary",
      "description": "Primary brand color",
      "paints": [
        {
          "type": "SOLID",
          "color": {
            "hex": "#3B82F6",
            "rgb": { "r": 59, "g": 130, "b": 246 },
            "css": "rgb(59, 130, 246)",
            "hsl": { "h": 217, "s": 91, "l": 60 },
            "hsb": { "h": 217, "s": 76, "b": 96 }
          },
          "opacity": 1
        }
      ]
    }
  ]
}
```

#### Linear Gradient

```json
{
  "colorStyles": [
    {
      "name": "Gradients/Sunset",
      "description": "Sunset gradient",
      "paints": [
        {
          "type": "GRADIENT_LINEAR",
          "gradientStops": [
            {
              "position": 0,
              "color": { "hex": "#FF6B6B", "rgb": { "r": 255, "g": 107, "b": 107 }, "css": "rgb(255, 107, 107)", "hsl": { "h": 0, "s": 100, "l": 71 }, "hsb": { "h": 0, "s": 58, "b": 100 } }
            },
            {
              "position": 1,
              "color": { "hex": "#FEC89A", "rgb": { "r": 254, "g": 200, "b": 154 }, "css": "rgb(254, 200, 154)", "hsl": { "h": 28, "s": 97, "l": 80 }, "hsb": { "h": 28, "s": 39, "b": 100 } }
            }
          ],
          "opacity": 1
        }
      ]
    }
  ]
}
```

#### Radial Gradient

```json
{
  "type": "GRADIENT_RADIAL",
  "gradientStops": [
    { "position": 0, "color": { "hex": "#FFFFFF", "rgb": { "r": 255, "g": 255, "b": 255 }, "css": "rgb(255, 255, 255)", "hsl": { "h": 0, "s": 0, "l": 100 }, "hsb": { "h": 0, "s": 0, "b": 100 } } },
    { "position": 1, "color": { "hex": "#000000", "rgb": { "r": 0, "g": 0, "b": 0 }, "css": "rgb(0, 0, 0)", "hsl": { "h": 0, "s": 0, "l": 0 }, "hsb": { "h": 0, "s": 0, "b": 0 } } }
  ]
}
```

Other gradient types: `GRADIENT_ANGULAR`, `GRADIENT_DIAMOND`

#### Pattern Paint (new in v2.2)

Pattern fills reference a source node by id, so they round-trip within the
same file. Importing into a file where the node doesn't exist skips the
pattern paint (the rest of the style still imports).

```json
{
  "type": "PATTERN",
  "sourceNodeId": "12:345",
  "tileType": "RECTANGULAR",
  "scalingFactor": 1,
  "spacing": { "x": 0, "y": 0 },
  "horizontalAlignment": "START"
}
```

#### Video & Shader Paints (export-only)

Video and shader paints reference file-local media or shader resources.
They export as markers (`{ "type": "VIDEO" }` / `{ "type": "SHADER" }`, plus
`visible` / `opacity` / `blendMode` when non-default) so the style isn't
silently lossy, and are skipped with a warning on import.

All paints also accept optional `visible` (boolean) and `blendMode` (Figma
blend mode name) — exported only when non-default.

### 2. Text Styles

```json
{
  "textStyles": [
    {
      "name": "Heading/H1",
      "description": "Main heading style",
      "fontFamily": "Inter",
      "fontStyle": "Bold",
      "fontSize": 48,
      "lineHeight": { "unit": "PERCENT", "value": 120 },
      "letterSpacing": { "unit": "PERCENT", "value": -2 },
      "paragraphSpacing": 0,
      "paragraphIndent": 0,
      "leadingTrim": "NONE",
      "listSpacing": 0,
      "hangingPunctuation": false,
      "hangingList": false,
      "textCase": "ORIGINAL",
      "textDecoration": "NONE"
    },
    {
      "name": "Body/Regular",
      "description": "Body text",
      "fontFamily": "Inter",
      "fontStyle": "Regular",
      "fontSize": 16,
      "lineHeight": { "unit": "PERCENT", "value": 150 },
      "letterSpacing": { "unit": "PERCENT", "value": 0 }
    }
  ]
}
```

Font weight is carried by `fontStyle` (e.g. `"Bold"`), not by a numeric
field — a `fontWeight` number in the JSON is ignored on import.

New in v2.2 (all optional on import): `paragraphSpacing` / `paragraphIndent`
(pixels), `leadingTrim` (`"NONE"` or `"CAP_HEIGHT"`), `listSpacing` (pixels),
`hangingPunctuation` / `hangingList` (booleans).

#### Line Height Options

```json
// Percentage (e.g., 150% = 1.5x font size)
{ "unit": "PERCENT", "value": 150 }

// Pixels
{ "unit": "PIXELS", "value": 24 }

// Auto
{ "unit": "AUTO" }
```

#### Letter Spacing Options

```json
// Percentage
{ "unit": "PERCENT", "value": -2 }

// Pixels
{ "unit": "PIXELS", "value": 0.5 }
```

#### Text Case Options
- `"ORIGINAL"` - As typed
- `"UPPER"` - UPPERCASE
- `"LOWER"` - lowercase
- `"TITLE"` - Title Case

#### Text Decoration Options
- `"NONE"`
- `"UNDERLINE"`
- `"STRIKETHROUGH"`

### 3. Effect Styles

#### Drop Shadow

```json
{
  "effectStyles": [
    {
      "name": "Shadows/Small",
      "description": "Subtle shadow for cards",
      "effects": [
        {
          "type": "DROP_SHADOW",
          "color": { "hex": "#00000026", "rgb": { "r": 0, "g": 0, "b": 0 }, "css": "rgba(0, 0, 0, 0.15)", "hsl": { "h": 0, "s": 0, "l": 0 }, "hsb": { "h": 0, "s": 0, "b": 0 } },
          "offset": { "x": 0, "y": 4 },
          "radius": 8,
          "spread": 0,
          "visible": true,
          "blendMode": "NORMAL"
        }
      ]
    }
  ]
}
```

#### Inner Shadow

```json
{
  "type": "INNER_SHADOW",
  "color": { "hex": "#000000", "rgb": { "r": 0, "g": 0, "b": 0 }, "css": "rgb(0, 0, 0)", "hsl": { "h": 0, "s": 0, "l": 0 }, "hsb": { "h": 0, "s": 0, "b": 0 } },
  "offset": { "x": 0, "y": 2 },
  "radius": 4,
  "spread": 0,
  "visible": true
}
```

#### Layer Blur

```json
{
  "type": "LAYER_BLUR",
  "radius": 16,
  "visible": true
}
```

#### Background Blur

```json
{
  "type": "BACKGROUND_BLUR",
  "radius": 24,
  "visible": true
}
```

#### Noise (new in v2.2)

`noiseType` is `"MONOTONE"`, `"DUOTONE"` (add `secondaryColor`), or
`"MULTITONE"` (add `opacity`).

```json
{
  "type": "NOISE",
  "noiseType": "DUOTONE",
  "color": { "hex": "#000000" },
  "secondaryColor": { "hex": "#FFFFFF" },
  "noiseSize": 1,
  "density": 0.5,
  "blendMode": "NORMAL",
  "visible": true
}
```

#### Texture (new in v2.2)

```json
{
  "type": "TEXTURE",
  "noiseSize": 1,
  "radius": 4,
  "clipToShape": true,
  "visible": true
}
```

#### Glass (new in v2.2)

```json
{
  "type": "GLASS",
  "lightIntensity": 0.5,
  "lightAngle": 45,
  "refraction": 0.5,
  "depth": 0.5,
  "dispersion": 0,
  "radius": 8,
  "visible": true
}
```

#### Shader (export-only)

Shader effects reference a shader by file-local id, which cannot be
reconstructed from JSON. They export as `{ "type": "SHADER", "visible": true }`
markers and are skipped with a warning on import. Unknown future effect types
are skipped the same way — the rest of the style still imports.

### 4. Grid Styles

```json
{
  "gridStyles": [
    {
      "name": "Layout/12 Column",
      "description": "Standard 12-column grid",
      "layoutGrids": [
        {
          "pattern": "COLUMNS",
          "count": 12,
          "gutterSize": 24,
          "offset": 64,
          "alignment": "STRETCH",
          "color": { "hex": "#FF000010", "rgb": { "r": 255, "g": 0, "b": 0 }, "css": "rgba(255, 0, 0, 0.06)", "hsl": { "h": 0, "s": 100, "l": 50 }, "hsb": { "h": 0, "s": 100, "b": 100 } },
          "visible": true
        }
      ]
    },
    {
      "name": "Layout/8px Grid",
      "description": "8px baseline grid",
      "layoutGrids": [
        {
          "pattern": "GRID",
          "sectionSize": 8,
          "color": { "hex": "#0000FF10", "rgb": { "r": 0, "g": 0, "b": 255 }, "css": "rgba(0, 0, 255, 0.06)", "hsl": { "h": 240, "s": 100, "l": 50 }, "hsb": { "h": 240, "s": 100, "b": 100 } },
          "visible": true
        }
      ]
    }
  ]
}
```

#### Grid Patterns
- `"GRID"` - Square grid
- `"COLUMNS"` - Vertical columns
- `"ROWS"` - Horizontal rows

#### Grid Alignment (for COLUMNS/ROWS)
- `"STRETCH"` - Stretch to fill
- `"CENTER"` - Center aligned
- `"MIN"` - Align to start
- `"MAX"` - Align to end

---

## Array Format Reference

Quick reference for all array structures in the JSON:

### Variables (Object-based, NOT arrays)

Variables use nested objects, not arrays:

```json
{
  "CollectionName": {
    "modes": {
      "ModeName": {
        "group": {
          "variable": { "$type": "color", "$value": {...} }
        }
      }
    }
  }
}
```

### Styles (Array-based)

All style types use arrays:

| Property | Type | Contains |
|----------|------|----------|
| `colorStyles` | Array | Color style objects |
| `textStyles` | Array | Text style objects |
| `effectStyles` | Array | Effect style objects |
| `gridStyles` | Array | Grid style objects |

```json
{
  "colorStyles": [
    { "name": "...", "paints": [...] },
    { "name": "...", "paints": [...] }
  ],
  "textStyles": [
    { "name": "...", "fontFamily": "...", ... },
    { "name": "...", "fontFamily": "...", ... }
  ]
}
```

### Nested Arrays

#### `paints` Array (in colorStyles)
```json
{
  "paints": [
    { "type": "SOLID", "color": {...} },
    { "type": "GRADIENT_LINEAR", "gradientStops": [...] }
  ]
}
```

#### `gradientStops` Array (in gradient paints)
```json
{
  "gradientStops": [
    { "position": 0, "color": {...} },
    { "position": 0.5, "color": {...} },
    { "position": 1, "color": {...} }
  ]
}
```
- `position`: 0 to 1 (0 = start, 1 = end)

#### `effects` Array (in effectStyles)
```json
{
  "effects": [
    { "type": "DROP_SHADOW", "offset": {...}, "radius": 8, ... },
    { "type": "DROP_SHADOW", "offset": {...}, "radius": 16, ... }
  ]
}
```
- Multiple effects create layered shadows

#### `layoutGrids` Array (in gridStyles)
```json
{
  "layoutGrids": [
    { "pattern": "COLUMNS", "count": 12, ... },
    { "pattern": "GRID", "sectionSize": 8, ... }
  ]
}
```
- Multiple grids overlay each other

#### `$scopes` Array (in variables)
```json
{
  "$scopes": ["ALL_FILLS", "STROKE_COLOR"],
  "$type": "color",
  "$value": {...}
}
```
- Can contain multiple scopes

---

## Complete Examples

### Example 1: Simple Design Tokens

```json
{
  "Primitives": {
    "modes": {
      "Default": {
        "colors": {
          "blue": {
            "50": { "$scopes": ["ALL_SCOPES"], "$type": "color", "$value": { "hex": "#EFF6FF", "rgb": { "r": 239, "g": 246, "b": 255 }, "css": "rgb(239, 246, 255)", "hsl": { "h": 214, "s": 100, "l": 97 }, "hsb": { "h": 214, "s": 6, "b": 100 } } },
            "100": { "$scopes": ["ALL_SCOPES"], "$type": "color", "$value": { "hex": "#DBEAFE", "rgb": { "r": 219, "g": 234, "b": 254 }, "css": "rgb(219, 234, 254)", "hsl": { "h": 214, "s": 95, "l": 93 }, "hsb": { "h": 214, "s": 14, "b": 100 } } },
            "500": { "$scopes": ["ALL_SCOPES"], "$type": "color", "$value": { "hex": "#3B82F6", "rgb": { "r": 59, "g": 130, "b": 246 }, "css": "rgb(59, 130, 246)", "hsl": { "h": 217, "s": 91, "l": 60 }, "hsb": { "h": 217, "s": 76, "b": 96 } } },
            "900": { "$scopes": ["ALL_SCOPES"], "$type": "color", "$value": { "hex": "#1E3A8A", "rgb": { "r": 30, "g": 58, "b": 138 }, "css": "rgb(30, 58, 138)", "hsl": { "h": 224, "s": 64, "l": 33 }, "hsb": { "h": 224, "s": 78, "b": 54 } } }
          }
        },
        "spacing": {
          "xs": { "$scopes": ["GAP"], "$type": "float", "$value": 4 },
          "sm": { "$scopes": ["GAP"], "$type": "float", "$value": 8 },
          "md": { "$scopes": ["GAP"], "$type": "float", "$value": 16 },
          "lg": { "$scopes": ["GAP"], "$type": "float", "$value": 24 },
          "xl": { "$scopes": ["GAP"], "$type": "float", "$value": 32 }
        },
        "radius": {
          "sm": { "$scopes": ["CORNER_RADIUS"], "$type": "float", "$value": 4 },
          "md": { "$scopes": ["CORNER_RADIUS"], "$type": "float", "$value": 8 },
          "lg": { "$scopes": ["CORNER_RADIUS"], "$type": "float", "$value": 16 },
          "full": { "$scopes": ["CORNER_RADIUS"], "$type": "float", "$value": 9999 }
        }
      }
    }
  }
}
```

### Example 2: Semantic Tokens with Light/Dark Modes

```json
{
  "Semantic": {
    "modes": {
      "Light": {
        "background": {
          "primary": { "$scopes": ["ALL_FILLS"], "$type": "color", "$value": { "hex": "#FFFFFF", "rgb": { "r": 255, "g": 255, "b": 255 }, "css": "rgb(255, 255, 255)", "hsl": { "h": 0, "s": 0, "l": 100 }, "hsb": { "h": 0, "s": 0, "b": 100 } } },
          "secondary": { "$scopes": ["ALL_FILLS"], "$type": "color", "$value": { "hex": "#F9FAFB", "rgb": { "r": 249, "g": 250, "b": 251 }, "css": "rgb(249, 250, 251)", "hsl": { "h": 210, "s": 20, "l": 98 }, "hsb": { "h": 210, "s": 1, "b": 98 } } }
        },
        "text": {
          "primary": { "$scopes": ["TEXT_FILL"], "$type": "color", "$value": { "hex": "#111827", "rgb": { "r": 17, "g": 24, "b": 39 }, "css": "rgb(17, 24, 39)", "hsl": { "h": 221, "s": 39, "l": 11 }, "hsb": { "h": 221, "s": 56, "b": 15 } } },
          "secondary": { "$scopes": ["TEXT_FILL"], "$type": "color", "$value": { "hex": "#6B7280", "rgb": { "r": 107, "g": 114, "b": 128 }, "css": "rgb(107, 114, 128)", "hsl": { "h": 220, "s": 9, "l": 46 }, "hsb": { "h": 220, "s": 16, "b": 50 } } }
        },
        "border": {
          "default": { "$scopes": ["STROKE_COLOR"], "$type": "color", "$value": { "hex": "#E5E7EB", "rgb": { "r": 229, "g": 231, "b": 235 }, "css": "rgb(229, 231, 235)", "hsl": { "h": 220, "s": 13, "l": 91 }, "hsb": { "h": 220, "s": 3, "b": 92 } } }
        }
      },
      "Dark": {
        "background": {
          "primary": { "$scopes": ["ALL_FILLS"], "$type": "color", "$value": { "hex": "#111827", "rgb": { "r": 17, "g": 24, "b": 39 }, "css": "rgb(17, 24, 39)", "hsl": { "h": 221, "s": 39, "l": 11 }, "hsb": { "h": 221, "s": 56, "b": 15 } } },
          "secondary": { "$scopes": ["ALL_FILLS"], "$type": "color", "$value": { "hex": "#1F2937", "rgb": { "r": 31, "g": 41, "b": 55 }, "css": "rgb(31, 41, 55)", "hsl": { "h": 215, "s": 28, "l": 17 }, "hsb": { "h": 215, "s": 44, "b": 22 } } }
        },
        "text": {
          "primary": { "$scopes": ["TEXT_FILL"], "$type": "color", "$value": { "hex": "#F9FAFB", "rgb": { "r": 249, "g": 250, "b": 251 }, "css": "rgb(249, 250, 251)", "hsl": { "h": 210, "s": 20, "l": 98 }, "hsb": { "h": 210, "s": 1, "b": 98 } } },
          "secondary": { "$scopes": ["TEXT_FILL"], "$type": "color", "$value": { "hex": "#9CA3AF", "rgb": { "r": 156, "g": 163, "b": 175 }, "css": "rgb(156, 163, 175)", "hsl": { "h": 218, "s": 11, "l": 65 }, "hsb": { "h": 218, "s": 11, "b": 69 } } }
        },
        "border": {
          "default": { "$scopes": ["STROKE_COLOR"], "$type": "color", "$value": { "hex": "#374151", "rgb": { "r": 55, "g": 65, "b": 81 }, "css": "rgb(55, 65, 81)", "hsl": { "h": 217, "s": 19, "l": 27 }, "hsb": { "h": 217, "s": 32, "b": 32 } } }
        }
      }
    }
  }
}
```

### Example 3: Complete Typography Styles

```json
{
  "textStyles": [
    {
      "name": "Display/Large",
      "fontFamily": "Inter",
      "fontStyle": "Bold",
      "fontSize": 72,
      "fontWeight": 700,
      "lineHeight": { "unit": "PERCENT", "value": 110 },
      "letterSpacing": { "unit": "PERCENT", "value": -3 }
    },
    {
      "name": "Heading/H1",
      "fontFamily": "Inter",
      "fontStyle": "SemiBold",
      "fontSize": 48,
      "fontWeight": 600,
      "lineHeight": { "unit": "PERCENT", "value": 120 },
      "letterSpacing": { "unit": "PERCENT", "value": -2 }
    },
    {
      "name": "Heading/H2",
      "fontFamily": "Inter",
      "fontStyle": "SemiBold",
      "fontSize": 36,
      "fontWeight": 600,
      "lineHeight": { "unit": "PERCENT", "value": 125 },
      "letterSpacing": { "unit": "PERCENT", "value": -1 }
    },
    {
      "name": "Heading/H3",
      "fontFamily": "Inter",
      "fontStyle": "Medium",
      "fontSize": 24,
      "fontWeight": 500,
      "lineHeight": { "unit": "PERCENT", "value": 130 },
      "letterSpacing": { "unit": "PERCENT", "value": 0 }
    },
    {
      "name": "Body/Large",
      "fontFamily": "Inter",
      "fontStyle": "Regular",
      "fontSize": 18,
      "fontWeight": 400,
      "lineHeight": { "unit": "PERCENT", "value": 160 },
      "letterSpacing": { "unit": "PERCENT", "value": 0 }
    },
    {
      "name": "Body/Regular",
      "fontFamily": "Inter",
      "fontStyle": "Regular",
      "fontSize": 16,
      "fontWeight": 400,
      "lineHeight": { "unit": "PERCENT", "value": 150 },
      "letterSpacing": { "unit": "PERCENT", "value": 0 }
    },
    {
      "name": "Body/Small",
      "fontFamily": "Inter",
      "fontStyle": "Regular",
      "fontSize": 14,
      "fontWeight": 400,
      "lineHeight": { "unit": "PERCENT", "value": 145 },
      "letterSpacing": { "unit": "PERCENT", "value": 0 }
    },
    {
      "name": "Label/Medium",
      "fontFamily": "Inter",
      "fontStyle": "Medium",
      "fontSize": 14,
      "fontWeight": 500,
      "lineHeight": { "unit": "PERCENT", "value": 140 },
      "letterSpacing": { "unit": "PERCENT", "value": 0 },
      "textCase": "ORIGINAL"
    },
    {
      "name": "Label/Small",
      "fontFamily": "Inter",
      "fontStyle": "Medium",
      "fontSize": 12,
      "fontWeight": 500,
      "lineHeight": { "unit": "PERCENT", "value": 135 },
      "letterSpacing": { "unit": "PERCENT", "value": 2 },
      "textCase": "UPPER"
    }
  ]
}
```

### Example 4: Complete Shadow System

```json
{
  "effectStyles": [
    {
      "name": "Shadow/XS",
      "description": "Extra small shadow",
      "effects": [
        {
          "type": "DROP_SHADOW",
          "color": { "hex": "#0000001A", "rgb": { "r": 0, "g": 0, "b": 0 }, "css": "rgba(0, 0, 0, 0.1)", "hsl": { "h": 0, "s": 0, "l": 0 }, "hsb": { "h": 0, "s": 0, "b": 0 } },
          "offset": { "x": 0, "y": 1 },
          "radius": 2,
          "spread": 0,
          "visible": true
        }
      ]
    },
    {
      "name": "Shadow/SM",
      "description": "Small shadow for buttons",
      "effects": [
        {
          "type": "DROP_SHADOW",
          "color": { "hex": "#0000001A", "rgb": { "r": 0, "g": 0, "b": 0 }, "css": "rgba(0, 0, 0, 0.1)", "hsl": { "h": 0, "s": 0, "l": 0 }, "hsb": { "h": 0, "s": 0, "b": 0 } },
          "offset": { "x": 0, "y": 1 },
          "radius": 3,
          "spread": 0,
          "visible": true
        },
        {
          "type": "DROP_SHADOW",
          "color": { "hex": "#0000000D", "rgb": { "r": 0, "g": 0, "b": 0 }, "css": "rgba(0, 0, 0, 0.05)", "hsl": { "h": 0, "s": 0, "l": 0 }, "hsb": { "h": 0, "s": 0, "b": 0 } },
          "offset": { "x": 0, "y": 2 },
          "radius": 6,
          "spread": -1,
          "visible": true
        }
      ]
    },
    {
      "name": "Shadow/MD",
      "description": "Medium shadow for cards",
      "effects": [
        {
          "type": "DROP_SHADOW",
          "color": { "hex": "#0000001A", "rgb": { "r": 0, "g": 0, "b": 0 }, "css": "rgba(0, 0, 0, 0.1)", "hsl": { "h": 0, "s": 0, "l": 0 }, "hsb": { "h": 0, "s": 0, "b": 0 } },
          "offset": { "x": 0, "y": 4 },
          "radius": 6,
          "spread": -2,
          "visible": true
        },
        {
          "type": "DROP_SHADOW",
          "color": { "hex": "#0000001A", "rgb": { "r": 0, "g": 0, "b": 0 }, "css": "rgba(0, 0, 0, 0.1)", "hsl": { "h": 0, "s": 0, "l": 0 }, "hsb": { "h": 0, "s": 0, "b": 0 } },
          "offset": { "x": 0, "y": 10 },
          "radius": 15,
          "spread": -3,
          "visible": true
        }
      ]
    },
    {
      "name": "Shadow/LG",
      "description": "Large shadow for modals",
      "effects": [
        {
          "type": "DROP_SHADOW",
          "color": { "hex": "#00000012", "rgb": { "r": 0, "g": 0, "b": 0 }, "css": "rgba(0, 0, 0, 0.07)", "hsl": { "h": 0, "s": 0, "l": 0 }, "hsb": { "h": 0, "s": 0, "b": 0 } },
          "offset": { "x": 0, "y": 10 },
          "radius": 10,
          "spread": -5,
          "visible": true
        },
        {
          "type": "DROP_SHADOW",
          "color": { "hex": "#00000014", "rgb": { "r": 0, "g": 0, "b": 0 }, "css": "rgba(0, 0, 0, 0.08)", "hsl": { "h": 0, "s": 0, "l": 0 }, "hsb": { "h": 0, "s": 0, "b": 0 } },
          "offset": { "x": 0, "y": 20 },
          "radius": 25,
          "spread": -5,
          "visible": true
        }
      ]
    }
  ]
}
```

---

## AI Prompt Template

Use this prompt to generate compatible JSON with AI:

```
Generate a JSON file for Figma Variables & Styles Extractor plugin with the following design tokens:

[Describe your design system here, e.g.:]
- Brand colors: primary (#3B82F6), secondary (#10B981), accent (#F59E0B)
- Neutral gray scale: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 pixels
- Border radius: sm (4px), md (8px), lg (16px), full (9999px)
- Typography using Inter font with heading and body styles
- Shadow system with xs, sm, md, lg, xl sizes
- Light and Dark mode support

Requirements:
1. Use the exact format from the JSON_FORMAT.md specification
2. Every color MUST include all 5 formats: hex, rgb, css, hsl, hsb
3. RGB values should be 0-255
4. HSL/HSB percentages should be 0-100
5. Use "$scopes": ["ALL_SCOPES"] for colors unless specific scope needed
6. Use "$scopes": ["GAP"] for spacing values
7. Use "$scopes": ["CORNER_RADIUS"] for border radius values
8. Group variables logically (colors/spacing/radius/etc.)
9. Include descriptions for key tokens
10. For multiple modes, ensure all variables exist in all modes
```

---

## Tips for AI Generation

1. **Always include all color formats** - The plugin needs hex, rgb, css, hsl, and hsb
2. **Use consistent naming** - Use `/` for hierarchy (e.g., `"Brand/Primary/500"`)
3. **Group related tokens** - Keep colors, spacing, etc. in logical groups
4. **Match modes exactly** - Every variable in mode A must exist in mode B
5. **Valid JSON** - Ensure no trailing commas, proper quotes, etc.
6. **Test incrementally** - Import small sections first to verify format

---

## Color Format Helper

For any hex color, here's how to calculate all formats:

| Hex | RGB | CSS | HSL | HSB |
|-----|-----|-----|-----|-----|
| `#3B82F6` | `{ "r": 59, "g": 130, "b": 246 }` | `rgb(59, 130, 246)` | `{ "h": 217, "s": 91, "l": 60 }` | `{ "h": 217, "s": 76, "b": 96 }` |

**Note:** RGB uses 0-255, HSL/HSB use 0-360 for hue and 0-100 for saturation/lightness/brightness.

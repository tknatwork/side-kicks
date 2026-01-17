# Figma Plugin Development - AI Best Practices Guide

> ⚠️ PROTECTED FILE - DO NOT DELETE
> This file contains essential knowledge for AI agents working on Figma plugins.

## Overview

This document provides comprehensive guidance for AI assistants working on Figma plugin development. It covers the unique constraints of the Figma plugin sandbox, common pitfalls, and proven patterns for building robust plugins.

---

## 1. Figma Plugin Architecture

### Two-Part System

Figma plugins consist of two isolated contexts:

```
┌─────────────────────────────────────────────────────────────┐
│                    FIGMA SANDBOX                            │
│  ┌───────────────────┐    ┌───────────────────────────┐    │
│  │    Plugin Code    │    │       Plugin UI           │    │
│  │    (code.ts)      │◄──►│      (ui.html)            │    │
│  │                   │    │                           │    │
│  │ • Figma API access│    │ • HTML/CSS/JS             │    │
│  │ • QuickJS VM      │    │ • Standard browser APIs   │    │
│  │ • No DOM          │    │ • No Figma API            │    │
│  │ • ES2017 only     │    │ • Iframe sandbox          │    │
│  └───────────────────┘    └───────────────────────────┘    │
│           │                          │                      │
│           └────── postMessage ───────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### Communication Pattern

```typescript
// UI → Plugin
parent.postMessage({ pluginMessage: { type: 'action', data: {...} } }, '*');

// Plugin → UI
figma.ui.postMessage({ type: 'response', data: {...} });

// Plugin receives from UI
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'action':
      // Handle action
      break;
  }
};

// UI receives from Plugin
window.onmessage = (event) => {
  const msg = event.data.pluginMessage;
  if (!msg) return;
  switch (msg.type) {
    case 'response':
      // Handle response
      break;
  }
};
```

---

## 2. Critical Sandbox Constraints

### 2.1 JavaScript Runtime (QuickJS VM)

The plugin code runs in Figma's QuickJS VM, which has **ES2017** support only.

#### ❌ FORBIDDEN Syntax

```typescript
// Spread operators - WILL CRASH
const merged = { ...obj1, ...obj2 };
const copy = [...array];

// Object spread in function args
function foo({ a, ...rest }) {}  // FORBIDDEN

// Generators - causes "stack underflow"
function* generator() { yield 1; }

// Optional chaining (ES2020) - MAY NOT WORK
const value = obj?.property?.nested;

// Nullish coalescing (ES2020) - MAY NOT WORK
const value = null ?? 'default';
```

#### ✅ Safe Alternatives

```typescript
// Use Object.assign instead of spread
const merged = Object.assign({}, obj1, obj2);
const copy = Array.prototype.slice.call(array);

// Explicit property extraction
function foo(opts) {
  const a = opts.a;
  const rest = { b: opts.b, c: opts.c };
}

// Explicit null checks
const value = obj && obj.property && obj.property.nested;
const value = something !== null && something !== undefined ? something : 'default';
```

### 2.2 CSS in Plugin Iframe

The UI runs in an iframe with restricted CSS support.

#### ❌ FORBIDDEN CSS

```css
/* These will cause invisible elements */
.container {
    contain: strict;           /* Elements render but invisible */
    content-visibility: auto;  /* Not supported in iframe */
    backdrop-filter: blur(10px); /* Limited support */
}
```

#### ✅ Safe CSS

```css
.container {
    contain: layout style;     /* Safe containment */
    will-change: transform;    /* GPU acceleration */
    transform: translateZ(0);  /* Force GPU layer */
}
```

### 2.3 Available APIs

#### In Plugin Code (code.ts)
- ✅ Figma API (`figma.*`)
- ✅ `console.log/warn/error`
- ✅ `JSON.parse/stringify`
- ✅ `setTimeout/setInterval`
- ✅ `Promise`, `async/await`
- ❌ `fetch` (no network access)
- ❌ `window`, `document`, DOM
- ❌ `btoa`, `atob` (use manual base64)
- ❌ Web Storage APIs

#### In Plugin UI (ui.html)
- ✅ Full DOM API
- ✅ All standard browser APIs
- ✅ `fetch` (if plugin has network permission)
- ❌ Figma API
- ❌ `require`, `import` (no modules)

---

## 3. Figma API Best Practices

### 3.1 Always Use Async APIs

Figma is deprecating synchronous APIs. Always use async versions:

```typescript
// ❌ DEPRECATED - will be removed
const styles = figma.getLocalPaintStyles();
const collections = figma.variables.getLocalVariableCollections();

// ✅ REQUIRED - use async versions
const styles = await figma.getLocalPaintStylesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();
```

### Complete List of Async APIs

```typescript
// Styles
await figma.getLocalPaintStylesAsync()
await figma.getLocalTextStylesAsync()
await figma.getLocalEffectStylesAsync()
await figma.getLocalGridStylesAsync()

// Variables
await figma.variables.getLocalVariablesAsync()
await figma.variables.getLocalVariableCollectionsAsync()
await figma.variables.getVariableByIdAsync(id)
await figma.variables.getVariableCollectionByIdAsync(id)
await figma.variables.importVariableByKeyAsync(key)

// Team Library
await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()
await figma.teamLibrary.getVariablesInLibraryCollectionAsync(key)

// Fonts
await figma.loadFontAsync({ family: 'Inter', style: 'Regular' })

// Images
await figma.getImageByHash(hash)
await figma.createImage(bytes)
```

### 3.2 Variable Types

```typescript
// Figma variable types
type VariableResolvedDataType = 'BOOLEAN' | 'COLOR' | 'FLOAT' | 'STRING';

// Creating variables
const variable = figma.variables.createVariable(
  'path/to/variable',
  collection,
  'COLOR'  // Type must match value type
);

// Setting values
variable.setValueForMode(modeId, { r: 1, g: 0, b: 0, a: 1 });  // COLOR
variable.setValueForMode(modeId, 16);                          // FLOAT
variable.setValueForMode(modeId, true);                        // BOOLEAN
variable.setValueForMode(modeId, 'hello');                     // STRING

// Setting aliases
variable.setValueForMode(modeId, {
  type: 'VARIABLE_ALIAS',
  id: targetVariable.id
});
```

### 3.3 Paint Types

```typescript
// All Figma paint types
type PaintType = 
  | 'SOLID'
  | 'GRADIENT_LINEAR'
  | 'GRADIENT_RADIAL'
  | 'GRADIENT_ANGULAR'
  | 'GRADIENT_DIAMOND'
  | 'IMAGE'
  | 'VIDEO';

// Solid paint structure
interface SolidPaint {
  type: 'SOLID';
  color: { r: number; g: number; b: number };
  opacity?: number;
  visible?: boolean;
  blendMode?: BlendMode;
  boundVariables?: { color?: VariableAlias };
}

// Gradient paint structure
interface GradientPaint {
  type: 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND';
  gradientStops: Array<{
    position: number;
    color: RGBA;
  }>;
  gradientTransform: Transform;
  opacity?: number;
  visible?: boolean;
  blendMode?: BlendMode;
}

// Image paint structure
interface ImagePaint {
  type: 'IMAGE';
  scaleMode: 'FILL' | 'FIT' | 'CROP' | 'TILE';
  imageHash: string;
  filters?: ImageFilters;
  opacity?: number;
  visible?: boolean;
}
```

---

## 4. Error Handling Patterns

### 4.1 Standard Error Pattern

```typescript
async function safeOperation(): Promise<Result> {
  try {
    const result = await riskyOperation();
    return { success: true, data: result };
  } catch (error) {
    console.error('[Plugin] Operation failed:', error);
    figma.ui.postMessage({
      type: 'error',
      data: { 
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    });
    return { success: false, error };
  }
}
```

### 4.2 DOM Null Checks (UI)

```javascript
// ❌ WRONG - element may not exist
document.getElementById('btn').addEventListener('click', handler);

// ✅ CORRECT - safe null check
const btn = document.getElementById('btn');
if (btn) {
  btn.addEventListener('click', handler);
}

// ✅ CORRECT - wait for DOM
document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.addEventListener('click', handler);
  }
});
```

### 4.3 Type Guards

```typescript
// Check paint type before accessing properties
function processPaint(paint: Paint): void {
  if (paint.type === 'SOLID') {
    const color = paint.color;  // Safe: SolidPaint has color
  } else if (paint.type.startsWith('GRADIENT_')) {
    const stops = (paint as GradientPaint).gradientStops;  // Safe cast
  } else if (paint.type === 'IMAGE') {
    const hash = (paint as ImagePaint).imageHash;  // Safe cast
  }
}
```

---

## 5. Data Transfer Patterns

### 5.1 JSON Export/Import Structure

```typescript
// Standard export format
type ExportFormat = Array<CollectionExport | { _styles: StylesExport }>;

interface CollectionExport {
  [collectionName: string]: {
    modes: {
      [modeName: string]: VariableTree;
    };
  };
}

interface StylesExport {
  colorStyles?: ExportColorStyle[];
  textStyles?: ExportTextStyle[];
  effectStyles?: ExportEffectStyle[];
  gridStyles?: ExportGridStyle[];
}
```

### 5.2 Base64 Encoding (No btoa/atob)

```typescript
// Pure JavaScript base64 encoding for images
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;
  
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;
    
    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < len ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < len ? chars[b3 & 63] : '=';
  }
  
  return result;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Map<string, number>();
  for (let i = 0; i < chars.length; i++) {
    lookup.set(chars[i], i);
  }
  
  const clean = base64.replace(/[=]/g, '');
  const bytes = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let j = 0;
  
  for (let i = 0; i < clean.length; i += 4) {
    const b1 = lookup.get(clean[i]) || 0;
    const b2 = lookup.get(clean[i + 1]) || 0;
    const b3 = lookup.get(clean[i + 2]) || 0;
    const b4 = lookup.get(clean[i + 3]) || 0;
    
    bytes[j++] = (b1 << 2) | (b2 >> 4);
    if (i + 2 < clean.length) bytes[j++] = ((b2 & 15) << 4) | (b3 >> 2);
    if (i + 3 < clean.length) bytes[j++] = ((b3 & 3) << 6) | b4;
  }
  
  return bytes;
}
```

### 5.3 Color Conversion

```typescript
// RGBA (0-1) to 8-digit hex
function rgbaToHex(r: number, g: number, b: number, a: number = 1): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a)}`;
}

// 8-digit hex to RGBA (0-1)
function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const a = clean.length >= 8 ? parseInt(clean.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}
```

---

## 6. UI Development Patterns

### 6.1 Plugin Window Size

```typescript
// Set in code.ts
figma.showUI(__html__, {
  width: 1200,
  height: 628,
  themeColors: true  // Respect Figma theme
});
```

### 6.2 CSS Variables for Consistency

```css
:root {
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  
  --font-size-xs: 10px;
  --font-size-sm: 11px;
  --font-size-md: 12px;
  
  --color-bg: #ffffff;
  --color-border: #e0e0e0;
  --color-text: #333333;
  --color-success: #4caf50;
  --color-warning: #ff9800;
  --color-error: #f44336;
}
```

### 6.3 Column Layout Pattern

```css
.column-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: var(--spacing-md);
  height: 100%;
}

.column {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.column-header {
  flex-shrink: 0;
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
}

.column-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
}

.column-footer {
  flex-shrink: 0;
  padding: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}
```

---

## 7. Testing Checklist

Before any release:

- [ ] Test with Material Design 3 file (File Key: `Yq5OWQOgRviZr5HnBSeTK5`)
- [ ] Test export with 300+ variables
- [ ] Test import on empty file
- [ ] Test import on file with existing variables
- [ ] Test each Figma plan (Starter/Pro/Org/Enterprise)
- [ ] Test all paint types (solid, gradients, images)
- [ ] Test with library-linked variables
- [ ] Verify no console errors
- [ ] Check memory usage doesn't grow unbounded
- [ ] Test build with `pnpm build` (minified)
- [ ] Test in Figma Desktop (not browser)

---

## 8. Common Debugging Techniques

### 8.1 Console Logging

```typescript
// Use structured logging
console.log('[Plugin] Action started:', { action, params });
console.warn('[Plugin] Warning:', message);
console.error('[Plugin] Error:', error);

// In UI, use the Activity Log
addLog('✅ Export complete', 'success');
addLog('⚠️ Some items skipped', 'warning');
addLog('❌ Import failed', 'error');
```

### 8.2 Build for Debugging

```bash
# Use unminified build for debugging
pnpm build:dev

# The code.js will be readable with line numbers
```

### 8.3 Developer Console Access

In Figma Desktop, open the Developer Console:
- **Mac**: ⌥⌘I (Option + Command + I)
- **Windows**: Ctrl + Alt + I

---

## 9. Version Release Checklist

When releasing a new version:

1. [ ] Update `manifest.json` version
2. [ ] Update `package.json` version
3. [ ] Update version in `ui.html` title
4. [ ] Update `docs/CHANGELOG.md`
5. [ ] Update `docs/TASKS.md`
6. [ ] Run `pnpm build` (production build)
7. [ ] Test locally in Figma Desktop
8. [ ] Push to GitHub (CI will validate)
9. [ ] Create git tag: `git tag v1.x.x && git push --tags`
10. [ ] Publish to Figma Community

---

*Last updated: 2026-01-13*

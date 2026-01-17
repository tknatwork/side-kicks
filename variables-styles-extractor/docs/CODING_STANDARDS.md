# Coding Standards - Variables & Styles Extractor

**Adapted from JSF-AV / AUTOSAR Guidelines for Figma Plugin Development**

---

## ⚠️ MANDATORY: READ BEFORE CODING

These standards are adapted from aerospace/automotive safety standards (JSF-AV, AUTOSAR) for Figma plugin development. All AI agents and human developers MUST follow these rules.

---

## 1. Best Practices Registry

### BP-001: CSS Containment in Figma Iframe

**Issue:** `contain: strict` and `content-visibility: auto` are not supported in Figma's plugin iframe sandbox.

**Symptom:** Elements render (innerHTML populated) but are invisible.

**Solution:**
```css
/* ❌ WRONG - breaks in Figma iframe */
.container {
    contain: strict;
    content-visibility: auto;
}

/* ✅ CORRECT - works in Figma iframe */
.container {
    contain: layout style;
    /* Do NOT use content-visibility */
}
```

**Reference:** Fixed in v1.7.0 (KI-001)

---

### BP-002: Null Check DOM Elements

**Issue:** DOM elements may not exist in all UI states.

**Symptom:** `Cannot read property 'addEventListener' of null`

**Solution:**
```javascript
/* ❌ WRONG - crashes if element doesn't exist */
document.getElementById('dropZone').addEventListener('click', handler);

/* ✅ CORRECT - safe null check */
const dropZone = document.getElementById('dropZone');
if (dropZone) {
    dropZone.addEventListener('click', handler);
}
```

**Reference:** Fixed in v1.7.0 (KI-002)

---

### BP-003: Use Async Figma APIs

**Issue:** Synchronous Figma APIs block the main thread and may cause timeouts.

**Solution:**
```typescript
/* ❌ WRONG - synchronous (deprecated) */
const styles = figma.getLocalPaintStyles();

/* ✅ CORRECT - async */
const styles = await figma.getLocalPaintStylesAsync();
```

**All async APIs to use:**
- `figma.getLocalPaintStylesAsync()`
- `figma.getLocalTextStylesAsync()`
- `figma.getLocalEffectStylesAsync()`
- `figma.getLocalGridStylesAsync()`
- `figma.variables.getLocalVariablesAsync()`
- `figma.variables.getLocalVariableCollectionsAsync()`

**Library APIs (require library to be enabled via Figma UI):**
- `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()`
- `figma.teamLibrary.getVariablesInLibraryCollectionAsync(key)`
- `figma.variables.importVariableByKeyAsync(key)`

---

### BP-004: DOMContentLoaded for Late DOM Elements

**Issue:** Event listeners attached to DOM elements that are defined later in the HTML fail with "Cannot read properties of null".

**Symptom:** `Uncaught TypeError: Cannot read properties of null (reading 'addEventListener')`

**Cause:** Script executes before the target element exists in the DOM (e.g., modal defined after script tag).

**Solution:**
```javascript
/* ❌ WRONG - element may not exist yet */
document.getElementById('tipModal').addEventListener('click', handler);

/* ✅ CORRECT - wait for DOM to be ready */
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('tipModal');
    if (modal) {
        modal.addEventListener('click', handler);
    }
});
```

**Reference:** Fixed in v2.0.0 (tipModal event listener)

---

### BP-005: Pre-Import Library Detection Pattern

**Issue:** Users import JSON with library references but destination file doesn't have the library connected.

**Solution:** Check library availability before import and show appropriate status.

```typescript
// 1. Extract library dependencies during validation
interface PlanValidation {
    // ... other fields
    libraryDependencies?: {
        collections: string[];  // Unique collection names from $libraryAlias
        variableCount: number;  // Count of variables with library refs
    };
}

// 2. Check library availability
async function checkLibraryAvailability(requiredCollections: string[]): Promise<LibraryAvailabilityResult> {
    const availableLibraries = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
    const availableNames = new Set(availableLibraries.map(lib => lib.name));
    // Compare required vs available
    return { requiredCollections, availableCollections, missingCollections, allAvailable };
}

// 3. UI shows status card with 3 states:
// - 📚 Green: All libraries connected → "Import with Library Links"
// - ⚠️ Yellow: Partial → "Import (Mixed)"
// - 📦 Orange: None connected → "Import with Fallback Values"
```

**Reference:** Implemented in v1.7.0

---

### BP-005: Font Availability Detection Pattern

**Issue:** Users import JSON with text styles but destination file doesn't have required fonts installed.

**Solution:** Check font availability before import and show which fonts need to be installed.

```typescript
// 1. Extract font dependencies during validation
interface PlanValidation {
    // ... other fields
    fontDependencies?: {
        fonts: FontDependency[];  // { family, style } extracted from text styles
        styleCount: number;       // Number of text styles
    };
}

// 2. Check font availability
async function checkFontAvailability(requiredFonts: FontDependency[]): Promise<FontAvailabilityResult> {
    const allFonts = await figma.listAvailableFontsAsync();
    const availableFontKeys = new Set(allFonts.map(f => `${f.fontName.family}|${f.fontName.style}`));
    // Compare required vs available
    return { requiredFonts, availableFonts, missingFonts, allAvailable };
}

// 3. UI shows status card with 3 states:
// - ✅ Green: All fonts installed
// - ⚠️ Orange: Some fonts missing
// - ❌ Pink: No required fonts found
// 4. Export side shows font-requirements-banner with list of fonts
```

**Reference:** Implemented in v1.7.0

---

## 2. Known Issues Registry

| ID | Description | Affected Version | Status |
|----|-------------|------------------|--------|
| KI-001 | Collections not displaying (CSS containment) | 1.6.0 | Fixed in 1.7.0 |
| KI-002 | Event listener null reference | 1.6.0 | Fixed in 1.7.0 |

---

## 3. Figma Plugin Constraints

### TypeScript Target
- **Required:** ES2017
- **Reason:** Figma's QuickJS VM doesn't support ES2018+ features

### Forbidden Syntax
```typescript
/* ❌ FORBIDDEN - causes errors in Figma VM */
const merged = { ...obj1, ...obj2 };  // Spread operators
function* generator() { yield 1; }     // Generators

/* ✅ ALLOWED */
const merged = Object.assign({}, obj1, obj2);
```

### CSS Limitations in Plugin Iframe
- ❌ `contain: strict`
- ❌ `content-visibility: auto`
- ❌ `backdrop-filter` (limited support)
- ✅ `contain: layout style`
- ✅ `will-change`
- ✅ `transform: translateZ(0)` (GPU acceleration)

---

## 4. Naming Conventions

### Files
| Type | Convention | Example |
|------|------------|---------|
| Source | camelCase | `code.ts` |
| Config | lowercase | `manifest.json` |
| Docs | UPPERCASE | `README.md`, `CHANGELOG.md` |

### Code
| Type | Convention | Example |
|------|------------|---------|
| Functions | camelCase | `exportVariables()` |
| Classes | PascalCase | `VariableCollection` |
| Constants | UPPER_SNAKE | `MAX_LOG_ENTRIES` |
| Private | _prefix | `_internalState` |

---

## 5. Error Handling

### Required Pattern
```typescript
try {
    const result = await riskyOperation();
    return { success: true, data: result };
} catch (error) {
    console.error('[Plugin] Operation failed:', error);
    figma.ui.postMessage({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error'
    });
    return { success: false, error };
}
```

### Logging Format
```typescript
console.log('[Plugin] Action description');      // Info
console.warn('[Plugin] Warning message');        // Warning
console.error('[Plugin] Error details:', error); // Error
```

---

## 6. UI/Plugin Communication

### Message Types
```typescript
// UI → Plugin
interface UIMessage {
    type: 'export' | 'import' | 'cancel';
    payload?: unknown;
}

// Plugin → UI
interface PluginMessage {
    type: 'data' | 'error' | 'progress' | 'complete';
    payload?: unknown;
}
```

### Pattern
```typescript
// In code.ts
figma.ui.onmessage = async (msg: UIMessage) => {
    switch (msg.type) {
        case 'export':
            // Handle export
            break;
    }
};

// In ui.html
parent.postMessage({ pluginMessage: { type: 'export' } }, '*');
```

---

## 7. Testing Checklist

Before any release:
- [ ] Test with Material Design 3 file (File Key: `Yq5OWQOgRviZr5HnBSeTK5`)
- [ ] Test export with 300+ variables
- [ ] Test import on empty file
- [ ] Test import on file with existing variables
- [ ] Test each Figma plan (Starter/Pro/Org/Enterprise)
- [ ] Verify no console errors
- [ ] Check memory usage doesn't grow unbounded

---

## 8. Version Checklist

When releasing a new version:
- [ ] Update `manifest.json` version
- [ ] Update `package.json` version
- [ ] Update version in `ui.html` title
- [ ] Update `docs/CHANGELOG.md`
- [ ] Update `docs/TASKS.md`
- [ ] Run `pnpm build`
- [ ] Test locally in Figma
- [ ] Push to GitHub (CI will validate)
- [ ] Create git tag: `git tag v1.x.x && git push --tags`
- [ ] Publish to Figma Community

---

## 9. CI/CD Pipeline

### Automated Checks (on every push/PR)

The CI pipeline (`.github/workflows/ci.yml`) automatically validates:

1. **Build** - TypeScript compiles without errors
2. **Minification** - code.js is properly minified
3. **BP-001 Check** - No forbidden CSS (`contain: strict`, `content-visibility: auto`)
4. **File validation** - All required files present

### Release Workflow

To create a release:
```bash
git tag v1.7.0
git push --tags
```

This triggers `.github/workflows/release.yml` which:
1. Builds the plugin
2. Validates coding standards
3. Creates a GitHub Release with zip download

---

**Last Updated:** 2026-01-07 (Added BP-005: Font Availability Detection Pattern)

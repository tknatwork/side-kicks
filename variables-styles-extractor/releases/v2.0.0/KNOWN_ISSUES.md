# Known Issues - Variables & Styles Extractor

**Plugin**: Variables & Styles Extractor  
**Current Version**: 1.6.0 (2.0.0 in development)  
**Status**: Published to Figma Community

---

## Current Issues

*No known issues at this time.*

---

## Resolved Issues

### KI-008: External Collection References Not Resolved (v1.7.0)
**Status:** ✅ Fixed in v1.7.0

**Symptom:** During import, warnings appear stating "Alias target not found" for variables that reference collections not included in the export.

**Cause:** Variables can reference (alias) variables from other collections. These external collections may be:
- **Library-linked collections:** Variables from published team/shared libraries (e.g., shape tokens, theme systems from external design systems)
- **Non-exported local collections:** Other local collections that weren't selected for export

The Figma Plugin API only provides access to local collections via `getLocalVariableCollectionsAsync()`. Library-linked collections cannot be exported—they exist only as references within the current file.

**Solution:** v1.7.0 now handles external dependencies transparently:
- **Export phase:** Detects which external collections are referenced but not included in the export
- **Metadata:** Records external collection names in the `externalCollections` array of the export JSON
- **Import phase:** Displays a clear warning listing missing external dependencies

**User Action:** 
- For **local collections**: Ensure all dependent collections are included in the export
- For **library collections**: These cannot be exported. Either:
  - Ensure the target file is connected to the same team library, OR
  - Accept that these aliases will remain unresolved and fall back to their raw values

---

### KI-007: Collection Name Matching Fails Due to Whitespace/Unicode Variations (v1.7.0)
**Status:** ✅ Fixed in v1.7.0

**Symptom:** During import, "Alias target not found" warnings appear for variables that should exist, particularly when collection names contain emoji characters or special Unicode sequences.

**Cause:** Collection names with emoji or special characters can have inconsistent whitespace representations (e.g., multiple spaces vs. single space) due to Unicode rendering differences. This caused exact string matching to fail even when the collections were semantically identical.

**Solution:** v1.7.0 implements name normalization for robust matching:
- Applies Unicode NFC normalization
- Collapses consecutive whitespace into single spaces
- Trims leading and trailing whitespace
- Maintains secondary lookup maps for fuzzy matching while preserving original names

---

### KI-006: Alias Resolution Fails During Import (v1.7.0)
**Status:** ✅ Fixed in v1.7.0

**Symptom:** During import, warnings appear stating "Alias target not found" followed by "Setting raw value" for variables that should reference other variables.

**Cause:** Variables were imported in file order without considering dependencies. When a variable with an alias was imported before its target variable existed, the alias reference could not be resolved.

**Solution:** v1.7.0 implements a multi-pass import strategy:
- **Pass 1:** Create all variables with raw (non-alias) values only
- **Pass 2:** Set all alias relationships after all target variables exist
- **Pass 3:** Import styles with full variable binding support

This ensures all seed variables exist before dependent variables attempt to reference them.

---

### KI-005: Variable Alias Type Mismatch Crash (v1.6.0)
**Status:** ✅ Fixed in v1.7.0

**Symptom:** Import fails with "Mismatched variable resolved type for mode X:Y"

**Cause:** When importing aliases (e.g., `{Tailwind/slate/50}`), the target variable may have a different type than expected. For example, a COLOR variable trying to alias a FLOAT variable, or an unresolved alias string being set on a FLOAT variable.

**Solution:** v1.7.0 now:
- Validates type compatibility before setting aliases
- Compares `resolvedType` of source and target variables
- Only sets alias if types match (COLOR→COLOR, FLOAT→FLOAT, etc.)
- Skips setting unresolved alias references as raw values (they would fail for non-STRING types)
- Falls back gracefully without crashing

---

### KI-004: Image/Video Paint Import Crash (v1.7.0-dev)
**Status:** ✅ Fixed in v1.7.0

**Symptom:** Import fails with "Property paints failed validation: Required value missing at [0].imageHash"

**Cause:** IMAGE and VIDEO paint fills have file-specific `imageHash` references that cannot be transferred between Figma files.

**Solution:** v1.7.0 now supports full image transfer:
- **Export:** Check "Include image data" to embed images as base64
- **Import:** Images are recreated with `figma.createImage()` and get new file-specific hashes
- **Without image data:** Image paints are gracefully skipped with a warning

---

### KI-003: Color Styles Only Export Solid Paints (v1.6.0)
**Status:** ✅ Fixed in v1.7.0

**Symptom:** Export shows X color styles detected, but JSON file has `colorStyles: []` or fewer than expected.

**Cause:** v1.6.0 only exports SOLID paint styles. Gradients, images, and empty styles were skipped.

**Solution:** v1.7.0 adds full support for all paint types including gradients and images.

---

### Grid Import Validation (Fixed in v1.2.0)
Grid styles failed to import with "layoutGrids validation error". Fixed by using conditional property structure per alignment type.

### Stack Underflow Error (Fixed in v1.5.5)
Plugin crashed with "stack underflow" on large files. Fixed by changing TypeScript target from ES2020 to ES2017.

---

## Reporting Issues

### Via GitHub (Recommended)
1. Go to [GitHub Issues](https://github.com/tknatwork/side-kicks/issues)
2. Click "New Issue"
3. Select "Bug Report" template
4. Fill in all details

### Information to Include
- Figma version
- Plugin version (shown in window title bar)
- Operating system
- Steps to reproduce
- Expected vs. actual behavior
- Export JSON if relevant (remove sensitive data first)

---

**Last Updated:** 2026-01-05

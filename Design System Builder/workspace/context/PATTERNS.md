# DSB Established Patterns — All Agents Must Follow

> This file is APPEND-ONLY. Never modify existing entries.
> When you establish a new pattern, add it at the bottom with the session date.
> All agents: read this BEFORE implementing anything.

---

## Core Patterns (From CLAUDE.md + copilot-instructions.md)

### Result<T, E> — Fallible Operations

All functions that can fail return `Result<T, E>`. Never throw for business logic.

```typescript
// Type definition (core/src/types.ts)
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

// Usage pattern
function createVariable(name: string): Result<Variable, string> {
  if (!name) {
    return { ok: false, error: 'Variable name cannot be empty' };
  }
  // ...
  return { ok: true, value: variable };
}

// Consuming
const result = createVariable(name);
if (!result.ok) {
  console.error(result.error);
  return;
}
// result.value is now safe to use
```

### Readonly Interface Properties

All interfaces have `readonly` by default. Only use mutable properties when the type explicitly represents mutable state.

```typescript
// CORRECT
interface TokenDefinition {
  readonly name: string;
  readonly value: string;
  readonly type: TokenType;
}

// WRONG
interface TokenDefinition {
  name: string; // missing readonly
}
```

### Guard Clause Pattern

Check preconditions at the TOP of functions. Return early. No deep nesting.

```typescript
// CORRECT
function processToken(token: unknown): Result<Token, string> {
  if (!token) return { ok: false, error: 'Token is required' };
  if (typeof token !== 'object') return { ok: false, error: 'Token must be an object' };
  if (!('name' in token)) return { ok: false, error: 'Token must have a name' };

  // Happy path — only reaches here if all guards pass
  return { ok: true, value: token as Token };
}

// WRONG — deep nesting
function processToken(token: unknown): Result<Token, string> {
  if (token) {
    if (typeof token === 'object') {
      if ('name' in token) {
        return { ok: true, value: token as Token };
      }
    }
  }
  return { ok: false, error: 'Invalid token' };
}
```

### File Operations via Guardrails

Always use `safeWriteFile` and `safeReadJson` from `@dsb/guardrails`. Never use `fs` directly in business code.

```typescript
import { safeWriteFile, safeReadJson } from '@dsb/guardrails';

// Writing
const writeResult = await safeWriteFile(path, JSON.stringify(data));
if (!writeResult.ok) { /* handle error */ }

// Reading
const readResult = await safeReadJson<MyType>(path);
if (!readResult.ok) { /* handle error */ }
const data = readResult.value;
```

### Child Process Calls via execFileNoThrow

Always use `execFileNoThrow` from guardrails for spawning child processes. Never use raw `exec` or `execSync`.

```typescript
import { execFileNoThrow } from '@dsb/guardrails';

const result = await execFileNoThrow('node', ['script.js', '--flag']);
if (result.exitCode !== 0) {
  console.error('Process failed:', result.stderr);
}
```

### Naming Conventions

| Target | Convention | Example |
|--------|-----------|---------|
| Files | kebab-case | `token-validator.ts` |
| Types / Interfaces | PascalCase | `TokenDefinition` |
| Functions / variables | camelCase | `createToken()` |
| Constants | UPPER_SNAKE_CASE | `MAX_VARIABLE_COUNT` |
| Packages | @dsb/name | `@dsb/core` |
| Enum values | PascalCase | `TokenType.Color` |

### Error Message Format

Every error string must answer three questions:
1. What happened: "Failed to create variable collection"
2. Where: "in dsb_create_tier1_primitives, step 2"
3. How to fix: "Verify plugin is connected: `curl http://localhost:9877/status`"

```typescript
// CORRECT
return { ok: false, error: 'Failed to create variable collection in tier1_create: plugin returned null. Verify plugin is connected: curl http://localhost:9877/status' };

// WRONG — no context
return { ok: false, error: 'Creation failed' };
```

### File Size Rule

Files over 200 lines MUST have section headers to aid navigation:

```typescript
// ─── TYPES ─────────────────────────────────────────────────────────────────

// ─── VALIDATION ─────────────────────────────────────────────────────────────

// ─── CORE LOGIC ─────────────────────────────────────────────────────────────

// ─── EXPORTS ────────────────────────────────────────────────────────────────
```

---

## ES2017 Constraint Patterns (builder-plugin ONLY)

When writing code for `packages/builder-plugin`, use these alternative patterns:

### Object Copying (no spread)
```javascript
// BANNED in builder-plugin:
const copy = { ...original, newProp: value };

// CORRECT for builder-plugin:
const copy = Object.assign({}, original, { newProp: value });
```

### Safe Property Access (no optional chaining)
```javascript
// BANNED in builder-plugin:
const name = obj?.name;

// CORRECT for builder-plugin:
const name = obj && obj.name;
```

### Default Values (no nullish coalescing)
```javascript
// BANNED in builder-plugin:
const value = input ?? 'default';

// CORRECT for builder-plugin:
const value = input !== null && input !== undefined ? input : 'default';
```

---

## Learning Engine Patterns (core/src/learning/)

### Extractor Interface

Every source extractor (Figma JSON, CSS variables, Style Dictionary) implements:

```typescript
interface TokenExtractor<TSource> {
  readonly name: string;
  extract(source: TSource): Promise<Result<StructuralFingerprint, ExtractorError>>;
  validate(source: TSource): Result<void, string>;
}
```

### StructuralFingerprint (append sub-patterns here as they emerge)

The fingerprint captures the STRUCTURE of a design system, not its specific values. Naming conventions, hierarchy depth, token categories, and relationships — not colors, not sizes.

<!-- NEW PATTERNS APPENDED BELOW -->

---

*Last Updated: 2025-12-27 (Session 1 — infrastructure setup)*

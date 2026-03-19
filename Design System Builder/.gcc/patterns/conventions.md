# DSB Coding Conventions — Pre-Digested Summary

> Reading this (~300 tokens) replaces discovering conventions by scanning code (~1,500 tokens).
> Source of truth: `workspace/context/PATTERNS.md` (detailed examples with code snippets).
> This file has the WHAT. PATTERNS.md has the HOW (with code examples).
>
> **Sync rule:** After adding/changing any pattern in PATTERNS.md, regenerate the matching
> summary line here. After updating this file, set the timestamp below.
> If `Last Synced` is older than `PATTERNS.md`'s `Last Updated`, this file is stale — re-derive it.
>
> Last Synced: 2026-03-16

## Universal Rules (all packages)

- `Result<T, E>` for fallible ops — never throw for business logic
- `readonly` on all interface properties by default
- Guard clauses — early returns at top, no deep nesting
- `execFileNoThrow` from guardrails — never raw exec
- `safeWriteFile` / `safeReadJson` from guardrails — never raw fs
- `unknown` + type guards — never `any`

## Naming

- Files: `kebab-case.ts`
- Types: `PascalCase`
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Packages: `@dsb/name`

## Error Messages

Every error: What happened + Where + How to fix.

## File Organization

- 200+ lines → section headers (`// ─── SECTION ───`)
- One concern per file
- Types in `types.ts`, re-exported from `index.ts`

## builder-plugin Exceptions (ES2017)

- `Object.assign({}, obj, { key: val })` instead of `{ ...obj, key: val }`
- `obj && obj.name` instead of `obj?.name`
- Ternary with null checks instead of `??`

## Learning Engine

- Pipeline: `study → learn → generate` (NOT copy)
- Core type: `StructuralFingerprint`
- Every extractor implements `TokenExtractor<TSource>` interface

/**
 * Build script for @dsb/mcp-server.
 *
 * Uses esbuild instead of tsc because the @modelcontextprotocol/sdk v1.26
 * creates deeply nested generic types that cause TypeScript's checker to OOM
 * when compiling 30+ tool registrations with Zod schemas.
 *
 * esbuild strips types without checking them, compiling in <1s.
 * For type checking, use `npm run typecheck` (tsc --noEmit) separately
 * with a generous heap: NODE_OPTIONS="--max-old-space-size=16384"
 */

import { build, context } from 'esbuild';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const isWatch = process.argv.includes('--watch');
const srcDir = resolve(import.meta.dirname, '../src');

/**
 * Collect all .ts entry points from src/ recursively.
 * esbuild needs explicit entry points for non-bundled builds.
 */
function collectEntryPoints(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      entries.push(...collectEntryPoints(full));
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      entries.push(full);
    }
  }
  return entries;
}

const entryPoints = collectEntryPoints(srcDir);

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints,
  outdir: resolve(import.meta.dirname, '../dist'),
  platform: 'node',
  target: 'es2022',
  format: 'cjs',
  sourcemap: true,

  // Don't bundle — keep individual files matching tsc output structure
  bundle: false,

  logLevel: 'info',
};

if (isWatch) {
  const ctx = await context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await build(buildOptions);
  console.log('Build complete.');
}

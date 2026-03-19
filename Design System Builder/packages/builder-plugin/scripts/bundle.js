/**
 * Bundle script for the Design System Builder Figma plugin.
 *
 * Uses esbuild to bundle all TypeScript source files into a single code.js
 * that Figma can load. The bundle includes:
 *   - code.ts (entry point + command router)
 *   - polling.ts (HTTP polling engine)
 *   - handlers/*.ts (all command handlers)
 *   - @dsb/figma-api (inlined — plugin can't use node_modules at runtime)
 *   - @dsb/core (inlined — only the parts actually imported)
 *
 * Output target: ES2017 (QuickJS sandbox constraint).
 */

const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: [path.resolve(__dirname, '../src/code.ts')],
  bundle: true,
  outfile: path.resolve(__dirname, '../code.js'),
  target: 'es2017',
  format: 'iife',
  platform: 'browser',

  // Figma's sandbox provides a global `figma` object — don't try to bundle it
  external: [],

  // Resolve workspace packages
  alias: {
    '@dsb/figma-api': path.resolve(__dirname, '../../figma-api/src/index.ts'),
    '@dsb/core': path.resolve(__dirname, '../../core/src/index.ts'),
    // Only pull in result.ts — the plugin only uses the Result type.
    // The full guardrails package imports node:fs/node:path which don't exist in Figma's sandbox.
    '@dsb/guardrails': path.resolve(__dirname, '../../guardrails/src/result.ts'),
  },

  // No source maps for production plugin code
  sourcemap: false,

  // Minify for smaller plugin size
  minify: !isWatch,

  // Tree-shake unused code
  treeShaking: true,

  // Log level
  logLevel: 'info',
};

async function build() {
  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    const result = await esbuild.build(buildOptions);
    if (result.errors.length > 0) {
      console.error('Build failed:', result.errors);
      process.exit(1);
    }
    console.log('Bundle complete: code.js');
  }
}

build().catch(function(err) {
  console.error(err);
  process.exit(1);
});

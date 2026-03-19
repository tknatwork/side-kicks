/**
 * Guardrails constants — shared configuration for the sandbox system.
 *
 * @module constants
 */

import * as path from 'node:path';
import * as os from 'node:os';

// ============================================================================
// SECTION 1: ENVIRONMENT DETECTION
// ============================================================================

/**
 * Resolve the DSB root directory.
 * In production: the Design System Builder installation folder.
 * Falls back to env var or cwd.
 */
export function resolveDsbRoot(): string {
  if (process.env['DSB_ROOT']) {
    return path.resolve(process.env['DSB_ROOT']);
  }
  // Walk up from packages/guardrails/src/ to the root
  return path.resolve(__dirname, '..', '..', '..');
}

export const DSB_ROOT: string = resolveDsbRoot();

// ============================================================================
// SECTION 2: SANDBOX BOUNDARIES
// ============================================================================

/** Directories that can be read from. */
export const READ_ALLOWED_ROOTS: readonly string[] = Object.freeze([
  path.resolve(DSB_ROOT, 'workspace', 'context'),
  path.resolve(DSB_ROOT, 'workspace', 'exports'),
  path.resolve(DSB_ROOT, 'workspace', 'specs'),
  path.resolve(DSB_ROOT, 'workspace', 'reports'),
  path.resolve(DSB_ROOT, 'workspace', 'temp'),
  path.resolve(DSB_ROOT, 'templates'),
  path.resolve(DSB_ROOT, '.dsb'),
  path.resolve(os.homedir(), '.dsb'),
]);

/** Directories that can be written to. */
export const WRITE_ALLOWED_ROOTS: readonly string[] = Object.freeze([
  path.resolve(DSB_ROOT, 'workspace', 'exports'),
  path.resolve(DSB_ROOT, 'workspace', 'specs'),
  path.resolve(DSB_ROOT, 'workspace', 'reports'),
  path.resolve(DSB_ROOT, 'workspace', 'temp'),
  path.resolve(DSB_ROOT, '.dsb'),
  path.resolve(os.homedir(), '.dsb'),
]);

// ============================================================================
// SECTION 3: FILE POLICY
// ============================================================================

/** File extensions allowed for context input (workspace/context/). */
export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  '.json', '.tokens', '.tokens.json',
  '.pdf', '.md', '.txt',
  '.css', '.scss', '.less',
  '.ts', '.tsx', '.js', '.jsx',
  '.vue', '.svelte',
  '.yaml', '.yml',
  '.config.js', '.config.ts',
  '.svg', '.png', '.jpg', '.jpeg', '.webp',
]);

/** File extensions that are always blocked — never processed. */
export const BLOCKED_EXTENSIONS: ReadonlySet<string> = new Set([
  '.exe', '.app', '.dmg', '.msi',
  '.sh', '.bat', '.cmd', '.ps1',
  '.env', '.env.local',
  '.pem', '.key', '.cert', '.crt',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.db', '.sqlite', '.sql',
  '.doc', '.docx', '.xls', '.xlsx',
]);

/** Patterns in filenames that indicate secrets — always blocked. */
export const SECRET_PATTERNS: readonly RegExp[] = Object.freeze([
  /\.env(\..+)?$/,
  /credentials/i,
  /secret/i,
  /\.pem$/,
  /\.key$/,
  /id_rsa/,
  /id_ed25519/,
]);

// ============================================================================
// SECTION 4: SIZE LIMITS
// ============================================================================

/** Maximum size per file in bytes (10 MB). */
export const MAX_FILE_SIZE: number = 10 * 1024 * 1024;

/** Maximum total size of workspace/context/ in bytes (100 MB). */
export const MAX_CONTEXT_SIZE: number = 100 * 1024 * 1024;

/** Maximum total workspace size in bytes (500 MB). */
export const MAX_WORKSPACE_SIZE: number = 500 * 1024 * 1024;

// ============================================================================
// SECTION 5: NETWORK
// ============================================================================

/** Allowed network destinations. */
export const ALLOWED_HOSTS: readonly string[] = Object.freeze([
  'localhost',
  '127.0.0.1',
  'api.figma.com',
  'api.gumroad.com',
]);

/** Default ports. */
export const DEFAULT_PLUGIN_PORT: number = 9876;
export const DEFAULT_ORCHESTRATION_PORT: number = 9877;

// ============================================================================
// SECTION 6: DEVELOPMENT FLAGS
// ============================================================================

export const IS_DEVELOPMENT: boolean = process.env['DEVELOPMENT_MODE'] === 'true';
export const LICENSE_BYPASS: boolean = process.env['LICENSE_BYPASS'] === 'true';
export const INTEGRITY_BYPASS: boolean = process.env['INTEGRITY_BYPASS'] === 'true';

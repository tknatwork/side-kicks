/**
 * Integrity Verification — File hash manifest and tamper detection.
 *
 * At build time, a manifest of SHA-256 hashes is generated and HMAC-signed.
 * At runtime, the toolkit verifies its own files against this manifest.
 *
 * @module integrity
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Result } from './result';
import { sha256File, hmacSha256 } from './crypto';
import { DSB_ROOT, INTEGRITY_BYPASS } from './constants';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

export interface IntegrityManifest {
  /** Map of relative file paths to their SHA-256 hashes. */
  readonly files: Record<string, string>;
  /** HMAC-SHA256 signature of the files map. */
  readonly signature: string;
  /** Build version that generated this manifest. */
  readonly buildVersion: string;
  /** Timestamp of manifest generation. */
  readonly generatedAt: string;
}

export type IntegrityStatus = 'valid' | 'tampered' | 'missing_manifest' | 'bypassed';

export interface IntegrityCheckResult {
  readonly status: IntegrityStatus;
  /** Files that have been modified (hash mismatch). */
  readonly modifiedFiles: readonly string[];
  /** Files in manifest but missing from disk. */
  readonly missingFiles: readonly string[];
  /** Files on disk but not in manifest (additions). */
  readonly addedFiles: readonly string[];
}

// ============================================================================
// SECTION 2: MANIFEST OPERATIONS
// ============================================================================

const MANIFEST_PATH: string = path.resolve(
  DSB_ROOT, 'packages', 'guardrails', 'dist', 'integrity-manifest.json'
);

/**
 * Generate an integrity manifest for all critical files.
 * Called at build/packaging time only.
 *
 * @param signingSecret - The secret used to sign the manifest (never shipped).
 * @param buildVersion - The build version string.
 * @returns The generated manifest.
 */
export function generateManifest(
  signingSecret: string,
  buildVersion: string
): Result<IntegrityManifest, string> {
  const criticalPaths = getCriticalFilePaths();
  const files: Record<string, string> = {};

  for (const relativePath of criticalPaths) {
    const absolutePath = path.resolve(DSB_ROOT, relativePath);
    const hashResult = sha256File(absolutePath);
    if (!hashResult.ok) {
      // Skip files that don't exist (not yet built)
      continue;
    }
    files[relativePath] = hashResult.value;
  }

  if (Object.keys(files).length === 0) {
    return Result.err('No critical files found to hash. Has the project been built?');
  }

  // Sign the files map
  const filesJson = JSON.stringify(files, Object.keys(files).sort());
  const signature = hmacSha256(filesJson, signingSecret);

  const manifest: IntegrityManifest = {
    files,
    signature,
    buildVersion,
    generatedAt: new Date().toISOString(),
  };

  return Result.ok(manifest);
}

/**
 * Verify the integrity of the toolkit against the manifest.
 *
 * @returns Check result with lists of modified, missing, and added files.
 */
export function verifyIntegrity(): IntegrityCheckResult {
  if (INTEGRITY_BYPASS) {
    return {
      status: 'bypassed',
      modifiedFiles: [],
      missingFiles: [],
      addedFiles: [],
    };
  }

  // Load manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    return {
      status: 'missing_manifest',
      modifiedFiles: [],
      missingFiles: [],
      addedFiles: [],
    };
  }

  let manifest: IntegrityManifest;
  try {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(content) as IntegrityManifest;
  } catch {
    return {
      status: 'tampered',
      modifiedFiles: ['integrity-manifest.json'],
      missingFiles: [],
      addedFiles: [],
    };
  }

  // Verify each file
  const modifiedFiles: string[] = [];
  const missingFiles: string[] = [];

  for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
    const absolutePath = path.resolve(DSB_ROOT, relativePath);
    const hashResult = sha256File(absolutePath);

    if (!hashResult.ok) {
      missingFiles.push(relativePath);
      continue;
    }

    if (hashResult.value !== expectedHash) {
      modifiedFiles.push(relativePath);
    }
  }

  const isTampered = modifiedFiles.length > 0 || missingFiles.length > 0;

  return {
    status: isTampered ? 'tampered' : 'valid',
    modifiedFiles,
    missingFiles,
    addedFiles: [], // We don't track additions for now
  };
}

/**
 * Verify a random subset of files (used for heartbeat checks).
 *
 * @param count - Number of files to randomly check.
 * @returns Whether all checked files are intact.
 */
export function verifyRandomSubset(count: number = 5): IntegrityCheckResult {
  if (INTEGRITY_BYPASS) {
    return { status: 'bypassed', modifiedFiles: [], missingFiles: [], addedFiles: [] };
  }

  if (!fs.existsSync(MANIFEST_PATH)) {
    return { status: 'missing_manifest', modifiedFiles: [], missingFiles: [], addedFiles: [] };
  }

  let manifest: IntegrityManifest;
  try {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    manifest = JSON.parse(content) as IntegrityManifest;
  } catch {
    return { status: 'tampered', modifiedFiles: ['integrity-manifest.json'], missingFiles: [], addedFiles: [] };
  }

  const allFiles = Object.entries(manifest.files);
  const selected = selectRandom(allFiles, Math.min(count, allFiles.length));

  const modifiedFiles: string[] = [];
  const missingFiles: string[] = [];

  for (const [relativePath, expectedHash] of selected) {
    const absolutePath = path.resolve(DSB_ROOT, relativePath);
    const hashResult = sha256File(absolutePath);

    if (!hashResult.ok) {
      missingFiles.push(relativePath);
      continue;
    }

    if (hashResult.value !== expectedHash) {
      modifiedFiles.push(relativePath);
    }
  }

  const isTampered = modifiedFiles.length > 0 || missingFiles.length > 0;
  return { status: isTampered ? 'tampered' : 'valid', modifiedFiles, missingFiles, addedFiles: [] };
}

// ============================================================================
// SECTION 3: CRITICAL FILE PATHS
// ============================================================================

/**
 * Returns the list of critical file paths to include in the integrity manifest.
 * These are relative to DSB_ROOT.
 */
function getCriticalFilePaths(): readonly string[] {
  // This list is populated at build time by scanning the dist/ directories
  // For now, return the known critical paths
  return [
    'packages/core/dist/index.js',
    'packages/mcp-server/dist/index.js',
    'packages/orchestration-server/dist/index.js',
    'packages/builder-plugin/code.js',
    'packages/style-generator-plugin/code.js',
    'packages/guardrails/dist/index.js',
    'packages/licensing/dist/index.js',
    '.claude/CLAUDE.md',
  ];
}

// ============================================================================
// SECTION 4: HELPERS
// ============================================================================

function selectRandom<T>(array: readonly T[], count: number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, count);
}

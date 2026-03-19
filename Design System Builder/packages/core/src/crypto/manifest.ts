/**
 * Project Manifest — File hash manifest for the user's DSB project folder.
 *
 * Unlike guardrails' `integrity.ts` (which protects DSB's own compiled code),
 * this module protects the user's project folder:
 *   - README.md (locked instruction file)
 *   - .dsb/ directory contents (encrypted system data)
 *   - workspace/ structure (expected directories)
 *
 * The manifest is stored at `<project-root>/.dsb/manifest.json`.
 * Claude checks it on every `dsb_` tool call to detect unauthorized edits.
 *
 * @module core/crypto/manifest
 */

import * as path from 'node:path';
import { Result, sha256File, sha256, hmacSha256, safeWriteJson, safeReadJson, safeExists } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/** Manifest entry for a single tracked file. */
export interface ManifestEntry {
  /** Relative path from project root. */
  readonly relativePath: string;
  /** SHA-256 hash of file contents. */
  readonly hash: string;
}

/** The full project manifest stored in .dsb/manifest.json. */
export interface ProjectManifest {
  /** Map of relative paths to SHA-256 hashes. */
  readonly files: Readonly<Record<string, string>>;
  /** HMAC-SHA256 signature of the files map (prevents manifest tampering). */
  readonly signature: string;
  /** When this manifest was generated. */
  readonly generatedAt: string;
  /** DSB version that created this project. */
  readonly dsbVersion: string;
}

/** Result of comparing current file state against the manifest. */
export interface ManifestVerification {
  /** Whether all files match their expected hashes. */
  readonly intact: boolean;
  /** Files whose content has changed. */
  readonly modified: readonly string[];
  /** Files expected by manifest but missing from disk. */
  readonly missing: readonly string[];
}

// ============================================================================
// SECTION 2: MANIFEST GENERATION
// ============================================================================

/**
 * Generate a project manifest for the given files.
 *
 * Called during `dsb_setup_project` after the project folder is created.
 * Hashes each tracked file and signs the result with an HMAC.
 *
 * @param projectRoot - Absolute path to the user's project folder.
 * @param trackedFiles - Relative paths of files to track (e.g., ['README.md']).
 * @param signingSecret - Secret for HMAC signing (derived from session).
 * @param dsbVersion - Current DSB version string.
 */
export function generateProjectManifest(
  projectRoot: string,
  trackedFiles: readonly string[],
  signingSecret: string,
  dsbVersion: string
): Result<ProjectManifest, string> {
  const files: Record<string, string> = {};

  for (const relativePath of trackedFiles) {
    const absolutePath = path.resolve(projectRoot, relativePath);
    const hashResult = sha256File(absolutePath);

    if (!hashResult.ok) {
      return Result.err(`Cannot hash "${relativePath}": ${hashResult.error}`);
    }

    files[relativePath] = hashResult.value;
  }

  // Sign the file map to prevent manifest tampering
  const filesJson = JSON.stringify(files, Object.keys(files).sort());
  const signature = hmacSha256(filesJson, signingSecret);

  return Result.ok({
    files,
    signature,
    generatedAt: new Date().toISOString(),
    dsbVersion,
  });
}

/**
 * Save a project manifest to .dsb/manifest.json.
 *
 * @param projectRoot - Absolute path to the user's project folder.
 * @param manifest - The manifest to save.
 */
export function saveProjectManifest(
  projectRoot: string,
  manifest: ProjectManifest
): Result<string, string> {
  const manifestPath = path.join(projectRoot, '.dsb', 'manifest.json');
  return safeWriteJson(manifestPath, manifest);
}

/**
 * Load a project manifest from .dsb/manifest.json.
 *
 * @param projectRoot - Absolute path to the user's project folder.
 * @returns The loaded manifest, or error if not found or invalid.
 */
export function loadProjectManifest(
  projectRoot: string
): Result<ProjectManifest, string> {
  const manifestPath = path.join(projectRoot, '.dsb', 'manifest.json');

  const exists = safeExists(manifestPath);
  if (!exists.ok) return exists;
  if (!exists.value) return Result.err('No manifest found at .dsb/manifest.json');

  return safeReadJson<ProjectManifest>(manifestPath);
}

// ============================================================================
// SECTION 3: MANIFEST VERIFICATION
// ============================================================================

/**
 * Verify all tracked files against the manifest.
 *
 * Compares current SHA-256 hashes against stored hashes.
 * Also verifies the manifest's own HMAC signature.
 *
 * @param projectRoot - Absolute path to the user's project folder.
 * @param manifest - The manifest to verify against.
 * @param signingSecret - The HMAC signing secret (same one used during generation).
 */
export function verifyProjectManifest(
  projectRoot: string,
  manifest: ProjectManifest,
  signingSecret: string
): Result<ManifestVerification, string> {
  // First, verify the manifest's own signature
  const filesJson = JSON.stringify(manifest.files, Object.keys(manifest.files).sort());
  const expectedSignature = hmacSha256(filesJson, signingSecret);

  if (expectedSignature !== manifest.signature) {
    return Result.err('Manifest signature mismatch — manifest itself has been tampered with');
  }

  // Then verify each file
  const modified: string[] = [];
  const missing: string[] = [];

  for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
    const absolutePath = path.resolve(projectRoot, relativePath);

    const existsResult = safeExists(absolutePath);
    if (!existsResult.ok || !existsResult.value) {
      missing.push(relativePath);
      continue;
    }

    const hashResult = sha256File(absolutePath);
    if (!hashResult.ok) {
      missing.push(relativePath);
      continue;
    }

    if (hashResult.value !== expectedHash) {
      modified.push(relativePath);
    }
  }

  return Result.ok({
    intact: modified.length === 0 && missing.length === 0,
    modified,
    missing,
  });
}

/**
 * Verify a single file against the manifest.
 *
 * Faster than full verification — used for targeted checks
 * like "is the README still intact?" on every tool call.
 *
 * @param projectRoot - Absolute path to the user's project folder.
 * @param manifest - The loaded manifest.
 * @param relativePath - The file to check (e.g., 'README.md').
 * @returns true if file matches manifest hash, false otherwise.
 */
export function verifySingleFile(
  projectRoot: string,
  manifest: ProjectManifest,
  relativePath: string
): Result<boolean, string> {
  const expectedHash = manifest.files[relativePath];
  if (!expectedHash) {
    return Result.err(`File "${relativePath}" not tracked in manifest`);
  }

  const absolutePath = path.resolve(projectRoot, relativePath);
  const hashResult = sha256File(absolutePath);

  if (!hashResult.ok) {
    return Result.ok(false); // File missing or unreadable = not intact
  }

  return Result.ok(hashResult.value === expectedHash);
}

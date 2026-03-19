/**
 * Publish Pipeline — Bundle, sign, and package DSB updates for distribution.
 *
 * ADMIN-ONLY: This module is used exclusively on the DSB build server
 * with the admin private key. It is never called on user machines.
 *
 * Flow:
 *   1. Run npm run build to ensure clean build
 *   2. Collect all distributable files
 *   3. Generate SHA-256 checksums for every file
 *   4. Create the update manifest (version, changelog, checksums)
 *   5. Sign manifest with Ed25519 private key
 *   6. Create tar.gz bundle with signature prepended
 *   7. Output signed bundle + manifest to workspace/temp/update-bundle/
 *
 * The signed bundle format:
 *   [64 bytes: Ed25519 signature][rest: tar.gz content]
 *
 * The manifest format:
 *   { signature: base64, payload: JSON string of UpdateManifest }
 *
 * @module updater/publish-pipeline
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { Result } from '@dsb/guardrails';
import type { UpdateManifest } from './version-checker';

// ============================================================================
// SECTION 1: TYPES
// ============================================================================

/** Configuration for publishing an update. */
export interface PublishConfig {
  /** Root directory of the DSB installation to package. */
  readonly sourceDir: string;
  /** Output directory for the signed bundle and manifest. */
  readonly outputDir: string;
  /** Version string for the new release (semver). */
  readonly version: string;
  /** Markdown changelog for this release. */
  readonly changelog: string;
  /** Minimum DSB version required to apply this update. */
  readonly minVersion: string;
  /** Ed25519 private key (PEM) for signing. ADMIN-ONLY — never on user machines. */
  readonly privateKey: string;
  /** HTTPS URL where the bundle will be hosted. */
  readonly downloadUrl: string;
}

/** Result of the publish pipeline. */
export interface PublishResult {
  readonly success: boolean;
  readonly version: string;
  readonly bundlePath: string;
  readonly manifestPath: string;
  readonly bundleSize: number;
  readonly fileCount: number;
  readonly bundleChecksum: string;
}

// ============================================================================
// SECTION 2: MAIN PIPELINE
// ============================================================================

/**
 * Execute the full publish pipeline.
 *
 * Creates a signed update bundle ready for upload to the update server.
 *
 * @param config - Publish configuration with private key.
 * @returns Publish result with paths to generated artifacts.
 */
export async function publishUpdate(
  config: PublishConfig
): Promise<Result<PublishResult, string>> {

  // ─── Step 1: Verify source builds cleanly ────────────────────────────

  const buildResult = await runBuild(config.sourceDir);
  if (!buildResult.ok) return buildResult as Result<never, string>;

  // ─── Step 2: Collect distributable files ─────────────────────────────

  const files = collectDistributableFiles(config.sourceDir);
  if (files.length === 0) {
    return Result.err('No distributable files found in source directory.');
  }

  // ─── Step 3: Generate per-file checksums ─────────────────────────────

  const checksums: Record<string, string> = {};
  for (const relPath of files) {
    const absPath = path.join(config.sourceDir, relPath);
    const data = fs.readFileSync(absPath);
    checksums[relPath] = crypto.createHash('sha256').update(data).digest('hex');
  }

  // ─── Step 4: Create tar.gz bundle ────────────────────────────────────

  fs.mkdirSync(config.outputDir, { recursive: true });
  const tarPath = path.join(config.outputDir, `dsb-${config.version}.tar.gz`);

  const tarResult = await createTarGz(config.sourceDir, tarPath, files);
  if (!tarResult.ok) return tarResult as Result<never, string>;

  // ─── Step 5: Sign the bundle ─────────────────────────────────────────

  const tarData = fs.readFileSync(tarPath);
  const signature = crypto.sign(null, tarData, config.privateKey);

  // Prepend signature to bundle (64 bytes for Ed25519)
  const signedBundlePath = path.join(config.outputDir, `dsb-${config.version}.signed.tar.gz`);
  const signedData = Buffer.concat([signature, tarData]);
  fs.writeFileSync(signedBundlePath, signedData);

  // Clean up unsigned tar
  fs.unlinkSync(tarPath);

  // ─── Step 6: Compute bundle checksum ─────────────────────────────────

  const bundleChecksum = crypto.createHash('sha256').update(signedData).digest('hex');

  // ─── Step 7: Create and sign manifest ────────────────────────────────

  const manifest: UpdateManifest = {
    version: config.version,
    changelog: config.changelog,
    downloadUrl: config.downloadUrl,
    bundleChecksum,
    releasedAt: new Date().toISOString(),
    minVersion: config.minVersion,
    fileChecksums: checksums,
  };

  const manifestPayload = JSON.stringify(manifest, null, 2);
  const manifestSig = crypto.sign(
    null,
    Buffer.from(manifestPayload, 'utf-8'),
    config.privateKey
  );

  const signedManifest = {
    signature: manifestSig.toString('base64'),
    payload: manifestPayload,
  };

  const manifestPath = path.join(config.outputDir, `manifest-${config.version}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(signedManifest, null, 2));

  // ─── Done ────────────────────────────────────────────────────────────

  return Result.ok({
    success: true,
    version: config.version,
    bundlePath: signedBundlePath,
    manifestPath,
    bundleSize: signedData.length,
    fileCount: files.length,
    bundleChecksum,
  });
}

// ============================================================================
// SECTION 3: HELPERS
// ============================================================================

/**
 * Run npm run build in the source directory.
 */
function runBuild(sourceDir: string): Promise<Result<true, string>> {
  return new Promise((resolve) => {
    execFile(
      'npm',
      ['run', 'build'],
      { cwd: sourceDir, timeout: 120_000 },
      (err, _stdout, stderr) => {
        if (err) {
          resolve(Result.err(`Build failed: ${err.message}\n${stderr}`));
        } else {
          resolve(Result.ok(true));
        }
      }
    );
  });
}

/**
 * Collect all distributable files (source + dist, excluding node_modules, .git, etc.).
 *
 * Returns relative paths from sourceDir.
 */
function collectDistributableFiles(sourceDir: string): string[] {
  const files: string[] = [];
  const EXCLUDE = new Set([
    'node_modules',
    '.git',
    '.dsb',
    'workspace',
    '__tests__',
    '.env',
    '.env.local',
  ]);

  function walk(dir: string, prefix: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDE.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.claude') continue;

      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(absPath, relPath);
      } else if (entry.isFile()) {
        files.push(relPath);
      }
    }
  }

  walk(sourceDir, '');
  return files;
}

/**
 * Create a tar.gz archive of specific files from sourceDir.
 */
function createTarGz(
  sourceDir: string,
  outputPath: string,
  files: string[]
): Promise<Result<true, string>> {
  return new Promise((resolve) => {
    // Write file list to a temp file for tar's --files-from
    const listPath = outputPath + '.filelist';
    fs.writeFileSync(listPath, files.join('\n'));

    execFile(
      'tar',
      ['czf', outputPath, '-C', sourceDir, '--files-from', listPath],
      { timeout: 60_000 },
      (err) => {
        // Clean up file list
        try { fs.unlinkSync(listPath); } catch { /* ignore */ }

        if (err) {
          resolve(Result.err(`Failed to create tar.gz: ${err.message}`));
        } else {
          resolve(Result.ok(true));
        }
      }
    );
  });
}

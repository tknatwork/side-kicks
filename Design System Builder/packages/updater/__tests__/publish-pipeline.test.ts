/**
 * Tests for publish-pipeline.ts — admin-only publish types and crypto signing.
 *
 * The publish pipeline is admin-only and requires a private key + filesystem.
 * We test the type contracts and verify the Ed25519 signing logic independently.
 */

import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
import type { PublishConfig, PublishResult } from '../src/publish-pipeline';
import type { UpdateManifest } from '../src/version-checker';

// ============================================================================
// SECTION 1: PublishConfig Type Shape
// ============================================================================

describe('PublishConfig type shape', () => {
  it('captures all required publish parameters', () => {
    const config: PublishConfig = {
      sourceDir: '/path/to/dsb',
      outputDir: '/path/to/output',
      version: '0.2.0',
      changelog: '## v0.2.0\n- Feature A\n- Bug fix B',
      minVersion: '0.1.0',
      privateKey: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
      downloadUrl: 'https://updates.dsb.example/v1/bundle/0.2.0',
    };

    expect(config.version).toBe('0.2.0');
    expect(config.privateKey).toContain('PRIVATE KEY');
    expect(config.downloadUrl).toMatch(/^https:\/\//);
  });
});

// ============================================================================
// SECTION 2: PublishResult Type Shape
// ============================================================================

describe('PublishResult type shape', () => {
  it('captures all result fields', () => {
    const result: PublishResult = {
      success: true,
      version: '0.2.0',
      bundlePath: '/path/to/dsb-0.2.0.signed.tar.gz',
      manifestPath: '/path/to/manifest-0.2.0.json',
      bundleSize: 1024 * 1024,
      fileCount: 42,
      bundleChecksum: 'a'.repeat(64),
    };

    expect(result.success).toBe(true);
    expect(result.bundleChecksum).toHaveLength(64);
    expect(result.fileCount).toBe(42);
  });
});

// ============================================================================
// SECTION 3: Ed25519 Sign+Verify Round-Trip (Crypto Integrity)
// ============================================================================

describe('Ed25519 crypto round-trip', () => {
  /**
   * This test proves that the Ed25519 sign+verify pipeline works correctly.
   * The publish pipeline signs with the private key; the version-checker
   * verifies with the public key. We test the round-trip here.
   */
  const keyPair = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
  const privateKeyPem = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  it('signature created by private key is verified by public key', () => {
    const manifest: UpdateManifest = {
      version: '0.2.0',
      changelog: 'Test release',
      downloadUrl: 'https://updates.dsb.example/v1/bundle/0.2.0',
      bundleChecksum: 'abc123',
      releasedAt: '2025-01-01T00:00:00.000Z',
      minVersion: '0.1.0',
      fileChecksums: { 'dist/index.js': 'def456' },
    };

    const payload = JSON.stringify(manifest, null, 2);
    const signature = crypto.sign(null, Buffer.from(payload, 'utf-8'), privateKeyPem);

    const isValid = crypto.verify(
      null,
      Buffer.from(payload, 'utf-8'),
      publicKeyPem,
      signature
    );

    expect(isValid).toBe(true);
  });

  it('tampered payload fails verification', () => {
    const payload = JSON.stringify({ version: '0.2.0', data: 'original' });
    const signature = crypto.sign(null, Buffer.from(payload, 'utf-8'), privateKeyPem);

    const tampered = JSON.stringify({ version: '9.9.9', data: 'tampered' });
    const isValid = crypto.verify(
      null,
      Buffer.from(tampered, 'utf-8'),
      publicKeyPem,
      signature
    );

    expect(isValid).toBe(false);
  });

  it('wrong key pair fails verification', () => {
    const otherKeyPair = crypto.generateKeyPairSync('ed25519');
    const otherPublicPem = otherKeyPair.publicKey.export({ type: 'spki', format: 'pem' }) as string;

    const payload = JSON.stringify({ version: '0.2.0' });
    const signature = crypto.sign(null, Buffer.from(payload, 'utf-8'), privateKeyPem);

    const isValid = crypto.verify(
      null,
      Buffer.from(payload, 'utf-8'),
      otherPublicPem,
      signature
    );

    expect(isValid).toBe(false);
  });

  it('bundle signature format: 64-byte prepend + content', () => {
    // The publish pipeline prepends a 64-byte Ed25519 signature to the bundle
    const content = Buffer.from('fake tar.gz content');
    const signature = crypto.sign(null, content, privateKeyPem);

    // Ed25519 signatures are always 64 bytes
    expect(signature.length).toBe(64);

    // Combine: [64 bytes sig][content]
    const signedBundle = Buffer.concat([signature, content]);
    expect(signedBundle.length).toBe(64 + content.length);

    // Verify: extract sig and content, verify
    const extractedSig = signedBundle.subarray(0, 64);
    const extractedContent = signedBundle.subarray(64);

    const isValid = crypto.verify(null, extractedContent, publicKeyPem, extractedSig);
    expect(isValid).toBe(true);
    expect(extractedContent.toString()).toBe('fake tar.gz content');
  });

  it('SHA-256 checksum matches for same content', () => {
    const content = Buffer.from('some bundle data');
    const hash1 = crypto.createHash('sha256').update(content).digest('hex');
    const hash2 = crypto.createHash('sha256').update(content).digest('hex');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('SHA-256 checksum changes for different content', () => {
    const hash1 = crypto.createHash('sha256').update('content-a').digest('hex');
    const hash2 = crypto.createHash('sha256').update('content-b').digest('hex');
    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================================
// SECTION 4: publishUpdate export
// ============================================================================

describe('publishUpdate export', () => {
  it('is exported and callable', async () => {
    const { publishUpdate } = await import('../src/publish-pipeline');
    expect(typeof publishUpdate).toBe('function');
  });
});

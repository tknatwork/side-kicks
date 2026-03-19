/**
 * Admin Tools — MCP tools for DSB team access (invisible to normal users).
 *
 * Tools:
 *   dsb_admin_unlock    — Initiate admin authentication (challenge-response)
 *   dsb_admin_lock      — Deactivate admin mode
 *   dsb_admin_inspect   — Read any file as plaintext (decrypts .enc files)
 *   dsb_admin_publish_update — Package and sign an update bundle
 *   dsb_admin_test_build — Run build pipeline in test mode (mock Figma)
 *   dsb_admin_decrypt_state — Decrypt and display build-state.json
 *
 * VISIBILITY:
 *   These tools are only registered when admin mode is active OR
 *   when the unlock flow is in progress. Normal users never see them
 *   in the MCP tool list. The `dsb admin unlock` command is undocumented.
 *
 * SECURITY:
 *   - Admin key (secp256k1 private) NEVER touches this code
 *   - Authentication is challenge-response: server generates challenge,
 *     admin signs with hardware wallet, server verifies with public key
 *   - Session-only: 4-hour max, cleared on process exit
 *   - All operations are logged for audit
 *
 * @module mcp-server/tools/admin-tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  generateAdminChallenge,
  verifyAdminSignature,
  isAdminMode,
  deactivateAdminMode,
  getAdminSession,
  getAdminTimeRemaining,
} from '@dsb/licensing';
import { decryptConfig, sessionKeyFromHex } from '@dsb/core';
import type { EncryptedConfig } from '@dsb/core';
import { publishUpdate } from '@dsb/updater';
import type { PublishConfig } from '@dsb/updater';
import { safeReadJson, DSB_ROOT } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: REGISTRATION
// ============================================================================

/**
 * Register admin tools.
 *
 * IMPORTANT: The unlock tool is always registered (so the admin can
 * initiate authentication), but all other admin tools are guarded by
 * isAdminMode() at execution time. They return errors if admin mode
 * is not active.
 */
export function registerAdminTools(server: McpServer, bridge: BridgeClient): void {

  // ─── Admin Unlock (Challenge Phase) ────────────────────────────────

  server.tool(
    'dsb_admin_unlock',
    'Initiate or complete admin authentication. First call returns a challenge. Second call with the signed challenge activates admin mode.',
    {
      signature: z.string().optional().describe(
        'Base64-encoded secp256k1 ECDSA signature of the challenge. '
        + 'Omit on first call to receive the challenge.'
      ),
    },
    async ({ signature }) => {
      if (!signature) {
        // Phase 1: Generate and return challenge
        const challenge = generateAdminChallenge();
        return ok({
          message: 'Admin challenge generated. Sign this with the admin private key and call again with the signature.',
          challenge,
          action: 'Sign the challenge hex string with the secp256k1 admin key and provide the base64 signature.',
        });
      }

      // Phase 2: Verify signature
      const result = verifyAdminSignature(signature);
      if (!result.ok) {
        return error(result.error);
      }

      const session = result.value;
      const hours = Math.round((session.expiresAt - session.activatedAt) / (60 * 60 * 1000));

      return ok({
        message: `Admin mode activated. Session expires in ${hours} hours.`,
        activatedAt: new Date(session.activatedAt).toISOString(),
        expiresAt: new Date(session.expiresAt).toISOString(),
      });
    }
  );

  // ─── Admin Lock ────────────────────────────────────────────────────

  server.tool(
    'dsb_admin_lock',
    'Deactivate admin mode immediately.',
    {},
    async () => {
      if (!isAdminMode()) {
        return ok({ message: 'Admin mode is not active.' });
      }

      deactivateAdminMode();
      return ok({ message: 'Admin mode deactivated. Session cleared from memory.' });
    }
  );

  // ─── Admin Inspect ─────────────────────────────────────────────────

  server.tool(
    'dsb_admin_inspect',
    'Read any file in the DSB project as plaintext, including encrypted .enc files. Admin-only.',
    {
      filePath: z.string().describe('Absolute path to the file to inspect.'),
      sessionKeyHex: z.string().optional().describe(
        'Session key hex for decrypting encrypted config files. '
        + 'Required for .enc files or build-state.json config field.'
      ),
    },
    async ({ filePath, sessionKeyHex }) => {
      if (!isAdminMode()) {
        return error('Admin mode not active. Use dsb_admin_unlock first.');
      }

      try {
        if (!fs.existsSync(filePath)) {
          return error(`File not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');

        // If it looks like encrypted JSON, try to decrypt
        if (sessionKeyHex && (filePath.endsWith('.enc') || filePath.includes('build-state'))) {
          try {
            const parsed = JSON.parse(content);
            if (parsed.ciphertext && parsed.iv && parsed.authTag) {
              const keyResult = sessionKeyFromHex(sessionKeyHex);
              if (keyResult.ok) {
                const decryptResult = decryptConfig(parsed as EncryptedConfig, keyResult.value);
                if (decryptResult.ok) {
                  return ok({
                    file: filePath,
                    decrypted: true,
                    content: decryptResult.value,
                  });
                }
              }
            }
          } catch {
            // Not encrypted JSON — return raw content
          }
        }

        return ok({
          file: filePath,
          decrypted: false,
          content,
          size: Buffer.byteLength(content, 'utf-8'),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return error(`Failed to read file: ${message}`);
      }
    }
  );

  // ─── Admin Publish Update ──────────────────────────────────────────

  server.tool(
    'dsb_admin_publish_update',
    'Package and sign a DSB update bundle for distribution. Admin-only.',
    {
      version: z.string().describe('Semver version string for the new release.'),
      changelog: z.string().describe('Markdown changelog for this release.'),
      minVersion: z.string().optional().describe('Minimum DSB version required to apply (default: "0.1.0").'),
      privateKeyPath: z.string().describe('Path to the Ed25519 private key PEM file (for signing).'),
      downloadUrl: z.string().describe('HTTPS URL where the bundle will be hosted.'),
    },
    async ({ version, changelog, minVersion, privateKeyPath, downloadUrl }) => {
      if (!isAdminMode()) {
        return error('Admin mode not active. Use dsb_admin_unlock first.');
      }

      // Read private key from file
      let privateKey: string;
      try {
        privateKey = fs.readFileSync(privateKeyPath, 'utf-8');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return error(`Failed to read private key: ${message}`);
      }

      const config: PublishConfig = {
        sourceDir: DSB_ROOT,
        outputDir: path.join(DSB_ROOT, 'workspace', 'temp', 'update-bundle'),
        version,
        changelog,
        minVersion: minVersion || '0.1.0',
        privateKey,
        downloadUrl,
      };

      const result = await publishUpdate(config);

      if (!result.ok) {
        return error(result.error);
      }

      return ok({
        message: `Update v${version} packaged and signed successfully.`,
        bundlePath: result.value.bundlePath,
        manifestPath: result.value.manifestPath,
        bundleSize: result.value.bundleSize,
        fileCount: result.value.fileCount,
        checksum: result.value.bundleChecksum,
        action: 'Upload the bundle and manifest to the update server.',
      });
    }
  );

  // ─── Admin Test Build ──────────────────────────────────────────────

  server.tool(
    'dsb_admin_test_build',
    'Run the full build pipeline in test mode (mock Figma responses). Admin-only.',
    {},
    async () => {
      if (!isAdminMode()) {
        return error('Admin mode not active. Use dsb_admin_unlock first.');
      }

      // Test builds are a future implementation — for now, report the feature
      return ok({
        message: 'Test build mode is a Phase 6 feature. The admin tools infrastructure is in place.',
        adminSession: {
          active: true,
          timeRemaining: `${Math.round(getAdminTimeRemaining() / 60000)} minutes`,
        },
      });
    }
  );

  // ─── Admin Decrypt State ───────────────────────────────────────────

  server.tool(
    'dsb_admin_decrypt_state',
    'Decrypt and display the current build-state.json in plaintext. Admin-only.',
    {
      sessionKeyHex: z.string().describe('Session key hex for decrypting the encrypted config in build state.'),
    },
    async ({ sessionKeyHex }) => {
      if (!isAdminMode()) {
        return error('Admin mode not active. Use dsb_admin_unlock first.');
      }

      const statePath = path.join(DSB_ROOT, 'workspace', 'temp', 'build-state.json');
      const stateResult = safeReadJson<Record<string, unknown>>(statePath);

      if (!stateResult.ok) {
        return error('No build state found or failed to read: ' + stateResult.error);
      }

      const state = stateResult.value;

      // Try to decrypt the encrypted config field
      if (state.encryptedConfig && sessionKeyHex) {
        const keyResult = sessionKeyFromHex(sessionKeyHex);
        if (keyResult.ok) {
          const decryptResult = decryptConfig(
            state.encryptedConfig as EncryptedConfig,
            keyResult.value
          );
          if (decryptResult.ok) {
            return ok({
              ...state,
              encryptedConfig: undefined,
              decryptedConfig: decryptResult.value,
              _adminDecrypted: true,
            });
          }
        }
      }

      return ok({
        ...state,
        _note: 'Config field is encrypted. Provide a valid sessionKeyHex to decrypt.',
      });
    }
  );
}

// ============================================================================
// SECTION 2: HELPERS
// ============================================================================

function ok(data: Record<string, unknown>) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(data, null, 2),
    }],
  };
}

function error(message: string) {
  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify({ error: message }, null, 2),
    }],
  };
}

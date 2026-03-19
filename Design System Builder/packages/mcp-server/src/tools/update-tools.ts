/**
 * Update Tools — MCP tools for checking and applying OTA updates.
 *
 * Tools:
 *   dsb_check_updates — Check for new DSB versions (called on startup).
 *   dsb_apply_update  — Download, verify, and install an approved update.
 *
 * SECURITY MODEL:
 *   - No admin key involved on user machines
 *   - Ed25519 public key (embedded) verifies bundle signatures
 *   - Gumroad license authenticates download access
 *   - Anti-tamper daemon paused via time-limited update token
 *   - Automatic rollback on any failure
 *
 * @module mcp-server/tools/update-tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import { z } from 'zod';
import * as crypto from 'node:crypto';
import {
  checkForUpdates,
  executeUpdate,
  CURRENT_VERSION,
  UPDATE_TOKEN_TTL_MS,
} from '@dsb/updater';
import type { UpdateManifest, UpdateBridge } from '@dsb/updater';

// ============================================================================
// SECTION 1: IN-MEMORY STATE
// ============================================================================

/**
 * Cache the last update check result so Claude can reference it
 * between the check and apply calls within the same session.
 */
let cachedManifest: UpdateManifest | null = null;

// ============================================================================
// SECTION 2: REGISTRATION
// ============================================================================

export function registerUpdateTools(server: McpServer, bridge: BridgeClient): void {

  // ─── Check Updates ─────────────────────────────────────────────────

  server.tool(
    'dsb_check_updates',
    'Check for available DSB updates. Called automatically on startup. Returns version info and changelog if an update is available.',
    {
      licenseKey: z.string().describe('The user\'s Gumroad license key for download authentication.'),
    },
    async ({ licenseKey }) => {
      const result = await checkForUpdates(licenseKey);

      if (!result.available || !result.manifest) {
        cachedManifest = null;
        return ok({
          message: 'DSB is up to date.',
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion || result.currentVersion,
        });
      }

      // Cache manifest for the apply step
      cachedManifest = result.manifest;

      return ok({
        message: `DSB v${result.latestVersion} is available (you have v${result.currentVersion}).`,
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        changelog: result.changelog,
        action: 'Present this to the user. If they approve, call dsb_apply_update.',
      });
    }
  );

  // ─── Apply Update ──────────────────────────────────────────────────

  server.tool(
    'dsb_apply_update',
    'Download, verify, and install the available DSB update. Requires user approval first. Automatically rolls back on failure.',
    {
      licenseKey: z.string().describe('The user\'s Gumroad license key for download authentication.'),
      installDir: z.string().describe('Root directory of the DSB installation (the packages/ parent directory).'),
    },
    async ({ licenseKey, installDir }) => {

      if (!cachedManifest) {
        return error('No update available. Run dsb_check_updates first.');
      }

      const manifest = cachedManifest;

      // Create the bridge adapter for daemon communication
      const updateBridge: UpdateBridge = {
        async enterDaemonUpdateMode(token: string) {
          const result = await bridge.enterDaemonUpdateMode(token);
          return { ok: result !== null, error: result ? undefined : 'Bridge communication failed' };
        },
        async exitDaemonUpdateMode(token: string) {
          const result = await bridge.exitDaemonUpdateMode(token);
          return { ok: result !== null, error: result ? undefined : 'Bridge communication failed' };
        },
      };

      // Execute the full update pipeline
      const result = await executeUpdate(
        manifest,
        licenseKey,
        CURRENT_VERSION,
        installDir,
        updateBridge,
        (step, detail) => {
          // Progress is logged but not returned mid-execution
          // In a future version, this could push SSE events
        }
      );

      // Clear cached manifest regardless of outcome
      cachedManifest = null;

      if (!result.success) {
        return error(result.message);
      }

      return ok({
        message: result.message,
        fromVersion: result.fromVersion,
        toVersion: result.toVersion,
        action: 'Restart the MCP server to load the new version. Tell the user: "Updated successfully! Restarting..."',
      });
    }
  );
}

// ============================================================================
// SECTION 3: HELPERS
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

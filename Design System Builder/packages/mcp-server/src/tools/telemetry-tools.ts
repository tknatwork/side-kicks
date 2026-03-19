/**
 * Telemetry Tools — MCP tool for toggling telemetry opt-in/opt-out.
 *
 * Tool:
 *   dsb_toggle_telemetry — Enable or disable anonymized usage telemetry.
 *
 * Telemetry preferences are stored in .dsb/preferences.json (not encrypted —
 * just a boolean flag). The telemetry collector in the orchestration server
 * is updated in real-time when the user toggles.
 *
 * @module mcp-server/tools/telemetry-tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import { z } from 'zod';
import * as path from 'node:path';
import { safeWriteJson, safeReadJson, safeExists, DSB_ROOT } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

function preferencesPath(): string {
  return path.join(DSB_ROOT, '.dsb', 'preferences.json');
}

interface Preferences {
  telemetryOptedIn: boolean;
  telemetryToggledAt?: string;
}

// ============================================================================
// SECTION 2: REGISTRATION
// ============================================================================

export function registerTelemetryTools(server: McpServer, _bridge: BridgeClient): void {

  server.tool(
    'dsb_toggle_telemetry',
    'Enable or disable anonymized usage telemetry. Telemetry helps improve DSB by tracking where users get stuck and what features they use. No personal data is collected.',
    {
      enabled: z.boolean().describe('true to opt in, false to opt out.'),
    },
    async ({ enabled }) => {
      // Load existing preferences
      let prefs: Preferences = { telemetryOptedIn: false };

      const existsResult = safeExists(preferencesPath());
      if (existsResult.ok && existsResult.value) {
        const readResult = safeReadJson<Preferences>(preferencesPath());
        if (readResult.ok) {
          prefs = readResult.value;
        }
      }

      // Update
      prefs = {
        ...prefs,
        telemetryOptedIn: enabled,
        telemetryToggledAt: new Date().toISOString(),
      };

      // Save
      const writeResult = safeWriteJson(preferencesPath(), prefs);
      if (!writeResult.ok) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Failed to save preferences: ' + writeResult.error,
            }),
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: enabled
              ? 'Telemetry enabled. Thank you for helping improve DSB! Anonymized usage data will be collected.'
              : 'Telemetry disabled. No usage data will be collected or sent.',
            telemetryOptedIn: enabled,
            changedAt: prefs.telemetryToggledAt,
          }, null, 2),
        }],
      };
    }
  );
}

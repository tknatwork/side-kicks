/**
 * Connection Tools — MCP tools for checking connection and infrastructure status.
 *
 * @module mcp-server/tools/connection-tools
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BridgeClient } from '../bridge-client';
import { getActivationStatus } from '@dsb/licensing';
import {
  loadBuildState,
  pauseBuild,
  saveBuildState,
} from '@dsb/core';

export function registerConnectionTools(server: McpServer, bridge: BridgeClient): void {
  // ─── Check Connection ───────────────────────────────────────────────
  server.tool(
    'dsb_check_connection',
    'Check if the Figma plugin is connected and responsive.',
    {},
    async () => {
      const status = await bridge.getStatus();

      if (!status) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              connected: false,
              error: 'Cannot reach orchestration server. Is it running? Start it with: node packages/orchestration-server/dist/index.js',
            }),
          }],
        };
      }

      const hasPlugin = status.plugins.connectedPlugins.length > 0;
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            connected: hasPlugin,
            serverRunning: true,
            queue: status.queue,
            plugins: status.plugins,
            message: hasPlugin
              ? 'Figma plugin is connected and ready.'
              : 'Orchestration server is running but no Figma plugin is connected. Open Figma and run the DSB plugin.',
          }),
        }],
      };
    }
  );

  // ─── Get License Status ─────────────────────────────────────────────
  server.tool(
    'dsb_get_license_status',
    'Check current license activation status and tier.',
    {},
    async () => {
      const status = getActivationStatus();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(status),
        }],
      };
    }
  );

  // ─── Emergency Stop ─────────────────────────────────────────────────
  server.tool(
    'dsb_emergency_stop',
    'Emergency halt: clears all pending commands AND saves a build checkpoint. ' +
    'Use when something goes wrong during a build. The build can be resumed ' +
    'later with dsb_resume_build.',
    {},
    async () => {
      // 1. Clear the command queue
      const cleared = await bridge.clearQueue();

      // 2. Save build state checkpoint (if a build is active)
      let buildSaved = false;
      let buildId: string | undefined;
      let pausedStep: string | undefined;

      const stateResult = loadBuildState();
      if (stateResult.ok && stateResult.value) {
        const state = stateResult.value;
        // Only pause if the build is actively running
        if (
          state.status === 'approved' ||
          (typeof state.status === 'string' && state.status.startsWith('building:'))
        ) {
          buildId = state.buildId;
          pausedStep = typeof state.status === 'string' && state.status.startsWith('building:')
            ? state.status.replace('building:', '')
            : undefined;

          const pauseResult = pauseBuild(state);
          if (pauseResult.ok) {
            const saveResult = saveBuildState(pauseResult.value);
            buildSaved = saveResult.ok;
          }
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            cleared,
            buildSaved,
            buildId,
            pausedStep,
            message: buildSaved
              ? `Emergency stop: cleared ${cleared} commands, build "${buildId}" paused at step "${pausedStep ?? 'unknown'}". Resume with dsb_resume_build.`
              : `Emergency stop: cleared ${cleared} pending commands. No active build to pause.`,
          }),
        }],
      };
    }
  );
}

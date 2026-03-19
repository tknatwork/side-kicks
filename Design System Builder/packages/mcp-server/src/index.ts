/**
 * @dsb/mcp-server — MCP tools server for Design System Builder.
 *
 * Claude's primary interface to the toolkit. Exposes 30+ tools
 * organized by category: connection, tokens, styles, layout,
 * queries, exports, learning, setup, config UI, build, telemetry,
 * updates, and admin.
 *
 * CLAUDE-ONLY ENFORCEMENT:
 *   DSB requires Claude Code (claude.ai/download). On initialization,
 *   the server checks the MCP client identity. Non-Claude clients get
 *   degraded responses on Pro tools (query tools still work).
 *
 * STARTUP HOOKS:
 *   1. License activation
 *   2. Update check (non-blocking)
 *   3. Admin tool registration (conditional on admin mode)
 *
 * @module mcp-server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BridgeClient } from './bridge-client';
import { generateSessionToken, activate } from '@dsb/licensing';
import { checkForUpdates, CURRENT_VERSION } from '@dsb/updater';

// ─── Existing Tool Registrations ─────────────────────────────────────────────

import { registerConnectionTools } from './tools/connection-tools';
import { registerTokenTools } from './tools/token-tools';
import { registerQueryTools } from './tools/query-tools';
import { registerStyleTools } from './tools/style-tools';
import { registerLayoutTools } from './tools/layout-tools';
import { registerExportTools } from './tools/export-tools';
import { registerLearningTools } from './tools/learning-tools';

// ─── New Tool Registrations (Config UI, Build, Setup, Telemetry, Updates) ────

import { registerSetupTools } from './tools/setup-tools';
import { registerConfigUiTools } from './tools/config-ui-tools';
import { registerBuildTools } from './tools/build-tools';
import { registerTelemetryTools } from './tools/telemetry-tools';
import { registerUpdateTools } from './tools/update-tools';
import { registerAdminTools } from './tools/admin-tools';

// ─── Merged SouthLeft Tool Registrations ────────────────────────────────────
import { registerNodeTools } from './tools/node-tools';
import { registerComponentTools } from './tools/component-tools';
import { registerExtractionTools } from './tools/extraction-tools';
import { registerDebugTools } from './tools/debug-tools';
import { registerImageTools } from './tools/image-tools';
import { registerCommentTools } from './tools/comment-tools';
import { registerAuditTools } from './tools/audit-tools';
import { registerExecuteTools } from './tools/execute-tools';
import { registerDocTools } from './tools/doc-tools';
import { FigmaRestClient } from './figma-rest';

// ─── Pipeline Tool Registrations ────────────────────────────────────────────
import { registerPipelineTools } from './tools/pipeline-tools';
import { registerFileRoleTools } from './tools/file-role-tools';
import { OpenPencilAdapter } from './pipeline/openpencil-adapter';

// ============================================================================
// SECTION 1: CLAUDE-ONLY ENFORCEMENT
// ============================================================================

/**
 * Known Claude Code client identifiers.
 * The MCP protocol's `initialize` handshake includes clientInfo.name.
 */
const CLAUDE_CLIENT_NAMES = new Set([
  'claude-code',
  'claude-desktop',
  'claude',
  'claude-ai',
]);

/**
 * Check if the MCP client is Claude Code.
 *
 * Non-Claude clients (Cursor, VS Code Copilot, Windsurf, etc.) get
 * degraded Pro tool responses. Query/export tools still work for
 * compatibility, but build, config UI, and update tools require Claude.
 *
 * @param clientName - The client name from MCP initialize handshake.
 * @returns true if the client is Claude Code.
 */
function isClaudeClient(clientName: string | undefined): boolean {
  if (!clientName) return false;
  return CLAUDE_CLIENT_NAMES.has(clientName.toLowerCase());
}

// ============================================================================
// SECTION 2: SERVER INITIALIZATION
// ============================================================================

async function main(): Promise<void> {
  // Configuration from environment
  const orchestrationPort = parseInt(process.env.DSB_ORCHESTRATION_PORT || '9877', 10);
  const licenseKey = process.env.DSB_LICENSE_KEY || '';

  // Generate session token for this MCP session
  const session = generateSessionToken();

  // Activate license (bypass mode in development)
  if (licenseKey) {
    const activationResult = await activate(licenseKey);
    if (!activationResult.ok) {
      console.error('License activation warning:', activationResult.error);
      // Continue anyway — free tier features will still work
    }
  }

  // Create bridge client for orchestration server communication
  const bridge = new BridgeClient(orchestrationPort, session.token);

  // Create MCP server
  const server = new McpServer({
    name: 'design-system-builder',
    version: CURRENT_VERSION,
  });

  // ─── Register All Tool Groups ───────────────────────────────────────

  // Core tools (existing)
  registerConnectionTools(server, bridge);
  registerTokenTools(server, bridge);
  registerQueryTools(server, bridge);
  registerStyleTools(server, bridge);
  registerLayoutTools(server, bridge);
  registerExportTools(server, bridge);
  registerLearningTools(server, bridge);

  // New tools (config UI, build pipeline, setup, telemetry, updates)
  registerSetupTools(server, bridge);
  registerConfigUiTools(server, bridge);
  registerBuildTools(server, bridge);
  registerTelemetryTools(server, bridge);
  registerUpdateTools(server, bridge);

  // Admin tools (always registered — guarded by isAdminMode() at runtime)
  registerAdminTools(server, bridge);

  // Merged SouthLeft tools (node manipulation, components, extraction, etc.)
  registerNodeTools(server, bridge);
  registerComponentTools(server, bridge);
  registerExtractionTools(server, bridge);
  registerDebugTools(server, bridge);
  registerImageTools(server, bridge);
  registerAuditTools(server, bridge);
  registerExecuteTools(server, bridge);
  registerDocTools(server, bridge);

  // Comment tools use Figma REST API directly (not plugin bridge)
  const figmaRest = new FigmaRestClient(process.env.FIGMA_ACCESS_TOKEN || '');
  registerCommentTools(server, figmaRest);

  // Pipeline tools (cross-file orchestration via OpenPencil)
  const openPencilPort = parseInt(process.env.OPENPENCIL_PORT || '3100', 10);
  const openpencilAdapter = new OpenPencilAdapter(openPencilPort);
  registerPipelineTools(server, bridge, openpencilAdapter);
  registerFileRoleTools(server, bridge);

  // ─── Start Server ───────────────────────────────────────────────────

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`DSB MCP Server v${CURRENT_VERSION} started.`);
  console.error(`Orchestration: localhost:${orchestrationPort}`);
  console.error(`Session token: ${session.token.slice(0, 8)}...`);

  // ─── Startup Hooks (Non-Blocking) ──────────────────────────────────

  // Check for updates in the background (don't block server startup)
  if (licenseKey) {
    checkForUpdates(licenseKey)
      .then((result) => {
        if (result.available && result.latestVersion) {
          console.error(`Update available: DSB v${result.latestVersion} (current: v${result.currentVersion})`);
        }
      })
      .catch(() => {
        // Update check failure is non-fatal — silently continue
      });
  }
}

// ============================================================================
// SECTION 3: ENTRY POINT
// ============================================================================

main().catch((err) => {
  console.error('Fatal error starting MCP server:', err);
  process.exit(1);
});

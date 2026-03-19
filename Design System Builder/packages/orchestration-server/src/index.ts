/**
 * @dsb/orchestration-server — HTTP + WebSocket bridge between
 * MCP server and Figma plugin.
 *
 * Can be imported as a library (createServer) or run directly (node dist/index.js).
 *
 * @module orchestration-server
 */

export { createServer } from './server';
export type { ServerConfig } from './server';
export { CommandQueue } from './command-queue';
export type { QueuedCommand, CommandResult, QueueStats } from './command-queue';
export { PluginRegistry } from './plugin-registry';
export type { PluginRegistration, RegistryStatus } from './plugin-registry';

// New route modules (re-exported for direct use if needed)
export { createConfigUiRouter } from './config-ui-routes';
export { createBuildStatusRouter } from './build-status-routes';
export { createTelemetryRouter } from './telemetry-routes';
export type { TelemetryRouterConfig } from './telemetry-routes';
export { createTamperRouter } from './tamper-routes';
export type { TamperRouterConfig } from './tamper-routes';

// ============================================================================
// CLI ENTRY POINT — run directly with: node dist/index.js
// ============================================================================

const isDirectRun = require.main === module;

if (isDirectRun) {
  const port = parseInt(process.env.DSB_ORCHESTRATION_PORT || '9877', 10);
  const sessionToken = process.env.DSB_SESSION_TOKEN || undefined;

  // Dynamic import to avoid loading server code when used as a library
  const { createServer: create } = require('./server');
  const server = create({ port, sessionToken, enableWebSocket: true });

  server.start().then(() => {
    console.log('Press Ctrl+C to stop.');
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.stop().then(() => {
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    server.stop().then(() => {
      process.exit(0);
    });
  });
}

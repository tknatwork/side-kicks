#!/usr/bin/env node
/**
 * Figma MCP Server for Portfolio Project
 *
 * This server provides tools for AI agents to interact with the Figma design system:
 * - Fetch design tokens from Figma (READ - via API)
 * - Sync tokens to the project
 * - Get component information
 * - Read design system structure
 * - Create/modify design system in Figma (WRITE - via Bridge Server + Plugin)
 *
 * Architecture:
 * - READ operations: Direct Figma API calls
 * - WRITE operations: MCP → Bridge Server (HTTP) → Plugin (WebSocket) → Figma
 *
 * Created by: Claude Opus 4.5 (Preview)
 */
export {};
//# sourceMappingURL=index.d.ts.map
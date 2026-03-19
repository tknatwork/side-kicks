/**
 * Comment Tools — MCP tools for Figma file comments (via REST API).
 * These tools use the Figma REST API directly, not the plugin bridge.
 * @module mcp-server/tools/comment-tools
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FigmaRestClient } from '../figma-rest';

export function registerCommentTools(server: McpServer, figmaRest: FigmaRestClient): void {
  server.tool(
    'dsb_get_comments',
    'Retrieve all comments on a Figma file. Requires FIGMA_ACCESS_TOKEN.',
    { fileKey: z.string().describe('Figma file key (from file URL)') },
    async ({ fileKey }) => {
      if (!figmaRest.isConfigured) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'FIGMA_ACCESS_TOKEN not configured' }) }] };
      }
      const result = await figmaRest.getComments(fileKey);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_post_comment',
    'Post a comment on a Figma file, optionally pinned to canvas coordinates.',
    {
      fileKey: z.string(),
      message: z.string(),
      x: z.number().optional().describe('Canvas X coordinate for pin'),
      y: z.number().optional().describe('Canvas Y coordinate for pin'),
    },
    async ({ fileKey, message, x, y }) => {
      if (!figmaRest.isConfigured) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'FIGMA_ACCESS_TOKEN not configured' }) }] };
      }
      const result = await figmaRest.postComment(fileKey, message, x, y);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'dsb_delete_comment',
    'Delete a comment from a Figma file by comment ID.',
    { fileKey: z.string(), commentId: z.string() },
    async ({ fileKey, commentId }) => {
      if (!figmaRest.isConfigured) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'FIGMA_ACCESS_TOKEN not configured' }) }] };
      }
      await figmaRest.deleteComment(fileKey, commentId);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true, commentId }) }] };
    }
  );
}

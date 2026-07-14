import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import type { z } from "zod";
import type { Node } from "./node.js";
import { listSkills, readSkill, getBuildRecipe } from "./skills.js";
import { runLint, type LintSnapshot } from "./lint/runner.js";
import {
  createFrameInput,
  createImageInput,
  createShapeShape,
  createTextShape,
  createShapeInput,
  createTextInput,
  setNodePropertiesInput,
  setGradientFillInput,
  setSolidFillInput,
  setEffectsShape,
  setEffectsInput,
  setStrokePropertiesInput,
  setAutoLayoutInput,
  setSelectionInput,
  scrollAndZoomIntoViewInput,
  groupNodesInput,
  ungroupNodeInput,
  setTextPropertiesShape,
  setTextPropertiesInput,
  createTextStyleInput,
  updateTextStyleShape,
  updateTextStyleInput,
  applyTextStyleShape,
  applyTextStyleInput,
  listFontsInput,
  loadFontsInput,
  executeCodeInput,
  saveCheckpointInput,
  loadCheckpointInput,
  getJournalInput,
  acquireLockInput,
  releaseLockInput,
  getFileDigestInput,
  getVariablesDeepInput,
  writeVariablesInput,
  setGridLayoutInput,
  getAnnotationsInput,
  setAnnotationShape,
  setAnnotationInput,
  getReactionsInput,
  getMotionInput,
  applyAnimationStyleShape,
  applyAnimationStyleInput,
  listShadersInput,
  applyShaderInput,
  setReactionsInput,
  setFlowStartingPointInput,
  createComponentFromNodeInput,
  combineAsVariantsInput,
  addComponentPropertyInput,
  instantiateComponentShape,
  instantiateComponentInput,
  setInstancePropertiesInput,
  swapInstanceShape,
  swapInstanceInput,
  applyStyleShape,
  applyStyleInput,
  createPaintStyleShape,
  createPaintStyleInput,
  createEffectStyleInput,
  importLibraryAssetInput,
  listLibraryVariablesInput,
  createSlotInput,
  getSlotsInput,
  resetSlotInput,
  appendToSlotInput,
  createStickyInput,
  createShapeWithTextInput,
  createConnectorInput,
  createSectionInput,
  createTableInput,
  createCodeBlockInput,
  createGifInput,
  createSlideInput,
  createSlideRowInput,
  setSlideTransitionInput,
  setSlideSkipInput,
  focusSlideInput,
  getSlideGridInput,
  setSlideGridInput,
  createBuzzFrameInput,
  setBuzzAssetTypeInput,
  getBuzzContentInput,
  setBuzzTextInput,
  buzzSmartResizeInput,
  listSkillsInput,
  readSkillInput,
  getBuildRecipeInput,
  lintDesignSystemInput,
  devResourcesShape,
  devResourcesInput,
  setCodeMappingShape,
  setCodeMappingInput,
  getCodeMappingsInput,
  toolInputSchemas,
} from "./schema.js";
import type { BridgeResponse } from "./types.js";
import { Follower } from "./follower.js";

const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 15_000;
const MAX_IMAGE_REDIRECTS = 5;

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type ExportFormat = "PNG" | "SVG" | "JPG" | "PDF";

export interface ScreenshotSender {
  sendWithParams(
    requestType: string,
    nodeIds?: string[],
    params?: Record<string, unknown>
  ): Promise<BridgeResponse>;
}

interface ScreenshotExport {
  nodeId: string;
  nodeName: string;
  format: ExportFormat;
  base64: string;
  width: number;
  height: number;
}

interface SaveScreenshotItemInput {
  nodeId: string;
  outputPath: string;
  format?: ExportFormat;
  scale?: number;
  clip?: boolean;
}

interface SaveScreenshotItemResult {
  index: number;
  nodeId: string;
  nodeName?: string;
  outputPath: string;
  format?: ExportFormat;
  width?: number;
  height?: number;
  bytesWritten?: number;
  success: boolean;
  error?: string;
}

/**
 * Registers all Figma bridge tools on the given MCP server.
 * @param server - The MCP server instance.
 * @param node - The node coordinator for leader/follower routing.
 * @param port - The port used for follower-to-leader HTTP calls.
 */
export function registerTools(
  server: McpServer,
  node: Node,
  port: number
): void {
  // Journal every op under the connecting client's identity (best-effort:
  // clientInfo is available once the MCP handshake completes).
  node.agentSupplier = () => {
    try {
      const info = server.server.getClientVersion();
      return `${info?.name ?? "client"}#${process.pid}`;
    } catch {
      return `client#${process.pid}`;
    }
  };

  server.tool(
    "list_files",
    "List all currently connected Figma files. Returns fileKey and fileName for each. Use the fileKey to target a specific file in other tools.",
    async (): Promise<ToolResult> => {
      try {
        let files = node.listConnectedFiles();
        if (files === undefined) {
          // Follower: fetch via RPC from leader
          const follower = new Follower(`http://localhost:${port}`);
          files = await follower.listConnectedFiles();
        }
        return {
          content: [{ type: "text", text: JSON.stringify(files) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : String(err),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_document",
    "Get the current Figma page document tree. When multiple files are connected, specify fileKey.",
    toolInputSchemas.get_document.shape,
    async ({ fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.send("get_document", undefined, fileKey)
      );
    }
  );

  server.tool(
    "get_selection",
    "Get the currently selected nodes in Figma. When multiple files are connected, specify fileKey.",
    toolInputSchemas.get_selection.shape,
    async ({ fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.send("get_selection", undefined, fileKey)
      );
    }
  );

  server.tool(
    "get_node",
    "Get a specific Figma node by ID. Accepts top-level IDs like '4029:12345' and instance-child IDs like 'I12740:17806;12740:17793'. Never use hyphens. When multiple files are connected, specify fileKey.",
    toolInputSchemas.get_node.shape,
    async ({ nodeId, fileKey }): Promise<ToolResult> => {
      return renderResponse(() => node.send("get_node", [nodeId], fileKey));
    }
  );

  server.tool(
    "get_styles",
    "Get all local styles in the document. When multiple files are connected, specify fileKey.",
    toolInputSchemas.get_styles.shape,
    async ({ fileKey }): Promise<ToolResult> => {
      return renderResponse(() => node.send("get_styles", undefined, fileKey));
    }
  );

  server.tool(
    "get_metadata",
    "Get metadata about the current Figma document including file name, pages, and current page info. When multiple files are connected, specify fileKey.",
    toolInputSchemas.get_metadata.shape,
    async ({ fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.send("get_metadata", undefined, fileKey)
      );
    }
  );

  server.tool(
    "get_design_context",
    "Get the design context for the current selection or page. Returns a summarized tree structure optimized for understanding the current design context. When multiple files are connected, specify fileKey.",
    toolInputSchemas.get_design_context.shape,
    async ({ depth, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = {};
      if (depth !== undefined && depth > 0) {
        params.depth = depth;
      }
      return renderResponse(() =>
        node.sendWithParams("get_design_context", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "get_variable_defs",
    "Get all local variable definitions including variable collections, modes, and variable values. Variables are Figma's system for design tokens (colors, numbers, strings, booleans). When multiple files are connected, specify fileKey.",
    toolInputSchemas.get_variable_defs.shape,
    async ({ fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.send("get_variable_defs", undefined, fileKey)
      );
    }
  );

  server.tool(
    "get_screenshot",
    "Export a screenshot of the selected nodes or specific nodes by ID. Returns base64-encoded image data. When multiple files are connected, specify fileKey.",
    toolInputSchemas.get_screenshot.shape,
    async ({ nodeIds, format, scale, clip, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = {};
      if (format) params.format = format;
      if (scale !== undefined && scale > 0) params.scale = scale;
      if (clip !== undefined) params.clip = clip;
      return renderResponse(() =>
        node.sendWithParams("get_screenshot", nodeIds, params, fileKey)
      );
    }
  );

  server.tool(
    "set_node_visibility",
    "Show or hide specific Figma nodes. Returns previous visibility for each node so you can restore them after. Useful for isolating a single layer before exporting: hide all siblings, export the frame, then restore visibility.",
    toolInputSchemas.set_node_visibility.shape,
    async ({ items, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams(
          "set_node_visibility",
          undefined,
          { items },
          fileKey
        )
      );
    }
  );

  server.tool(
    "set_text_content",
    "Update the contents of a single text node. The plugin loads the node's fonts before applying the new text. When multiple files are connected, specify fileKey.",
    toolInputSchemas.set_text_content.shape,
    async ({ nodeId, text, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("set_text_content", [nodeId], { text }, fileKey)
      );
    }
  );

  server.tool(
    "set_text_properties",
    "Patch common text properties such as font family/style, size, alignment, auto-resize, line height, letter spacing, fill color, and bounds. When multiple files are connected, specify fileKey.",
    setTextPropertiesShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(setTextPropertiesInput, args);
      if (!parsed.success) return parsed.error;
      const { nodeId, fileKey, ...properties } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams(
          "set_text_properties",
          [nodeId],
          properties,
          fileKey
        )
      );
    }
  );

  server.tool(
    "set_node_properties",
    "Patch common node properties such as name, position, size, visibility, opacity, and corner radius. Only supported properties for the target node type may be changed. Use set_solid_fill or set_gradient_fill to change paints. When multiple files are connected, specify fileKey.",
    setNodePropertiesInput.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(toolInputSchemas.set_node_properties, args);
      if (!parsed.success) return parsed.error;
      const { nodeId, fileKey, ...properties } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams(
          "set_node_properties",
          [nodeId],
          properties,
          fileKey
        )
      );
    }
  );

  server.tool(
    "set_solid_fill",
    "Replace a node's fill (or stroke) with a single solid paint. Provide a hex color and optional paint opacity. Use set_gradient_fill for gradient paints.",
    setSolidFillInput.shape,
    async ({ nodeId, fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("set_solid_fill", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "set_gradient_fill",
    "Replace a node's fill (or stroke) with a gradient paint. Provide ordered stops (position 0..1, hex color, optional alpha) and an optional 2x3 gradientTransform matching Figma's gradientTransform format. Useful for setting linear/radial/angular/diamond gradients programmatically.",
    setGradientFillInput.shape,
    async ({ nodeId, fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("set_gradient_fill", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "set_effects",
    "Replace a node's effects list (drop/inner shadows, layer/background blurs). Pass an empty array to clear all effects. Each entry mirrors the shape returned by get_node's `effects` field.",
    setEffectsShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(setEffectsInput, args);
      if (!parsed.success) return parsed.error;
      const { nodeId, fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("set_effects", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "set_stroke_properties",
    "Patch stroke geometry properties: weight, align, dash pattern, cap, join. Use set_solid_fill/set_gradient_fill with target='stroke' to set the paint itself.",
    setStrokePropertiesInput.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(
        toolInputSchemas.set_stroke_properties,
        args
      );
      if (!parsed.success) return parsed.error;
      const { nodeId, fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("set_stroke_properties", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "set_auto_layout",
    "Configure auto-layout on a frame: direction, gap, padding, alignment, sizing modes, wrap. Set layoutMode='NONE' to disable auto-layout on the frame.",
    setAutoLayoutInput.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(toolInputSchemas.set_auto_layout, args);
      if (!parsed.success) return parsed.error;
      const { nodeId, fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("set_auto_layout", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "create_frame",
    "Create a new frame, optionally inside a specified parent. You can set name, size, position, and a solid fill. When multiple files are connected, specify fileKey.",
    createFrameInput.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(toolInputSchemas.create_frame, args);
      if (!parsed.success) return parsed.error;
      const { fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("create_frame", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_text",
    "Create a new text node, optionally inside a specified parent. You can set its content, font, size, alignment, color, position, and bounds. When multiple files are connected, specify fileKey.",
    createTextShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(createTextInput, args);
      if (!parsed.success) return parsed.error;
      const { fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("create_text", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_shape",
    "Create a rectangle, ellipse, or line, optionally inside a specified parent. You can set its size, position, rotation, fill, and stroke. When multiple files are connected, specify fileKey.",
    createShapeShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(createShapeInput, args);
      if (!parsed.success) return parsed.error;
      const { fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("create_shape", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_image",
    "Create an image-backed rectangle from a local file path, remote URL, or data URI. You can set its parent, position, size, corner radius, and fit mode. When multiple files are connected, specify fileKey.",
    createImageInput.shape,
    async ({ source, fileKey, ...params }): Promise<ToolResult> => {
      try {
        const imageBase64 = await loadImageSourceAsBase64(
          source,
          process.cwd()
        );
        return await renderResponse(() =>
          node.sendWithParams(
            "create_image",
            undefined,
            { ...params, imageBase64 },
            fileKey
          )
        );
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : String(err),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "duplicate_nodes",
    "Duplicate one or more nodes in place. The duplicates remain under the same parent as the originals. When multiple files are connected, specify fileKey.",
    toolInputSchemas.duplicate_nodes.shape,
    async ({ nodeIds, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("duplicate_nodes", nodeIds, undefined, fileKey)
      );
    }
  );

  server.tool(
    "reparent_nodes",
    "Move one or more nodes into a different parent container. When multiple files are connected, specify fileKey.",
    toolInputSchemas.reparent_nodes.shape,
    async ({ nodeIds, parentId, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("reparent_nodes", nodeIds, { parentId }, fileKey)
      );
    }
  );

  server.tool(
    "group_nodes",
    "Wrap a list of nodes in a new group. Nodes must share a common parent (or supply parentId explicitly). Returns the new group's node ID.",
    groupNodesInput.shape,
    async ({ nodeIds, fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("group_nodes", nodeIds, params, fileKey)
      );
    }
  );

  server.tool(
    "ungroup_node",
    "Ungroup a group or frame — its children move up to its parent and the wrapper is removed. Returns the IDs of the orphaned children in their new parent.",
    ungroupNodeInput.shape,
    async ({ nodeId, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("ungroup_node", [nodeId], undefined, fileKey)
      );
    }
  );

  server.tool(
    "set_selection",
    "Set the current page selection to a list of node IDs. Pass an empty array to clear the selection. Works in both design editor and Dev Mode.",
    setSelectionInput.shape,
    async ({ nodeIds, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("set_selection", nodeIds, undefined, fileKey)
      );
    }
  );

  server.tool(
    "scroll_and_zoom_into_view",
    "Scroll and zoom the Figma viewport so the given nodes are framed in view. Works in both design editor and Dev Mode.",
    scrollAndZoomIntoViewInput.shape,
    async ({ nodeIds, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams(
          "scroll_and_zoom_into_view",
          nodeIds,
          undefined,
          fileKey
        )
      );
    }
  );

  server.tool(
    "delete_nodes",
    "Delete one or more nodes. This is destructive and requires confirm: true. Page and document nodes cannot be deleted through this tool. When multiple files are connected, specify fileKey.",
    toolInputSchemas.delete_nodes.shape,
    async ({ nodeIds, confirm, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("delete_nodes", nodeIds, { confirm }, fileKey)
      );
    }
  );

  server.tool(
    "list_fonts",
    "List fonts available to Figma Desktop, INCLUDING locally-installed licensed fonts the Figma REST API and remote MCP cannot see. Returns families grouped with their exact style strings — always discover exact {family, style} strings here before loading fonts or creating text styles (style names like 'Semibold' vs 'Semi Bold' vary per font and must never be guessed). Unfiltered calls return family names only when more than 200 families match.",
    listFontsInput.shape,
    async ({ filter, families, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = {};
      if (filter) params.filter = filter;
      if (families && families.length > 0) params.families = families;
      return renderResponse(() =>
        node.sendWithParams("list_fonts", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "load_fonts",
    "Load exact {family, style} font pairs into the Figma session and report per-font success. Works for locally-installed fonts because the plugin runs inside Figma Desktop. Use before text mutations, or as an availability check after discovering exact strings via list_fonts.",
    loadFontsInput.shape,
    async ({ fonts, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("load_fonts", undefined, { fonts }, fileKey)
      );
    }
  );

  server.tool(
    "get_text_styles",
    "Get all local text styles with full fidelity: id, name, description, fontName, fontSize, lineHeight, letterSpacing, paragraphSpacing, paragraphIndent, textCase, textDecoration, and variable bindings. Style names are not unique — target styles by id when possible.",
    toolInputSchemas.get_text_styles.shape,
    async ({ fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.send("get_text_styles", undefined, fileKey)
      );
    }
  );

  server.tool(
    "create_text_style",
    "Create a local text style. Requires exact fontFamily/fontStyle strings (discover via list_fonts); the font is loaded before the style is configured. lineHeight must be {unit:'AUTO'} or {unit:'PIXELS'|'PERCENT', value} — bare numbers are rejected. Set skipIfExists to make repeated runs idempotent by name.",
    createTextStyleInput.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(toolInputSchemas.create_text_style, args);
      if (!parsed.success) return parsed.error;
      const { fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("create_text_style", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "update_text_style",
    "Update an existing local text style in place (target by styleId or exact styleName). Changing fontFamily/fontStyle automatically loads the new font first, and every node bound to the style updates — this is the lever for swapping a placeholder font (e.g. Inter) to a real face across a design system in one call per style. Property patches apply before a font swap; if a later step fails, the error message lists the changes that were already applied (they are not rolled back).",
    updateTextStyleShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(updateTextStyleInput, args);
      if (!parsed.success) return parsed.error;
      const { fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("update_text_style", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "apply_text_style",
    "Apply a local text style (by styleId or exact styleName) to one or more text nodes via setTextStyleIdAsync. The style's font and each node's current fonts are loaded automatically before applying. Returns per-node results.",
    applyTextStyleShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(applyTextStyleInput, args);
      if (!parsed.success) return parsed.error;
      const { nodeIds, fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("apply_text_style", nodeIds, params, fileKey)
      );
    }
  );

  server.tool(
    "get_effect_styles",
    "Get all local effect styles (shadows/blurs) with id, name, description, full effects list, and variable bindings. Use to verify elevation styles.",
    toolInputSchemas.get_effect_styles.shape,
    async ({ fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.send("get_effect_styles", undefined, fileKey)
      );
    }
  );

  server.tool(
    "execute_code",
    "Escape hatch: run JavaScript against the Figma Plugin API inside the plugin sandbox (`figma` is in scope, top-level await supported). The return value is the ONLY output channel and must be JSON-serializable plain data — never return nodes. Use ES2017 syntax (no optional chaining/spread in the sandbox). Load fonts (load_fonts or figma.loadFontAsync) before any text mutation. Mutations fail in Dev Mode. Scripts have a ~30s budget and a timeout error does NOT mean the script did not run — verify with a read before retrying, and chunk long mutations into small idempotent steps. Prefer the dedicated tools when one exists.",
    executeCodeInput.shape,
    async ({ code, timeoutMs, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("execute_code", undefined, { code }, fileKey, {
          timeoutMs,
        })
      );
    }
  );

  server.tool(
    "get_file_digest",
    "Token-lean orientation map of the file: pages, components/sets, style + variable-collection inventory, current selection. Served INSTANTLY from cache when nothing changed since the last call (document-change events invalidate it) — call this first in any session instead of get_document. Use scope 'all-pages' for a full component inventory.",
    getFileDigestInput.shape,
    async ({ scope, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = {};
      if (scope) params.scope = scope;
      return renderResponse(() =>
        node.sendWithParams("get_file_digest", undefined, params, fileKey, {
          timeoutMs: 120_000,
        })
      );
    }
  );

  server.tool(
    "get_workspace_status",
    "One-call orientation for a newly attached agent: server version/uptime, connected files with change activity and digest freshness, active locks with holders, checkpoint inventory, and the journal's latest sequence number. Call this before starting work in an unfamiliar or resumed session.",
    toolInputSchemas.get_workspace_status.shape,
    async (): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("get_workspace_status", undefined, undefined)
      );
    }
  );

  server.tool(
    "list_skills",
    "List the bundled offline design-system skills — token architecture, scopes, theming, components, code-output, accessibility — plus the canonical build order and the 57-rule lint catalog. Read one with read_skill. Call this BEFORE building a design system so you follow the flawless structure instead of trial-and-error. Local, no network.",
    listSkillsInput.shape,
    async ({ query }): Promise<ToolResult> => renderLocal(() => listSkills(query))
  );

  server.tool(
    "read_skill",
    "Return the full Markdown of one bundled design-system skill (slug from list_skills). Slugs include the six skills plus 'canonical-structure' (the build order) and 'lint-rules' (the rule catalog). Local, offline.",
    readSkillInput.shape,
    async ({ slug }): Promise<ToolResult> => renderLocal(() => readSkill(slug))
  );

  server.tool(
    "get_build_recipe",
    "Return the canonical design-system build order (Primitive -> Semantic -> Component, lint-gated) plus the lint rule_ids to run after a given step. Follow it top-to-bottom: build a tier, lint it, fix, descend. Default step 'all' returns the whole build order. Local, offline.",
    getBuildRecipeInput.shape,
    async ({ step }): Promise<ToolResult> => renderLocal(() => getBuildRecipe(step))
  );

  server.tool(
    "lint_design_system",
    "Structure-lint the design system in the current file against the 57-rule canonical catalog. Gathers the variable graph, styles, and components (loads all pages) and reports structural defects — color token on ALL_SCOPES, node bound to a primitive, dangling alias, missing codeSyntax, low-contrast token pairs, etc. — each with a fix hint linked to the skill that explains it. Run after every build step: build -> lint -> fix. Detectors roll out tier-by-tier; not-yet-implemented rules are listed under not_yet_implemented.",
    lintDesignSystemInput.shape,
    async ({ only, categories, severity, fileKey }): Promise<ToolResult> =>
      renderLocal(async () => {
        const resp = await node.sendWithParams(
          "lint_run",
          undefined,
          undefined,
          fileKey,
          { timeoutMs: 120_000 }
        );
        if (resp.error) throw new Error(resp.error);
        return runLint(resp.data as LintSnapshot, { only, categories, severity });
      })
  );

  server.tool(
    "save_checkpoint",
    "Persist a named JSON resume-ledger (≤256KB) on disk, keyed per file. Survives server restarts, session compaction, and context loss — write completed steps, discovered node/style-id maps, and the next action after each milestone so ANY future session can continue exactly where this one stopped. Overwrites the same name.",
    saveCheckpointInput.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(toolInputSchemas.save_checkpoint, args);
      if (!parsed.success) return parsed.error;
      const { name, data, agent, fileKey } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams(
          "save_checkpoint",
          undefined,
          { name, data, ...(agent ? { agent } : {}) },
          fileKey,
          agent ? { agent } : undefined
        )
      );
    }
  );

  server.tool(
    "load_checkpoint",
    "Load a named checkpoint (resume ledger), or omit name to LIST all checkpoints for the file with their agents and timestamps. The first call of a resumed session: load_checkpoint + get_journal reconstruct what was already done.",
    loadCheckpointInput.shape,
    async ({ name, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams(
          "load_checkpoint",
          undefined,
          name ? { name } : {},
          fileKey
        )
      );
    }
  );

  server.tool(
    "get_journal",
    "Read the persistent operation journal: every mutation (and execute_code) that went through this server, with agent identity, tool, targets, outcome, and duration. Filter by tool or agent. Use after a crash/timeout or when resuming to see exactly what already happened — do not re-apply mutations blindly.",
    getJournalInput.shape,
    async ({ limit, tool, agent, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = {};
      if (limit) params.limit = limit;
      if (tool) params.tool = tool;
      if (agent) params.agent = agent;
      return renderResponse(() =>
        node.sendWithParams("get_journal", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "acquire_lock",
    "Acquire (or renew) a named TTL lock so parallel agents don't clobber each other's targets. Non-blocking: returns acquired:false with the current holder if taken. Convention: lock the resource you mutate ('styles:text', 'page:<pageId>'). Locks auto-expire (default 120s) so a dead agent never wedges the workspace.",
    acquireLockInput.shape,
    async ({ name, agent, ttlSeconds }): Promise<ToolResult> => {
      const params: Record<string, unknown> = { name };
      if (agent) params.agent = agent;
      if (ttlSeconds) params.ttlSeconds = ttlSeconds;
      return renderResponse(() =>
        node.sendWithParams(
          "acquire_lock",
          undefined,
          params,
          undefined,
          agent ? { agent } : undefined
        )
      );
    }
  );

  server.tool(
    "release_lock",
    "Release a named lock you hold. Pass force:true only to break a lock whose holder is known-dead.",
    releaseLockInput.shape,
    async ({ name, agent, force }): Promise<ToolResult> => {
      const params: Record<string, unknown> = { name };
      if (agent) params.agent = agent;
      if (force !== undefined) params.force = force;
      return renderResponse(() =>
        node.sendWithParams(
          "release_lock",
          undefined,
          params,
          undefined,
          agent ? { agent } : undefined
        )
      );
    }
  );

  server.tool(
    "get_variables_deep",
    "Full unthrottled variable dump the official MCP cannot produce: every local collection with ALL modes and per-mode values (not just defaults), scopes, descriptions, code syntax, and aliases resolved to {id, name, collection}. Filter to one collection by id or name. This is the ground truth for design-token work.",
    getVariablesDeepInput.shape,
    async ({ collectionId, collectionName, resolveAliases, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = {};
      if (collectionId) params.collectionId = collectionId;
      if (collectionName) params.collectionName = collectionName;
      if (resolveAliases !== undefined) params.resolveAliases = resolveAliases;
      return renderResponse(() =>
        node.sendWithParams("get_variables_deep", undefined, params, fileKey, {
          timeoutMs: 120_000,
        })
      );
    }
  );

  server.tool(
    "write_variables",
    "Author design tokens — the official MCP has NO variable-write surface. Sequential action batch: create_collection, rename_collection, delete_collection, add_mode, rename_mode, remove_mode, create_variable (with scopes/description/valuesByMode), rename_variable, update_variable (scopes/description/hiddenFromPublishing/codeSyntax), set_value, set_alias, bind_to_node (node fields or solid-paint colors), delete_variable. Later actions reference earlier results via '$N.<field>' (e.g. collectionId: '$0.collectionId'), so one call builds a whole collection. Stops at the first error by default and reports per-action outcomes.",
    writeVariablesInput.shape,
    async ({ actions, stopOnError, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = { actions };
      if (stopOnError !== undefined) params.stopOnError = stopOnError;
      return renderResponse(() =>
        node.sendWithParams("write_variables", undefined, params, fileKey, {
          timeoutMs: 120_000,
        })
      );
    }
  );

  server.tool(
    "set_grid_layout",
    "Configure Figma's GRID auto-layout (Config 2025) on a frame: row/column counts and gaps, auto-tracks, item positioning mode, and explicit child placements at grid cells. The official MCP has no grid-authoring tool.",
    setGridLayoutInput.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(toolInputSchemas.set_grid_layout, args);
      if (!parsed.success) return parsed.error;
      const { nodeId, fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("set_grid_layout", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "get_annotations",
    "Read Dev-Mode annotations on nodes plus the file's annotation categories. Annotations carry design intent (measurements, notes, categories) that never surfaces through the official MCP.",
    getAnnotationsInput.shape,
    async ({ nodeIds, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("get_annotations", nodeIds, undefined, fileKey)
      );
    }
  );

  server.tool(
    "set_annotation",
    "Add an annotation (label/labelMarkdown/categoryId) to a node, or clear:true to remove all its annotations. Use to leave durable design-intent notes other agents and Dev Mode users will see.",
    setAnnotationShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(setAnnotationInput, args);
      if (!parsed.success) return parsed.error;
      const { nodeId, fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("set_annotation", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "get_reactions",
    "Read prototype reactions (triggers + actions/transitions) from nodes — the interaction graph the official MCP does not expose.",
    getReactionsInput.shape,
    async ({ nodeIds, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("get_reactions", nodeIds, undefined, fileKey)
      );
    }
  );

  server.tool(
    "get_motion",
    "Read Figma Motion (Config 2026 beta): available animation styles (incl. spring/bezier easings — easing variables surface here), plus per-node applied styles, manual keyframe tracks, and timelines. Errors clearly if the running Figma predates the Motion beta. Official MCP has motion READS only via rate-limited get_motion_context; this is local and unthrottled.",
    getMotionInput.shape,
    async ({ nodeIds, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("get_motion", nodeIds, undefined, fileKey)
      );
    }
  );

  server.tool(
    "apply_animation_style",
    "WRITE Figma Motion animations — the official MCP cannot: apply an animation style to a node (optional duration/timelineOffset overrides; returns the applied instance id), or remove one (remove:true + appliedStyleInstanceId). Discover style ids via get_motion. Beta API — errors clearly on older Figma versions.",
    applyAnimationStyleShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(applyAnimationStyleInput, args);
      if (!parsed.success) return parsed.error;
      const { nodeId, fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("apply_animation_style", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "list_shaders",
    "List WebGPU shaders (Config 2026 beta) available to this file — file, library, and user-owned — with property definitions. imported:false shaders must be imported before applying (apply_shader does this automatically). Requires the Shaders beta (paid plans); errors clearly otherwise.",
    listShadersInput.shape,
    async ({ fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("list_shaders", undefined, undefined, fileKey)
      );
    }
  );

  server.tool(
    "apply_shader",
    "Apply a WebGPU shader as a node's fill, stroke, or effect (imports it first — mirrors font loading), with optional property assignments keyed by property-definition id. Target must match the shader's declared type ('fill' shaders → fill/stroke; 'effect' shaders → effect; omit target to auto-route). Fill/stroke application REPLACES the node's existing paints; effect application appends. The official MCP can only READ shaders; applying is plugin-only. Beta API — errors clearly on unsupported plans/versions.",
    applyShaderInput.shape,
    async ({ nodeId, shaderId, target, properties, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = { shaderId };
      if (target) params.target = target;
      if (properties) params.properties = properties;
      return renderResponse(() =>
        node.sendWithParams("apply_shader", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "set_reactions",
    "Author prototype interactions — replace a node's Reaction[] (triggers + actions/transitions). The official MCP cannot wire prototypes. SMART_ANIMATE transitions match layers BY NAME across screens, so name layers consistently. Pass [] to clear. Wire flows with set_flow_starting_point.",
    setReactionsInput.shape,
    async ({ nodeId, reactions, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("set_reactions", [nodeId], { reactions }, fileKey)
      );
    }
  );

  server.tool(
    "set_flow_starting_point",
    "Declare (or remove) a prototype flow starting point on a top-level frame — what the Play button presents. Completes prototype wiring after set_reactions.",
    setFlowStartingPointInput.shape,
    async ({ nodeId, name, remove, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = {};
      if (name) params.name = name;
      if (remove !== undefined) params.remove = remove;
      return renderResponse(() =>
        node.sendWithParams("set_flow_starting_point", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "create_component_from_node",
    "Convert an existing frame into a master COMPONENT in place (preserves children/auto-layout). Returns the component id + publishable key. Build order for a full set: create/refine frames → name each 'Prop=Value' → create_component_from_node each → combine_as_variants → add_component_property.",
    createComponentFromNodeInput.shape,
    async ({ nodeId, name, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = {};
      if (name) params.name = name;
      return renderResponse(() =>
        node.sendWithParams("create_component_from_node", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "combine_as_variants",
    "Merge COMPONENT nodes into one variant set. Components MUST be named 'Prop=Value' (e.g. 'State=Default', 'State=Hover') before combining — the names become the variant properties. Variants are auto-arranged vertically (they otherwise stack at 0,0); pass arrange:false to skip.",
    combineAsVariantsInput.shape,
    async ({ nodeIds, parentId, name, arrange, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = {};
      if (parentId) params.parentId = parentId;
      if (name) params.name = name;
      if (arrange !== undefined) params.arrange = arrange;
      return renderResponse(() =>
        node.sendWithParams("combine_as_variants", nodeIds, params, fileKey)
      );
    }
  );

  server.tool(
    "add_component_property",
    "Add a TEXT / BOOLEAN / INSTANCE_SWAP / SLOT property to a component or set. Returns the property key WITH its '#' suffix — instances must use that exact key in setProperties. Use INSTANCE_SWAP (with preferredValues) for icon slots instead of a variant per icon; SLOT properties take slotSettings.",
    addComponentPropertyInput.shape,
    async ({ nodeId, fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("add_component_property", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "instantiate_component",
    "One-call screen assembly: import a component (by published key) or use a local one (by id; sets use their default variant), create an instance, append it to a parent, position it, set properties (exact '#'-suffixed keys — errors list what's available), and override text children by name (fonts auto-load). Rolls back the instance on failure.",
    instantiateComponentShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(instantiateComponentInput, args);
      if (!parsed.success) return parsed.error;
      const { fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("instantiate_component", undefined, params, fileKey, {
          timeoutMs: 60_000,
        })
      );
    }
  );

  server.tool(
    "set_instance_properties",
    "Set component properties on an existing INSTANCE (variant values by plain name, TEXT/BOOLEAN/INSTANCE_SWAP by '#'-suffixed key). Errors list the available keys. Slot properties cannot be set this way — append children into the slot instead.",
    setInstancePropertiesInput.shape,
    async ({ nodeId, properties, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("set_instance_properties", [nodeId], { properties }, fileKey)
      );
    }
  );

  server.tool(
    "swap_instance",
    "Swap an INSTANCE to a different component (local id or published key), preserving compatible overrides — the mechanism behind INSTANCE_SWAP-style icon systems.",
    swapInstanceShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(swapInstanceInput, args);
      if (!parsed.success) return parsed.error;
      const { nodeId, fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("swap_instance", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "apply_style",
    "Apply a local fill / stroke / effect / grid style to a node by styleId or exact name (structured styling — prefer styles over raw values, variables over styles where bound). Text styles: apply_text_style.",
    applyStyleShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(applyStyleInput, args);
      if (!parsed.success) return parsed.error;
      const { nodeId, fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("apply_style", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "create_paint_style",
    "Create a local paint style (solid hex or gradient) with optional description. skipIfExists makes reruns idempotent by name.",
    createPaintStyleShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(createPaintStyleInput, args);
      if (!parsed.success) return parsed.error;
      const { fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("create_paint_style", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_effect_style",
    "Create a local effect style with a FULL effects list (multi-shadow elevation styles supported — same effect shape as set_effects). skipIfExists for idempotent reruns.",
    createEffectStyleInput.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(toolInputSchemas.create_effect_style, args);
      if (!parsed.success) return parsed.error;
      const { fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("create_effect_style", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "import_library_asset",
    "Materialize a PUBLISHED library asset into this file by key: component, component_set, style, or variable — the plugin-API library access that needs no Enterprise REST API. Keys come from list_library_variables, published-component metadata, or teammates.",
    importLibraryAssetInput.shape,
    async ({ kind, key, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("import_library_asset", undefined, { kind, key }, fileKey)
      );
    }
  );

  server.tool(
    "list_library_variables",
    "Enumerate variable collections from enabled team libraries (omit collectionKey), or list a collection's variables with their import keys — then import_library_asset kind:'variable' to use them. Library token access without the Enterprise REST API.",
    listLibraryVariablesInput.shape,
    async ({ collectionKey, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = {};
      if (collectionKey) params.collectionKey = collectionKey;
      return renderResponse(() =>
        node.sendWithParams("list_library_variables", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_slot",
    "Add a slot frame to a COMPONENT (Slots, GA June 2026): a flexible area where instance users freely add content without detaching. The SLOT component property is created AUTOMATICALLY — the response returns its key; do not add another via add_component_property. Note: slot frames reject GRID layout; instances fill slots by appending children, not setProperties.",
    createSlotInput.shape,
    async ({ nodeId, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("create_slot", [nodeId], undefined, fileKey)
      );
    }
  );

  server.tool(
    "get_slots",
    "List the SLOT frames within a node (Slots, GA June 2026). Returns each slot's id, name, child count, and limitViolations, plus — when the node is a COMPONENT/COMPONENT_SET — its SLOT component-property definitions (key, description, slotSettings). Read-only.",
    getSlotsInput.shape,
    async ({ nodeId, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("get_slots", [nodeId], undefined, fileKey)
      );
    }
  );

  server.tool(
    "reset_slot",
    "Reset a SLOT node to its empty/default state, clearing content added into it. nodeId must be a SLOT (discover via get_slots).",
    resetSlotInput.shape,
    async ({ nodeId, fileKey }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("reset_slot", [nodeId], undefined, fileKey)
      );
    }
  );

  server.tool(
    "append_to_slot",
    "Move a scene node into a SLOT frame to populate it, on a COMPONENT definition. Note: Figma blocks appending into a slot that lives inside an INSTANCE (a platform limit) — populate the master component instead. Returns the slot's limitViolations after insertion.",
    appendToSlotInput.shape,
    async ({ slotId, nodeId, index, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = { slotId, nodeId };
      if (index !== undefined) params.index = index;
      return renderResponse(() =>
        node.sendWithParams("append_to_slot", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_sticky",
    "FigJam: create a sticky note with optional text, background color, and wide shape. Runs only in a FigJam file.",
    createStickyInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("create_sticky", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_shape_with_text",
    "FigJam: create a flowchart/diagram shape (square, diamond, ellipse, arrows, ENG_* shapes, …) with optional text, fill, and size. FigJam only.",
    createShapeWithTextInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("create_shape_with_text", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_connector",
    "FigJam: draw a connector between two nodes (magnet-attached via startNodeId/endNodeId) or between free points, with an optional label, line type, and stroke caps. FigJam only.",
    createConnectorInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("create_connector", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_section",
    "FigJam: create a titled section to group board content, with optional name and size. FigJam only.",
    createSectionInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("create_section", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_table",
    "FigJam: create a table with the given rows/columns, optionally pre-filling cell text (row-major). FigJam only.",
    createTableInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("create_table", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_code_block",
    "FigJam: create a syntax-highlighted code block with the given code and language. FigJam only.",
    createCodeBlockInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("create_code_block", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_gif",
    "FigJam: place a GIF by its existing media hash. Note: local-only — importing new GIFs from URLs is not supported. FigJam only.",
    createGifInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("create_gif", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_slide",
    "Figma Slides: create a new 1920×1080 slide (optionally at a grid row/col) with an optional background color. Slides only.",
    createSlideInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("create_slide", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_slide_row",
    "Figma Slides: create a new slide row (optionally at an index). Slides only.",
    createSlideRowInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("create_slide_row", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "set_slide_transition",
    "Figma Slides: set a slide's transition — style, duration, easing curve, and on-click/after-delay timing. Only the fields you pass change. Slides only.",
    setSlideTransitionInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("set_slide_transition", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "set_slide_skip",
    "Figma Slides: skip or unskip a slide during presentation. Slides only.",
    setSlideSkipInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("set_slide_skip", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "focus_slide",
    "Figma Slides: focus a slide in the editor (sets currentPage.focusedSlide). Slides only.",
    focusSlideInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("focus_slide", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "get_slide_grid",
    "Figma Slides: read the slide grid as a 2D array of slide ids/names (row-major presentation order). Read-only. Slides only.",
    getSlideGridInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("get_slide_grid", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "set_slide_grid",
    "Figma Slides: reorder the deck by passing the full 2D grid of slide ids in the desired order. Must include EVERY current slide (get_slide_grid first). Slides only.",
    setSlideGridInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("set_slide_grid", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "create_buzz_frame",
    "Figma Buzz: create a marketing-asset frame on the canvas grid, optionally setting its platform asset type (LINKEDIN_POST, INSTA_STORY, …) and background. Buzz only.",
    createBuzzFrameInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("create_buzz_frame", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "set_buzz_asset_type",
    "Figma Buzz: set a node's platform asset type/size (drives Buzz's per-platform dimensions). Buzz only.",
    setBuzzAssetTypeInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("set_buzz_asset_type", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "get_buzz_content",
    "Figma Buzz: read a Buzz asset's dynamic text and media fields (index, value/type/hash, backing node id) plus its asset type. Read-only. Buzz only.",
    getBuzzContentInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("get_buzz_content", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "set_buzz_text",
    "Figma Buzz: fill an asset's text fields from an array applied positionally (values[i] -> field i) — the core data-driven, bulk-content workflow. Read fields first with get_buzz_content. Buzz only.",
    setBuzzTextInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("set_buzz_text", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "buzz_smart_resize",
    "Figma Buzz: intelligently resize a node to target dimensions while preserving layout/aspect (for reflowing an asset across platform sizes). Buzz only.",
    buzzSmartResizeInput.shape,
    async ({ fileKey, ...params }): Promise<ToolResult> => {
      return renderResponse(() =>
        node.sendWithParams("buzz_smart_resize", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "dev_resources",
    "Read/add/edit/delete dev resources (links to tickets, docs, storybook) attached to nodes — the Dev-Mode handoff surface, editable here without a Dev seat's UI.",
    devResourcesShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(devResourcesInput, args);
      if (!parsed.success) return parsed.error;
      const { nodeId, fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("dev_resources", [nodeId], params, fileKey)
      );
    }
  );

  server.tool(
    "set_code_mapping",
    "Local Code-Connect equivalent (Figma gates Code Connect to Org/Enterprise): durably map a component/node to its source code (path + snippet + language), stored server-side per file. Any agent then resolves design→code via get_code_mappings. Independent tooling — does not touch Figma's Code Connect service.",
    setCodeMappingShape.shape,
    async (args): Promise<ToolResult> => {
      const parsed = parseToolInput(setCodeMappingInput, args);
      if (!parsed.success) return parsed.error;
      const { fileKey, ...params } = parsed.data;
      return renderResponse(() =>
        node.sendWithParams("set_code_mapping", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "get_code_mappings",
    "Resolve design→code mappings saved with set_code_mapping — all mappings for the file, or specific targets (nodeIds / component keys / names). Use when implementing designs as code: check for an existing mapping before writing new markup.",
    getCodeMappingsInput.shape,
    async ({ targets, fileKey }): Promise<ToolResult> => {
      const params: Record<string, unknown> = {};
      if (targets && targets.length > 0) params.targets = targets;
      return renderResponse(() =>
        node.sendWithParams("get_code_mappings", undefined, params, fileKey)
      );
    }
  );

  server.tool(
    "save_screenshots",
    "Export screenshots for multiple nodes and save them directly to the local filesystem. Returns metadata only (no base64). When multiple files are connected, specify fileKey.",
    toolInputSchemas.save_screenshots.shape,
    async ({ items, format, scale, clip, fileKey }): Promise<ToolResult> => {
      try {
        // Create a sender bound to the specific fileKey
        const sender: ScreenshotSender = {
          sendWithParams: (requestType, nodeIds, params) =>
            node.sendWithParams(requestType, nodeIds, params, fileKey),
        };
        const result = await executeSaveScreenshots(
          sender,
          items,
          format,
          scale,
          clip
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : String(err),
            },
          ],
          isError: true,
        };
      }
    }
  );
}

/**
 * Saves screenshots for multiple nodes to the local filesystem in batch.
 * @param sender - Sender that forwards get_screenshot requests to the plugin.
 * @param items - Screenshot save operations to execute.
 * @param format - Default export format override.
 * @param scale - Default export scale override for raster formats.
 * @param clip - Default clipping override for saved screenshots.
 * @returns Aggregate result with per-item outcomes.
 */
export async function executeSaveScreenshots(
  sender: ScreenshotSender,
  items: SaveScreenshotItemInput[],
  format?: ExportFormat,
  scale?: number,
  clip?: boolean
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  hasErrors: boolean;
  results: SaveScreenshotItemResult[];
}> {
  const results: SaveScreenshotItemResult[] = [];

  for (const [index, item] of items.entries()) {
    const result = await saveScreenshotItemToFile(
      sender,
      item,
      index,
      process.cwd(),
      format,
      scale,
      clip
    );
    results.push(result);
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.length - succeeded;

  return {
    total: results.length,
    succeeded,
    failed,
    hasErrors: failed > 0,
    results,
  };
}

/**
 * Wraps a bridge call and converts the result into a tool result.
 * @param fn - Bridge call to execute.
 * @returns Tool result with the bridge response or an error message.
 */
async function renderResponse(
  fn: () => Promise<BridgeResponse>
): Promise<ToolResult> {
  try {
    const resp = await fn();
    if (resp.error) {
      return {
        content: [{ type: "text", text: resp.error }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(resp.data) }],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: err instanceof Error ? err.message : String(err),
        },
      ],
      isError: true,
    };
  }
}

/** Wrap a purely-local (no-plugin, no shared-state) producer into a ToolResult. */
async function renderLocal(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await fn()) }] };
  } catch (err) {
    return {
      content: [
        { type: "text", text: err instanceof Error ? err.message : String(err) },
      ],
      isError: true,
    };
  }
}

/**
 * Parses raw tool arguments with a Zod schema and returns a typed result or a tool error.
 * @param schema - Zod schema to validate against.
 * @param args - Raw arguments from the MCP client.
 * @returns Parsed data on success, or an error tool result on failure.
 */
function parseToolInput<T>(
  schema: z.ZodType<T>,
  args: unknown
): { success: true; data: T } | { success: false; error: ToolResult } {
  const result = schema.safeParse(args);
  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: {
      content: [{ type: "text", text: result.error.issues[0].message }],
      isError: true,
    },
  };
}

/**
 * Resolves an output path relative to the workspace and ensures it stays inside it.
 * @param outputPath - Relative or absolute output path.
 * @param workspaceRoot - Root directory that must contain the resolved path.
 * @returns Absolute path inside the workspace root.
 */
function resolveAndValidateOutputPath(
  outputPath: string,
  workspaceRoot: string
): string {
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedPath = path.resolve(resolvedRoot, outputPath);
  const relativePath = path.relative(resolvedRoot, resolvedPath);
  const escapesRoot =
    relativePath.startsWith("..") || path.isAbsolute(relativePath);
  if (escapesRoot) {
    throw new Error(
      `outputPath must be inside the MCP server working directory: ${resolvedRoot}`
    );
  }
  return resolvedPath;
}

/**
 * Loads an image source as a base64 string from a URL, data URI, or local file.
 * @param source - Image source: URL, data URI, or local file path.
 * @param workspaceRoot - Root directory for resolving relative local paths.
 * @returns Base64-encoded image bytes.
 */
async function loadImageSourceAsBase64(
  source: string,
  workspaceRoot: string
): Promise<string> {
  if (/^https?:\/\//i.test(source)) {
    const bytes = await fetchImageBytes(source);
    return bytes.toString("base64");
  }

  const dataUrlMatch = source.match(/^data:.*?;base64,(.+)$/);
  if (dataUrlMatch) {
    return dataUrlMatch[1];
  }

  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedPath = path.resolve(resolvedRoot, source);
  const relativePath = path.relative(resolvedRoot, resolvedPath);
  const escapesRoot =
    relativePath.startsWith("..") || path.isAbsolute(relativePath);
  if (escapesRoot) {
    throw new Error(
      `image source must be inside the MCP server working directory: ${resolvedRoot}`
    );
  }
  const bytes = await readFile(resolvedPath);
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error(`Image exceeds ${MAX_IMAGE_BYTES} bytes`);
  }
  return bytes.toString("base64");
}

/**
 * Fetches image bytes from a remote URL with redirect and timeout limits.
 * @param source - HTTP or HTTPS image URL.
 * @returns Raw image bytes.
 */
async function fetchImageBytes(source: string): Promise<Buffer> {
  let url = new URL(source);
  let redirects = 0;

  while (true) {
    await assertSafeHttpUrl(url);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      IMAGE_FETCH_TIMEOUT_MS
    );
    let resp: Response;
    try {
      resp = await fetch(url, {
        signal: controller.signal,
        redirect: "manual",
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(
          `Timed out fetching image after ${IMAGE_FETCH_TIMEOUT_MS}ms`
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("location");
      if (!location) {
        throw new Error(
          `Image redirect missing Location header: ${resp.status}`
        );
      }
      redirects += 1;
      if (redirects > MAX_IMAGE_REDIRECTS) {
        throw new Error(
          `Image fetch exceeded ${MAX_IMAGE_REDIRECTS} redirects`
        );
      }
      url = new URL(location, url);
      continue;
    }

    if (!resp.ok) {
      throw new Error(
        `Failed to fetch image: ${resp.status} ${resp.statusText}`
      );
    }

    const contentLength = resp.headers.get("content-length");
    if (contentLength !== null) {
      const size = Number(contentLength);
      if (!Number.isFinite(size) || size < 0) {
        throw new Error("Invalid image Content-Length header");
      }
      if (size > MAX_IMAGE_BYTES) {
        throw new Error(`Image exceeds ${MAX_IMAGE_BYTES} bytes`);
      }
    }

    return readBoundedResponse(resp, MAX_IMAGE_BYTES);
  }
}

/**
 * Validates that an image URL uses a safe public HTTP(S) endpoint.
 * @param url - URL to validate.
 */
async function assertSafeHttpUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Image URL must use http or https");
  }
  if (!url.hostname) {
    throw new Error("Image URL must include a hostname");
  }

  const hostname = normalizeHostname(url.hostname);
  const literalIp = isIP(hostname);
  if (literalIp !== 0) {
    if (isBlockedIp(hostname)) {
      throw new Error("Image URL resolves to a blocked internal address");
    }
    return;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("Image URL hostname did not resolve");
  }
  if (addresses.some((address) => isBlockedIp(address.address))) {
    throw new Error("Image URL resolves to a blocked internal address");
  }
}

/**
 * Checks whether an IP address is in a private, loopback, or otherwise blocked range.
 * @param address - IPv4 or IPv6 address string.
 * @returns True if the address is blocked for SSRF protection.
 */
function isBlockedIp(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }

  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    return isBlockedIp(normalized.slice("::ffff:".length));
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]:/.test(normalized) ||
    normalized.startsWith("ff")
  );
}

/**
 * Strips surrounding brackets from an IPv6 hostname so it can be parsed as an IP.
 * @param hostname - Hostname string, possibly bracketed.
 * @returns Normalized hostname without brackets.
 */
function normalizeHostname(hostname: string): string {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }
  return hostname;
}

/**
 * Reads a response body up to a maximum byte limit.
 * @param resp - Fetch response with a readable body.
 * @param maxBytes - Maximum number of bytes to accept.
 * @returns Concatenated response bytes.
 */
async function readBoundedResponse(
  resp: Response,
  maxBytes: number
): Promise<Buffer> {
  if (!resp.body) {
    return Buffer.alloc(0);
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of resp.body) {
    const bytes = Buffer.from(chunk);
    total += bytes.length;
    if (total > maxBytes) {
      throw new Error(`Image exceeds ${maxBytes} bytes`);
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, total);
}

/**
 * Infers an export format from a file path extension.
 * @param outputPath - Output file path.
 * @returns Export format, or null if the extension is unrecognized.
 */
function inferFormatFromPath(outputPath: string): ExportFormat | null {
  const ext = path.extname(outputPath).toLowerCase();
  switch (ext) {
    case ".png":
      return "PNG";
    case ".svg":
      return "SVG";
    case ".jpg":
    case ".jpeg":
      return "JPG";
    case ".pdf":
      return "PDF";
    default:
      return null;
  }
}

/**
 * Resolves the final export format, ensuring it does not conflict with the file extension.
 * @param format - Explicitly requested format.
 * @param inferredFormat - Format inferred from the output path extension.
 * @returns Resolved export format.
 */
function resolveExportFormat(
  format: ExportFormat | undefined,
  inferredFormat: ExportFormat | null
): ExportFormat {
  if (format && inferredFormat && format !== inferredFormat) {
    throw new Error(
      `format ${format} conflicts with outputPath extension (${inferredFormat})`
    );
  }
  return format ?? inferredFormat ?? "PNG";
}

/**
 * Extracts and validates the first screenshot export from plugin response data.
 * @param data - Plugin response payload.
 * @returns Validated screenshot export object.
 */
function getSingleScreenshotExport(data: unknown): ScreenshotExport {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid screenshot response from plugin");
  }

  const exports = (data as { exports?: unknown }).exports;
  if (!Array.isArray(exports) || exports.length === 0) {
    throw new Error("No screenshot export returned by plugin");
  }

  const first = exports[0];
  if (
    !first ||
    typeof first !== "object" ||
    typeof (first as { nodeId?: unknown }).nodeId !== "string" ||
    typeof (first as { nodeName?: unknown }).nodeName !== "string" ||
    typeof (first as { base64?: unknown }).base64 !== "string" ||
    typeof (first as { width?: unknown }).width !== "number" ||
    typeof (first as { height?: unknown }).height !== "number"
  ) {
    throw new Error("Malformed screenshot export payload");
  }

  const screenshot = first as ScreenshotExport;
  return screenshot;
}

/**
 * Saves a single screenshot item to the local filesystem.
 * @param sender - Sender that forwards get_screenshot requests to the plugin.
 * @param item - Screenshot save request.
 * @param index - Index of this item in the batch.
 * @param workspaceRoot - Root directory for resolving output paths.
 * @param defaultFormat - Default export format override.
 * @param defaultScale - Default export scale override.
 * @param defaultClip - Default clipping override.
 * @returns Result of the save operation.
 */
async function saveScreenshotItemToFile(
  sender: ScreenshotSender,
  item: SaveScreenshotItemInput,
  index: number,
  workspaceRoot: string,
  defaultFormat?: ExportFormat,
  defaultScale?: number,
  defaultClip?: boolean
): Promise<SaveScreenshotItemResult> {
  let resolvedOutputPath = item.outputPath;

  try {
    resolvedOutputPath = resolveAndValidateOutputPath(
      item.outputPath,
      workspaceRoot
    );
    const inferredFormat = inferFormatFromPath(resolvedOutputPath);
    const resolvedFormat = resolveExportFormat(
      item.format ?? defaultFormat,
      inferredFormat
    );
    const resolvedScale = resolveScale(item.scale, defaultScale);
    const resolvedClip = item.clip ?? defaultClip;

    const params: Record<string, unknown> = { format: resolvedFormat };
    if (resolvedScale !== undefined) {
      params.scale = resolvedScale;
    }
    if (resolvedClip !== undefined) {
      params.clip = resolvedClip;
    }

    const resp = await sender.sendWithParams(
      "get_screenshot",
      [item.nodeId],
      params
    );
    if (resp.error) {
      throw new Error(resp.error);
    }

    const screenshotExport = getSingleScreenshotExport(resp.data);
    const bytesWritten = await writeBase64ToFile(
      screenshotExport.base64,
      resolvedOutputPath
    );

    return {
      index,
      nodeId: screenshotExport.nodeId,
      nodeName: screenshotExport.nodeName,
      outputPath: resolvedOutputPath,
      format: resolvedFormat,
      width: screenshotExport.width,
      height: screenshotExport.height,
      bytesWritten,
      success: true,
    };
  } catch (err) {
    return {
      index,
      nodeId: item.nodeId,
      outputPath: resolvedOutputPath,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Writes base64-encoded bytes to a file, creating parent directories as needed.
 * @param base64 - Base64-encoded file contents.
 * @param outputPath - Destination file path.
 * @returns Number of bytes written.
 */
async function writeBase64ToFile(
  base64: string,
  outputPath: string
): Promise<number> {
  const bytes = Buffer.from(base64, "base64");
  await mkdir(path.dirname(outputPath), { recursive: true });
  try {
    await writeFile(outputPath, bytes, { flag: "wx" });
  } catch (err) {
    if (isNodeError(err) && err.code === "EEXIST") {
      throw new Error(`File already exists at outputPath: ${outputPath}`);
    }
    throw err;
  }
  return bytes.length;
}

/**
 * Resolves the effective screenshot scale from item and default values.
 * @param itemScale - Scale specified for the item.
 * @param defaultScale - Default scale for the batch.
 * @returns Positive scale value, or undefined if not applicable.
 */
function resolveScale(
  itemScale?: number,
  defaultScale?: number
): number | undefined {
  const resolvedScale = itemScale ?? defaultScale;
  if (resolvedScale === undefined || resolvedScale <= 0) {
    return undefined;
  }
  return resolvedScale;
}

/**
 * Type guard that checks whether a value is a NodeJS error with an optional code.
 * @param err - Value to check.
 * @returns True when the value is an Error instance.
 */
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error;
}

/**
 * Query API — Read-only operations for querying Figma file state.
 *
 * Used by the Learning Engine to scan existing design systems
 * and by the QA Agent to validate the built system.
 *
 * ES2017-compatible (Figma QuickJS sandbox).
 *
 * @module figma-api/query
 */

import type { Result } from '@dsb/guardrails';
import { Result as R } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: FILE INFO
// ============================================================================

export interface FileInfo {
  readonly fileName: string;
  readonly pageCount: number;
  readonly pageNames: readonly string[];
  readonly collectionCount: number;
  readonly collectionNames: readonly string[];
  readonly variableCount: number;
  readonly paintStyleCount: number;
  readonly textStyleCount: number;
  readonly effectStyleCount: number;
}

/**
 * Get a summary of the current Figma file.
 */
export async function getFileInfo(): Promise<Result<FileInfo, string>> {
  try {
    var pages = figma.root.children.filter(function(c) {
      return c.type === 'PAGE';
    });

    var collections = await figma.variables.getLocalVariableCollectionsAsync();
    var variables = await figma.variables.getLocalVariablesAsync();
    var paintStyles = await figma.getLocalPaintStylesAsync();
    var textStyles = await figma.getLocalTextStylesAsync();
    var effectStyles = await figma.getLocalEffectStylesAsync();

    return R.ok({
      fileName: figma.root.name,
      pageCount: pages.length,
      pageNames: pages.map(function(p) { return p.name; }),
      collectionCount: collections.length,
      collectionNames: collections.map(function(c) { return c.name; }),
      variableCount: variables.length,
      paintStyleCount: paintStyles.length,
      textStyleCount: textStyles.length,
      effectStyleCount: effectStyles.length,
    });
  } catch (e) {
    return R.err('Failed to get file info: ' + String(e));
  }
}

// ============================================================================
// SECTION 2: COLLECTION DETAILS
// ============================================================================

export interface CollectionDetail {
  readonly id: string;
  readonly name: string;
  readonly modes: ReadonlyArray<{ modeId: string; name: string }>;
  readonly variableCount: number;
  readonly variableNames: readonly string[];
}

/**
 * Get detailed info about all variable collections.
 */
export async function getCollectionDetails(): Promise<Result<CollectionDetail[], string>> {
  try {
    var collections = await figma.variables.getLocalVariableCollectionsAsync();
    var allVars = await figma.variables.getLocalVariablesAsync();

    var details: CollectionDetail[] = collections.map(function(c) {
      var collVars = allVars.filter(function(v) {
        return v.variableCollectionId === c.id;
      });

      return {
        id: c.id,
        name: c.name,
        modes: c.modes.map(function(m) { return { modeId: m.modeId, name: m.name }; }),
        variableCount: collVars.length,
        variableNames: collVars.map(function(v) { return v.name; }),
      };
    });

    return R.ok(details);
  } catch (e) {
    return R.err('Failed to get collection details: ' + String(e));
  }
}

// ============================================================================
// SECTION 3: SELECTION INFO
// ============================================================================

export interface SelectionInfo {
  readonly count: number;
  readonly types: readonly string[];
  readonly names: readonly string[];
}

/**
 * Get info about the current selection.
 */
export function getSelectionInfo(): Result<SelectionInfo, string> {
  try {
    var selection = figma.currentPage.selection;
    return R.ok({
      count: selection.length,
      types: selection.map(function(n) { return n.type; }),
      names: selection.map(function(n) { return n.name; }),
    });
  } catch (e) {
    return R.err('Failed to get selection info: ' + String(e));
  }
}

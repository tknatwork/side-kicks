/**
 * Pages API — Wrappers for Figma Page operations.
 *
 * ES2017-compatible (Figma QuickJS sandbox).
 *
 * @module figma-api/pages
 */

import type { Result } from '@dsb/guardrails';
import { Result as R } from '@dsb/guardrails';

// ============================================================================
// SECTION 1: PAGE OPERATIONS
// ============================================================================

/**
 * Create a new page in the current file.
 *
 * @param name - Page name (e.g., "Colors", "Typography", "Components/Buttons").
 */
export function createPage(name: string): Result<PageNode, string> {
  try {
    var page = figma.createPage();
    page.name = name;
    return R.ok(page);
  } catch (e) {
    return R.err('Failed to create page "' + name + '": ' + String(e));
  }
}

/**
 * Get all pages in the current file.
 */
export function getPages(): Result<PageNode[], string> {
  try {
    var pages = figma.root.children.filter(function(child) {
      return child.type === 'PAGE';
    }) as PageNode[];
    return R.ok(pages);
  } catch (e) {
    return R.err('Failed to get pages: ' + String(e));
  }
}

/**
 * Find a page by name. Returns null if not found.
 */
export function findPageByName(name: string): Result<PageNode | null, string> {
  var pagesResult = getPages();
  if (!pagesResult.ok) return pagesResult;

  var match = pagesResult.value.find(function(p) { return p.name === name; });
  return R.ok(match || null);
}

/**
 * Set the current active page.
 */
export function setCurrentPage(page: PageNode): Result<void, string> {
  try {
    figma.currentPage = page;
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to set current page: ' + String(e));
  }
}

/**
 * Delete a page.
 */
export function deletePage(page: PageNode): Result<void, string> {
  try {
    // Can't delete the last page
    var totalPages = figma.root.children.filter(function(c) {
      return c.type === 'PAGE';
    }).length;
    if (totalPages <= 1) {
      return R.err('Cannot delete the last page in a file.');
    }
    page.remove();
    return R.ok(undefined);
  } catch (e) {
    return R.err('Failed to delete page "' + page.name + '": ' + String(e));
  }
}

// ============================================================================
// SECTION 2: BATCH PAGE CREATION
// ============================================================================

/**
 * Create multiple pages at once. Returns the created pages.
 */
export function createPages(names: ReadonlyArray<string>): Result<PageNode[], string> {
  var pages: PageNode[] = [];
  for (var i = 0; i < names.length; i++) {
    var result = createPage(names[i]!);
    if (!result.ok) return result;
    pages.push(result.value);
  }
  return R.ok(pages);
}

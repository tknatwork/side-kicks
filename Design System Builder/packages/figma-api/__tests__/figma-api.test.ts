/**
 * Figma API tests — uses a mock `figma` global to test wrappers.
 *
 * The @dsb/figma-api package wraps Figma Plugin API calls.
 * These functions only exist inside the Figma QuickJS sandbox,
 * so we create a minimal mock of the `figma` global.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Mock figma global — minimal implementation of the Figma Plugin API
// ============================================================================

let idCounter = 0;
function nextId() { return 'id-' + (++idCounter); }

/** Mock variable collection. */
function mockCollection(name: string) {
  const id = nextId();
  return {
    id,
    name,
    modes: [{ modeId: 'mode-1', name: 'Mode 1' }],
    defaultModeId: 'mode-1',
    variableIds: [] as string[],
    addMode(modeName: string) { this.modes.push({ modeId: nextId(), name: modeName }); return this.modes[this.modes.length - 1].modeId; },
    renameMode(modeId: string, newName: string) { const m = this.modes.find(x => x.modeId === modeId); if (m) m.name = newName; },
    remove() { /* no-op */ },
  };
}

/** Mock variable. */
function mockVariable(name: string, resolvedType: string, collectionId: string) {
  const id = nextId();
  return {
    id,
    name,
    resolvedType,
    variableCollectionId: collectionId,
    valuesByMode: {} as Record<string, unknown>,
    scopes: [] as string[],
    description: '',
    hiddenFromPublishing: false,
    setValueForMode(modeId: string, value: unknown) { this.valuesByMode[modeId] = value; },
    remove() { /* no-op */ },
  };
}

/** Mock page node. */
function mockPage(name: string) {
  const id = nextId();
  return {
    id,
    name,
    type: 'PAGE' as const,
    children: [] as unknown[],
    appendChild(child: unknown) { this.children.push(child); },
    remove() { /* no-op */ },
  };
}

/** Mock frame node. */
function mockFrame() {
  return {
    id: nextId(),
    type: 'FRAME' as const,
    name: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    fills: [] as unknown[],
    layoutMode: 'NONE' as string,
    itemSpacing: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
    children: [] as unknown[],
    resize(w: number, h: number) { this.width = w; this.height = h; },
    appendChild(child: unknown) { this.children.push(child); },
  };
}

/** Mock section node. */
function mockSection() {
  return {
    id: nextId(),
    type: 'SECTION' as const,
    name: '',
    children: [] as unknown[],
    resizeWithoutConstraints(_w: number, _h: number) { /* no-op */ },
    appendChild(child: unknown) { this.children.push(child); },
  };
}

/** Mock text node. */
function mockText() {
  return {
    id: nextId(),
    type: 'TEXT' as const,
    name: '',
    characters: '',
    fontName: { family: 'Inter', style: 'Regular' },
    fontSize: 14,
    x: 0,
    y: 0,
    fills: [] as unknown[],
    children: [] as unknown[],
    appendChild(child: unknown) { this.children.push(child); },
  };
}

/** Mock rectangle node. */
function mockRectangle() {
  return {
    id: nextId(),
    type: 'RECTANGLE' as const,
    name: '',
    fills: [] as unknown[],
    width: 0,
    height: 0,
    children: [] as unknown[],
    resize(w: number, h: number) { this.width = w; this.height = h; },
    appendChild(child: unknown) { this.children.push(child); },
  };
}

/** Mock paint style. */
function mockPaintStyle(name?: string) {
  return {
    id: nextId(),
    type: 'PAINT' as const,
    name: name || '',
    paints: [] as unknown[],
    remove() { /* no-op */ },
  };
}

/** Mock text style. */
function mockTextStyle(name?: string) {
  return {
    id: nextId(),
    type: 'TEXT' as const,
    name: name || '',
    fontName: { family: 'Inter', style: 'Regular' },
    fontSize: 14,
    lineHeight: { value: 100, unit: 'PERCENT' },
    letterSpacing: { value: 0, unit: 'PIXELS' },
    remove() { /* no-op */ },
  };
}

/** Mock effect style. */
function mockEffectStyle(name?: string) {
  return {
    id: nextId(),
    type: 'EFFECT' as const,
    name: name || '',
    effects: [] as unknown[],
    remove() { /* no-op */ },
  };
}

// Storage for mock state
let collections: ReturnType<typeof mockCollection>[] = [];
let variables: ReturnType<typeof mockVariable>[] = [];
let pages: ReturnType<typeof mockPage>[] = [];
let paintStyles: ReturnType<typeof mockPaintStyle>[] = [];
let textStyles: ReturnType<typeof mockTextStyle>[] = [];
let effectStyles: ReturnType<typeof mockEffectStyle>[] = [];

// Install the global `figma` mock
const figmaGlobal = {
  root: {
    name: 'Test File',
    children: pages,
  },
  currentPage: null as unknown,

  // Variable API
  variables: {
    createVariableCollection(name: string) {
      const c = mockCollection(name);
      collections.push(c);
      return c;
    },
    createVariable(name: string, collectionOrId: unknown, resolvedType: string) {
      const collectionId = typeof collectionOrId === 'string'
        ? collectionOrId
        : (collectionOrId as { id: string }).id;
      const v = mockVariable(name, resolvedType, collectionId);
      variables.push(v);
      return v;
    },
    async getLocalVariableCollectionsAsync() { return collections; },
    async getLocalVariablesAsync() { return variables; },
    async getVariableCollectionByIdAsync(id: string) {
      return collections.find(c => c.id === id) || null;
    },
    async getVariableByIdAsync(id: string) {
      return variables.find(v => v.id === id) || null;
    },
  },

  // Style API
  createPaintStyle() {
    const s = mockPaintStyle();
    paintStyles.push(s);
    return s;
  },
  createTextStyle() {
    const s = mockTextStyle();
    textStyles.push(s);
    return s;
  },
  createEffectStyle() {
    const s = mockEffectStyle();
    effectStyles.push(s);
    return s;
  },
  async getLocalPaintStylesAsync() { return paintStyles; },
  async getLocalTextStylesAsync() { return textStyles; },
  async getLocalEffectStylesAsync() { return effectStyles; },

  // Page & node creation API
  createPage() {
    const p = mockPage('');
    pages.push(p);
    figmaGlobal.root.children = pages;
    return p;
  },
  createFrame() { return mockFrame(); },
  createSection() { return mockSection(); },
  createText() { return mockText(); },
  createRectangle() { return mockRectangle(); },

  // Font API
  async loadFontAsync(_fontName: unknown) { /* always succeeds */ },
};

// Set global figma
(globalThis as Record<string, unknown>).figma = figmaGlobal;

// ============================================================================
// Import functions AFTER setting up the global
// ============================================================================

import {
  createCollection, getCollections, getCollectionById, findCollectionByName,
  createVariable, getVariableById, getVariables, findVariableByName,
  setVariableValue, setVariableAlias, setScopes, setDescription,
  batchCreateVariables,
} from '../src/variables';

import {
  createColorStyle, updateColorStyle, createTextStyle as createTextStyleFn,
  createEffectStyle as createEffectStyleFn, getColorStyles, getTextStyles,
  getEffectStyles, deleteStyle,
} from '../src/styles';

import {
  createPage, getPages, findPageByName, setCurrentPage, deletePage, createPages,
} from '../src/pages';

import {
  createFrame, createSection, createText, createRectangle,
  appendChild, removeNode,
} from '../src/nodes';

import {
  loadFont, loadFonts, checkFontAvailability, checkFontsAvailability,
  getMissingFonts,
} from '../src/fonts';

import {
  getFileInfo, getCollectionDetails, getSelectionInfo,
} from '../src/query';

// ============================================================================
// Tests
// ============================================================================

beforeEach(() => {
  idCounter = 0;
  collections = [];
  variables = [];
  pages = [];
  paintStyles = [];
  textStyles = [];
  effectStyles = [];
  figmaGlobal.root.children = pages;
  figmaGlobal.currentPage = null;
});

describe('variables', () => {
  it('createCollection returns ok with collection', () => {
    const result = createCollection('Primitives');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Primitives');
    }
  });

  it('getCollections returns all collections', async () => {
    createCollection('A');
    createCollection('B');
    const result = await getCollections();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(2);
  });

  it('getCollectionById finds existing collection', async () => {
    const c = createCollection('Find Me');
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const result = await getCollectionById(c.value.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('Find Me');
  });

  it('getCollectionById returns error for missing ID', async () => {
    const result = await getCollectionById('nonexistent');
    expect(result.ok).toBe(false);
  });

  it('findCollectionByName returns matching collection', async () => {
    createCollection('Semantic');
    const result = await findCollectionByName('Semantic');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.name).toBe('Semantic');
  });

  it('findCollectionByName returns null for no match', async () => {
    const result = await findCollectionByName('Nonexistent');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it('createVariable creates variable in collection', () => {
    const c = createCollection('Test');
    if (!c.ok) return;
    const v = createVariable('color/red', c.value, 'color');
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.value.name).toBe('color/red');
    }
  });

  it('getVariables returns all variables', async () => {
    const c = createCollection('C');
    if (!c.ok) return;
    createVariable('a', c.value, 'color');
    createVariable('b', c.value, 'float');
    const result = await getVariables();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(2);
  });

  it('setVariableValue sets value for mode', () => {
    const c = createCollection('C');
    if (!c.ok) return;
    const v = createVariable('x', c.value, 'float');
    if (!v.ok) return;
    const result = setVariableValue(v.value, 'mode-1', 16);
    expect(result.ok).toBe(true);
  });

  it('batchCreateVariables creates multiple variables', async () => {
    const c = createCollection('Batch');
    if (!c.ok) return;
    const result = await batchCreateVariables([
      { name: 'v1', type: 'color' },
      { name: 'v2', type: 'float' },
      { name: 'v3', type: 'string' },
    ], c.value);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(3);
  });
});

describe('styles', () => {
  it('createColorStyle creates a paint style', () => {
    const result = createColorStyle('primary/500', { r: 0.9, g: 0.2, b: 0.4, a: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('primary/500');
  });

  it('updateColorStyle updates existing style', () => {
    const create = createColorStyle('surface', { r: 1, g: 1, b: 1, a: 1 });
    if (!create.ok) return;
    const result = updateColorStyle(create.value, { r: 0, g: 0, b: 0, a: 1 });
    expect(result.ok).toBe(true);
  });

  it('createTextStyleFn creates a text style', async () => {
    const result = await createTextStyleFn({
      name: 'heading/h1',
      fontFamily: 'Inter',
      fontSize: 48,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('heading/h1');
  });

  it('createEffectStyleFn creates an effect style', () => {
    const result = createEffectStyleFn({
      name: 'shadow/md',
      shadows: [
        { x: 0, y: 4, blur: 6, spread: 0, color: { r: 0, g: 0, b: 0, a: 0.1 } },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('shadow/md');
  });

  it('getColorStyles returns created styles', async () => {
    createColorStyle('a', { r: 1, g: 0, b: 0, a: 1 });
    createColorStyle('b', { r: 0, g: 1, b: 0, a: 1 });
    const result = await getColorStyles();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(2);
  });
});

describe('pages', () => {
  it('createPage creates a page', () => {
    const result = createPage('Colors');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('Colors');
  });

  it('getPages returns all pages', () => {
    createPage('Page 1');
    createPage('Page 2');
    const result = getPages();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(2);
  });

  it('findPageByName finds existing page', () => {
    createPage('Typography');
    const result = findPageByName('Typography');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.name).toBe('Typography');
  });

  it('findPageByName returns null for missing page', () => {
    const result = findPageByName('Nonexistent');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it('setCurrentPage sets figma.currentPage', () => {
    const p = createPage('Active');
    if (!p.ok) return;
    const result = setCurrentPage(p.value);
    expect(result.ok).toBe(true);
  });

  it('createPages creates multiple pages', () => {
    const result = createPages(['A', 'B', 'C']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(3);
  });
});

describe('nodes', () => {
  it('createFrame creates a frame with config', () => {
    const result = createFrame({
      name: 'Container',
      width: 800,
      height: 600,
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Container');
      expect(result.value.width).toBe(800);
    }
  });

  it('createSection creates a section', () => {
    const result = createSection('My Section', 400, 300);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('My Section');
  });

  it('createText creates a text node', async () => {
    const result = await createText({
      content: 'Hello World',
      fontFamily: 'Inter',
      fontSize: 24,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.characters).toBe('Hello World');
  });

  it('createRectangle creates a rectangle', () => {
    const result = createRectangle('Swatch', 100, 100, [
      { type: 'SOLID', color: { r: 1, g: 0, b: 0 }, opacity: 1 },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('Swatch');
  });

  it('createFrame with parent appends to parent', () => {
    const parent = createFrame({ name: 'Parent', width: 800, height: 600 });
    if (!parent.ok) return;
    const child = createFrame(
      { name: 'Child', width: 200, height: 200 },
      parent.value as unknown as BaseNode & ChildrenMixin,
    );
    expect(child.ok).toBe(true);
    expect(parent.value.children).toHaveLength(1);
  });
});

describe('fonts', () => {
  it('loadFont succeeds for any font (mock always succeeds)', async () => {
    const result = await loadFont('Inter', 'Bold');
    expect(result.ok).toBe(true);
  });

  it('loadFonts loads multiple fonts', async () => {
    const result = await loadFonts([
      { family: 'Inter', style: 'Regular' },
      { family: 'Inter', style: 'Bold' },
    ]);
    expect(result.ok).toBe(true);
  });

  it('checkFontAvailability returns available=true', async () => {
    const result = await checkFontAvailability('Inter');
    expect(result.available).toBe(true);
    expect(result.family).toBe('Inter');
    expect(result.style).toBe('Regular');
  });

  it('checkFontsAvailability checks multiple fonts', async () => {
    const results = await checkFontsAvailability([
      { family: 'Inter' },
      { family: 'Roboto', style: 'Medium' },
    ]);
    expect(results).toHaveLength(2);
  });

  it('getMissingFonts returns empty when all available', async () => {
    const missing = await getMissingFonts([
      { family: 'Inter' },
    ]);
    expect(missing).toHaveLength(0);
  });
});

describe('query', () => {
  it('getFileInfo returns file summary', async () => {
    createPage('Colors');
    createPage('Typography');
    createCollection('Primitives');
    createColorStyle('primary', { r: 1, g: 0, b: 0, a: 1 });

    const result = await getFileInfo();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fileName).toBe('Test File');
      expect(result.value.pageCount).toBe(2);
      expect(result.value.collectionCount).toBe(1);
      expect(result.value.paintStyleCount).toBe(1);
    }
  });

  it('getCollectionDetails returns detailed info', async () => {
    const c = createCollection('Semantic');
    if (c.ok) {
      createVariable('bg/primary', c.value, 'color');
      createVariable('fg/primary', c.value, 'color');
    }

    const result = await getCollectionDetails();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0].variableCount).toBe(2);
    }
  });
});

/**
 * Tests for the command registry and dispatch logic in code.ts.
 *
 * Mocks the global `figma` object and `__html__` since code.ts has
 * module-level side effects that reference them.
 *
 * @module builder-plugin/__tests__/command-dispatch
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// ============================================================================
// SECTION 1: FIGMA GLOBAL MOCK
// ============================================================================

/**
 * code.ts runs these on import:
 *   figma.showUI(__html__, { width: 360, height: 480, themeColors: true })
 *   figma.ui.postMessage({ type: 'log', ... })
 *   figma.ui.onmessage = function(msg) { ... }
 *
 * We capture figma.ui.onmessage so we can call it in tests.
 */

let capturedOnMessage: ((msg: { type: string; [key: string]: unknown }) => void) | null = null;
const postMessageMock = vi.fn();

function createFigmaMock() {
  return {
    showUI: vi.fn(),
    ui: {
      postMessage: postMessageMock,
      set onmessage(handler: (msg: { type: string; [key: string]: unknown }) => void) {
        capturedOnMessage = handler;
      },
      get onmessage() {
        return capturedOnMessage;
      },
    },
    // Used by handlers that reference figma directly (via figma-api)
    variables: {
      getLocalVariableCollections: vi.fn().mockReturnValue([]),
      createVariableCollection: vi.fn(),
      getVariableById: vi.fn(),
      getLocalVariables: vi.fn().mockReturnValue([]),
    },
    root: {
      children: [],
    },
    currentPage: {
      name: 'Test Page',
      children: [],
    },
    getNodeById: vi.fn(),
    createPage: vi.fn(),
    getLocalPaintStyles: vi.fn().mockReturnValue([]),
    getLocalTextStyles: vi.fn().mockReturnValue([]),
    getLocalEffectStyles: vi.fn().mockReturnValue([]),
    getLocalGridStyles: vi.fn().mockReturnValue([]),
    createPaintStyle: vi.fn(),
    createTextStyle: vi.fn(),
    createEffectStyle: vi.fn(),
    createGridStyle: vi.fn(),
    loadFontAsync: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// SECTION 2: MODULE IMPORT WITH MOCKS
// ============================================================================

describe('command-dispatch — code.ts', () => {
  let postedMessages: Array<{ type: string; [key: string]: unknown }>;

  beforeAll(() => {
    // Set up globals before code.ts is imported
    vi.stubGlobal('figma', createFigmaMock());
    vi.stubGlobal('__html__', '<div>mock ui</div>');

    // Track postMessage calls
    postedMessages = [];
    postMessageMock.mockImplementation((msg: { type: string; [key: string]: unknown }) => {
      postedMessages.push(msg);
    });

    // Now dynamically import code.ts — triggers side effects
    // We do this synchronously since the test suite needs it fully loaded
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  // --------------------------------------------------------------------------
  // SECTION 2a: INITIALIZATION
  // --------------------------------------------------------------------------

  it('figma.showUI is called on import', async () => {
    // Dynamic import triggers module side effects
    await import('../src/code');

    const figmaMock = globalThis.figma as ReturnType<typeof createFigmaMock>;
    expect(figmaMock.showUI).toHaveBeenCalledWith(
      '<div>mock ui</div>',
      expect.objectContaining({ width: 360, height: 480 }),
    );
  });

  it('sends init message with plugin version and supported commands', () => {
    const initMsg = postedMessages.find(m => m.type === 'init');
    expect(initMsg).toBeDefined();
    expect(initMsg!.pluginVersion).toBe('1.0.0');
    expect(initMsg!.supportedCommands).toBeDefined();
    expect(Array.isArray(initMsg!.supportedCommands)).toBe(true);
  });

  it('sends log messages on startup', () => {
    const logMsgs = postedMessages.filter(m => m.type === 'log');
    expect(logMsgs.length).toBeGreaterThanOrEqual(2);
    // One of them should mention "loaded"
    const loadedMsg = logMsgs.find(m =>
      typeof m.message === 'string' && m.message.includes('loaded'),
    );
    expect(loadedMsg).toBeDefined();
  });

  it('captures onmessage handler', () => {
    expect(capturedOnMessage).not.toBeNull();
    expect(typeof capturedOnMessage).toBe('function');
  });

  // --------------------------------------------------------------------------
  // SECTION 2b: COMMAND REGISTRY
  // --------------------------------------------------------------------------

  it('registry contains all expected commands (51 original + 26 merged + 2 role)', () => {
    // Reset tracked messages, request supported commands
    postMessageMock.mockClear();
    capturedOnMessage!({ type: 'get-supported-commands' });

    const cmdMsg = postMessageMock.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'supported-commands',
    );
    expect(cmdMsg).toBeDefined();

    const commands = (cmdMsg![0] as Record<string, unknown>).commands as string[];
    expect(commands).toHaveLength(63);
  });

  it('registry includes all token commands', () => {
    postMessageMock.mockClear();
    capturedOnMessage!({ type: 'get-supported-commands' });

    const cmdMsg = postMessageMock.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'supported-commands',
    );
    const commands = (cmdMsg![0] as Record<string, unknown>).commands as string[];

    const tokenCommands = [
      'create_collection', 'get_collections', 'delete_collection',
      'batch_create_variables', 'set_variable_value', 'set_variable_alias',
      'set_scopes', 'get_variables',
    ];
    for (const cmd of tokenCommands) {
      expect(commands).toContain(cmd);
    }
  });

  it('registry includes all style commands', () => {
    postMessageMock.mockClear();
    capturedOnMessage!({ type: 'get-supported-commands' });

    const cmdMsg = postMessageMock.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'supported-commands',
    );
    const commands = (cmdMsg![0] as Record<string, unknown>).commands as string[];

    const styleCommands = [
      'create_color_style', 'create_text_style', 'create_effect_style',
      'create_grid_style', 'get_styles',
    ];
    for (const cmd of styleCommands) {
      expect(commands).toContain(cmd);
    }
  });

  it('registry includes all page commands', () => {
    postMessageMock.mockClear();
    capturedOnMessage!({ type: 'get-supported-commands' });

    const cmdMsg = postMessageMock.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'supported-commands',
    );
    const commands = (cmdMsg![0] as Record<string, unknown>).commands as string[];

    const pageCommands = [
      'create_page', 'create_pages', 'get_pages', 'set_current_page',
      'delete_page', 'find_page_by_name',
    ];
    for (const cmd of pageCommands) {
      expect(commands).toContain(cmd);
    }
  });

  it('registry includes all node commands', () => {
    postMessageMock.mockClear();
    capturedOnMessage!({ type: 'get-supported-commands' });

    const cmdMsg = postMessageMock.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'supported-commands',
    );
    const commands = (cmdMsg![0] as Record<string, unknown>).commands as string[];

    const nodeCommands = [
      'create_frame', 'create_section', 'create_text',
      'create_rectangle', 'append_child', 'remove_node',
    ];
    for (const cmd of nodeCommands) {
      expect(commands).toContain(cmd);
    }
  });

  it('registry includes all query commands', () => {
    postMessageMock.mockClear();
    capturedOnMessage!({ type: 'get-supported-commands' });

    const cmdMsg = postMessageMock.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'supported-commands',
    );
    const commands = (cmdMsg![0] as Record<string, unknown>).commands as string[];

    const queryCommands = [
      'get_file_info', 'get_collection_details', 'get_selection_info',
      'check_fonts', 'load_font', 'load_fonts',
    ];
    for (const cmd of queryCommands) {
      expect(commands).toContain(cmd);
    }
  });

  // --------------------------------------------------------------------------
  // SECTION 2c: STATUS REPORTING
  // --------------------------------------------------------------------------

  it('get-status returns command count and connection state', () => {
    postMessageMock.mockClear();
    capturedOnMessage!({ type: 'get-status' });

    const statusMsg = postMessageMock.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'status',
    );
    expect(statusMsg).toBeDefined();

    const status = statusMsg![0] as Record<string, unknown>;
    expect(status.commandCount).toBe(63);
    expect(typeof status.connected).toBe('boolean');
    expect(Array.isArray(status.logBuffer)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // SECTION 2d: COMMAND NAMING CONVENTIONS
  // --------------------------------------------------------------------------

  it('all commands use snake_case naming', () => {
    postMessageMock.mockClear();
    capturedOnMessage!({ type: 'get-supported-commands' });

    const cmdMsg = postMessageMock.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'supported-commands',
    );
    const commands = (cmdMsg![0] as Record<string, unknown>).commands as string[];

    for (const cmd of commands) {
      // snake_case: lowercase letters, digits, underscores only
      expect(cmd).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('no duplicate command names exist', () => {
    postMessageMock.mockClear();
    capturedOnMessage!({ type: 'get-supported-commands' });

    const cmdMsg = postMessageMock.mock.calls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).type === 'supported-commands',
    );
    const commands = (cmdMsg![0] as Record<string, unknown>).commands as string[];

    const uniqueCommands = new Set(commands);
    expect(uniqueCommands.size).toBe(commands.length);
  });
});

/**
 * Tests for MCP tool registration functions.
 *
 * We can't instantiate a real McpServer (it imports from @modelcontextprotocol/sdk
 * which has complex type dependencies), but we can verify the registration
 * functions exist, accept the right parameters, and that the tool names
 * follow DSB conventions.
 *
 * Strategy: Create a mock McpServer that captures tool registrations,
 * then verify each registerXTools function registers the expected tools.
 */

import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// SECTION 1: Mock McpServer
// ============================================================================

interface RegisteredTool {
  name: string;
  description: string;
  schema: unknown;
  handler: Function;
}

function createMockServer() {
  const tools: RegisteredTool[] = [];

  return {
    tools,
    tool(name: string, description: string, schema: unknown, handler: Function) {
      tools.push({ name, description, schema, handler });
    },
  };
}

function createMockBridge() {
  return {
    sendCommand: vi.fn().mockResolvedValue({ commandId: 'mock', success: true, data: {} }),
    sendBatch: vi.fn().mockResolvedValue([]),
    getStatus: vi.fn().mockResolvedValue(null),
    healthCheck: vi.fn().mockResolvedValue(false),
    clearQueue: vi.fn().mockResolvedValue(0),
    getConfigResults: vi.fn().mockResolvedValue(null),
    clearConfigResults: vi.fn().mockResolvedValue(false),
    getBuildStatus: vi.fn().mockResolvedValue(null),
    getLockdownStatus: vi.fn().mockResolvedValue(null),
    liftLockdown: vi.fn().mockResolvedValue(false),
    sendDaemonHeartbeat: vi.fn().mockResolvedValue(false),
    enterDaemonUpdateMode: vi.fn().mockResolvedValue(false),
    exitDaemonUpdateMode: vi.fn().mockResolvedValue(false),
    reportTamperAlert: vi.fn().mockResolvedValue(false),
  };
}

// ============================================================================
// SECTION 2: Connection Tools
// ============================================================================

describe('registerConnectionTools', () => {
  it('registers expected tools', async () => {
    const { registerConnectionTools } = await import('../src/tools/connection-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerConnectionTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_check_connection');
    expect(toolNames).toContain('dsb_get_license_status');
    expect(toolNames).toContain('dsb_emergency_stop');
  });

  it('dsb_check_connection handler returns connected status', async () => {
    const { registerConnectionTools } = await import('../src/tools/connection-tools');
    const server = createMockServer();
    const bridge = createMockBridge();
    bridge.getStatus.mockResolvedValue({
      queue: { pending: 0, processing: 0, completed: 0, failed: 0 },
      plugins: { pluginCount: 1, connectedPlugins: [{ pluginId: 'dsb-builder' }] },
    });

    registerConnectionTools(server as any, bridge as any);

    const tool = server.tools.find(t => t.name === 'dsb_check_connection');
    expect(tool).toBeDefined();

    const result = await tool!.handler({});
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.connected).toBe(true);
    expect(parsed.serverRunning).toBe(true);
  });

  it('dsb_check_connection returns not connected when no plugins', async () => {
    const { registerConnectionTools } = await import('../src/tools/connection-tools');
    const server = createMockServer();
    const bridge = createMockBridge();
    bridge.getStatus.mockResolvedValue({
      queue: { pending: 0, processing: 0, completed: 0, failed: 0 },
      plugins: { pluginCount: 0, connectedPlugins: [] },
    });

    registerConnectionTools(server as any, bridge as any);

    const tool = server.tools.find(t => t.name === 'dsb_check_connection');
    const result = await tool!.handler({});
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.connected).toBe(false);
    expect(parsed.serverRunning).toBe(true);
  });

  it('dsb_check_connection returns error when server unreachable', async () => {
    const { registerConnectionTools } = await import('../src/tools/connection-tools');
    const server = createMockServer();
    const bridge = createMockBridge();
    bridge.getStatus.mockResolvedValue(null);

    registerConnectionTools(server as any, bridge as any);

    const tool = server.tools.find(t => t.name === 'dsb_check_connection');
    const result = await tool!.handler({});
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.connected).toBe(false);
    expect(parsed.error).toBeTruthy();
  });
});

// ============================================================================
// SECTION 3: Query Tools
// ============================================================================

describe('registerQueryTools', () => {
  it('registers expected tools', async () => {
    const { registerQueryTools } = await import('../src/tools/query-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerQueryTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_get_file_info');
    expect(toolNames).toContain('dsb_get_collection_details');
    expect(toolNames).toContain('dsb_get_collections');
    expect(toolNames).toContain('dsb_get_variables');
    expect(toolNames).toContain('dsb_get_styles');
    expect(toolNames).toContain('dsb_get_pages');
    expect(toolNames).toContain('dsb_get_selection');
    expect(toolNames).toContain('dsb_check_fonts');
  });

  it('query tools send bridge commands with correct types', async () => {
    const { registerQueryTools } = await import('../src/tools/query-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerQueryTools(server as any, bridge as any);

    // Call dsb_get_file_info
    const tool = server.tools.find(t => t.name === 'dsb_get_file_info');
    await tool!.handler({});

    expect(bridge.sendCommand).toHaveBeenCalledWith({
      type: 'get_file_info',
      payload: {},
    });
  });
});

// ============================================================================
// SECTION 4: Export Tools
// ============================================================================

describe('registerExportTools', () => {
  it('registers expected tools', async () => {
    const { registerExportTools } = await import('../src/tools/export-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerExportTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_validate_tokens');
    expect(toolNames).toContain('dsb_check_plan_limits');
    expect(toolNames).toContain('dsb_export_json');
    expect(toolNames).toContain('dsb_export_dtcg');
  });
});

// ============================================================================
// SECTION 5: Style Tools
// ============================================================================

describe('registerStyleTools', () => {
  it('registers expected tools', async () => {
    const { registerStyleTools } = await import('../src/tools/style-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerStyleTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_create_color_style');
    expect(toolNames).toContain('dsb_create_text_style');
    expect(toolNames).toContain('dsb_create_effect_style');
    expect(toolNames).toContain('dsb_create_grid_style');
  });
});

// ============================================================================
// SECTION 6: Token Tools
// ============================================================================

describe('registerTokenTools', () => {
  it('registers expected tools', async () => {
    const { registerTokenTools } = await import('../src/tools/token-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerTokenTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_create_collection');
    expect(toolNames).toContain('dsb_batch_create_variables');
    expect(toolNames).toContain('dsb_set_variable_value');
    expect(toolNames).toContain('dsb_set_variable_alias');
  });
});

// ============================================================================
// SECTION 7: Layout Tools
// ============================================================================

describe('registerLayoutTools', () => {
  it('registers expected tools', async () => {
    const { registerLayoutTools } = await import('../src/tools/layout-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerLayoutTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_create_page');
    expect(toolNames).toContain('dsb_create_page_structure');
    expect(toolNames).toContain('dsb_create_frame');
    expect(toolNames).toContain('dsb_create_section');
    expect(toolNames).toContain('dsb_create_text');
    expect(toolNames).toContain('dsb_create_rectangle');
  });
});

// ============================================================================
// SECTION 8: Telemetry Tools
// ============================================================================

describe('registerTelemetryTools', () => {
  it('registers expected tools', async () => {
    const { registerTelemetryTools } = await import('../src/tools/telemetry-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerTelemetryTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_toggle_telemetry');
  });
});

// ============================================================================
// SECTION 9: Update Tools
// ============================================================================

describe('registerUpdateTools', () => {
  it('registers expected tools', async () => {
    const { registerUpdateTools } = await import('../src/tools/update-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerUpdateTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_check_updates');
    expect(toolNames).toContain('dsb_apply_update');
  });
});

// ============================================================================
// SECTION 10: Admin Tools
// ============================================================================

describe('registerAdminTools', () => {
  it('registers expected tools', async () => {
    const { registerAdminTools } = await import('../src/tools/admin-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerAdminTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_admin_unlock');
    expect(toolNames).toContain('dsb_admin_lock');
    expect(toolNames).toContain('dsb_admin_inspect');
    expect(toolNames).toContain('dsb_admin_publish_update');
    expect(toolNames).toContain('dsb_admin_decrypt_state');
  });
});

// ============================================================================
// SECTION 11: Learning Tools
// ============================================================================

describe('registerLearningTools', () => {
  it('registers expected tools', async () => {
    const { registerLearningTools } = await import('../src/tools/learning-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerLearningTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_read_workspace');
    expect(toolNames).toContain('dsb_save_context');
    expect(toolNames).toContain('dsb_load_context');
    expect(toolNames).toContain('dsb_study_and_learn');
  });
});

// ============================================================================
// SECTION 12: Build Tools
// ============================================================================

describe('registerBuildTools', () => {
  it('registers expected tools', async () => {
    const { registerBuildTools } = await import('../src/tools/build-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerBuildTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_start_build');
    expect(toolNames).toContain('dsb_resume_build');
  });
});

// ============================================================================
// SECTION 13: Setup Tools
// ============================================================================

describe('registerSetupTools', () => {
  it('registers expected tools', async () => {
    const { registerSetupTools } = await import('../src/tools/setup-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerSetupTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_setup_project');
    expect(toolNames).toContain('dsb_system_check');
  });
});

// ============================================================================
// SECTION 14: Config UI Tools
// ============================================================================

describe('registerConfigUiTools', () => {
  it('registers expected tools', async () => {
    const { registerConfigUiTools } = await import('../src/tools/config-ui-tools');
    const server = createMockServer();
    const bridge = createMockBridge();

    registerConfigUiTools(server as any, bridge as any);

    const toolNames = server.tools.map(t => t.name);
    expect(toolNames).toContain('dsb_open_config_ui');
  });
});

// ============================================================================
// SECTION 15: Tool Naming Convention
// ============================================================================

describe('tool naming conventions', () => {
  it('all tools follow dsb_ prefix convention', async () => {
    const server = createMockServer();
    const bridge = createMockBridge();

    // Register all tool groups
    const { registerConnectionTools } = await import('../src/tools/connection-tools');
    const { registerQueryTools } = await import('../src/tools/query-tools');
    const { registerExportTools } = await import('../src/tools/export-tools');
    const { registerStyleTools } = await import('../src/tools/style-tools');
    const { registerTokenTools } = await import('../src/tools/token-tools');
    const { registerLayoutTools } = await import('../src/tools/layout-tools');
    const { registerTelemetryTools } = await import('../src/tools/telemetry-tools');
    const { registerUpdateTools } = await import('../src/tools/update-tools');
    const { registerAdminTools } = await import('../src/tools/admin-tools');
    const { registerLearningTools } = await import('../src/tools/learning-tools');
    const { registerBuildTools } = await import('../src/tools/build-tools');
    const { registerSetupTools } = await import('../src/tools/setup-tools');
    const { registerConfigUiTools } = await import('../src/tools/config-ui-tools');

    registerConnectionTools(server as any, bridge as any);
    registerQueryTools(server as any, bridge as any);
    registerExportTools(server as any, bridge as any);
    registerStyleTools(server as any, bridge as any);
    registerTokenTools(server as any, bridge as any);
    registerLayoutTools(server as any, bridge as any);
    registerTelemetryTools(server as any, bridge as any);
    registerUpdateTools(server as any, bridge as any);
    registerAdminTools(server as any, bridge as any);
    registerLearningTools(server as any, bridge as any);
    registerBuildTools(server as any, bridge as any);
    registerSetupTools(server as any, bridge as any);
    registerConfigUiTools(server as any, bridge as any);

    // Verify ALL tools start with dsb_
    for (const tool of server.tools) {
      expect(tool.name).toMatch(/^dsb_/);
    }

    // Verify all tools have descriptions
    for (const tool of server.tools) {
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('registers at least 30 tools total', async () => {
    const server = createMockServer();
    const bridge = createMockBridge();

    const { registerConnectionTools } = await import('../src/tools/connection-tools');
    const { registerQueryTools } = await import('../src/tools/query-tools');
    const { registerExportTools } = await import('../src/tools/export-tools');
    const { registerStyleTools } = await import('../src/tools/style-tools');
    const { registerTokenTools } = await import('../src/tools/token-tools');
    const { registerLayoutTools } = await import('../src/tools/layout-tools');
    const { registerTelemetryTools } = await import('../src/tools/telemetry-tools');
    const { registerUpdateTools } = await import('../src/tools/update-tools');
    const { registerAdminTools } = await import('../src/tools/admin-tools');
    const { registerLearningTools } = await import('../src/tools/learning-tools');
    const { registerBuildTools } = await import('../src/tools/build-tools');
    const { registerSetupTools } = await import('../src/tools/setup-tools');
    const { registerConfigUiTools } = await import('../src/tools/config-ui-tools');

    registerConnectionTools(server as any, bridge as any);
    registerQueryTools(server as any, bridge as any);
    registerExportTools(server as any, bridge as any);
    registerStyleTools(server as any, bridge as any);
    registerTokenTools(server as any, bridge as any);
    registerLayoutTools(server as any, bridge as any);
    registerTelemetryTools(server as any, bridge as any);
    registerUpdateTools(server as any, bridge as any);
    registerAdminTools(server as any, bridge as any);
    registerLearningTools(server as any, bridge as any);
    registerBuildTools(server as any, bridge as any);
    registerSetupTools(server as any, bridge as any);
    registerConfigUiTools(server as any, bridge as any);

    expect(server.tools.length).toBeGreaterThanOrEqual(30);
  });
});

/**
 * Design System Builder Plugin — Main entry point.
 *
 * This is the headless command executor. Claude is the brain, this is the hands.
 * The plugin polls the orchestration server for commands, dispatches them to
 * handler functions, and sends results back.
 *
 * ES2017-compatible (QuickJS sandbox).
 *
 * @module builder-plugin/code
 */

import type { PollCommand, CommandResult } from './polling';

// Token handlers
import {
  handleCreateCollection,
  handleGetCollections,
  handleDeleteCollection,
  handleBatchCreateVariables,
  handleSetVariableValue,
  handleSetVariableAlias,
  handleSetScopes,
  handleGetVariables,
} from './handlers/token-handlers';

// Style handlers
import {
  handleCreateColorStyle,
  handleCreateTextStyle,
  handleCreateEffectStyle,
  handleCreateGridStyle,
  handleGetStyles,
} from './handlers/style-handlers';

// Page and node handlers
import {
  handleCreatePage,
  handleCreatePages,
  handleGetPages,
  handleSetCurrentPage,
  handleDeletePage,
  handleFindPageByName,
  handleCreateFrame,
  handleCreateSection,
  handleCreateText,
  handleCreateRectangle,
  handleAppendChild,
  handleRemoveNode,
} from './handlers/page-handlers';

// Query handlers
import {
  handleGetFileInfo,
  handleGetCollectionDetails,
  handleGetSelectionInfo,
  handleCheckFonts,
  handleLoadFont,
  handleLoadFonts,
} from './handlers/query-handlers';

// Node manipulation handlers
import {
  handleResizeNode, handleMoveNode, handleCloneNode, handleSetFills,
  handleSetStrokes, handleSetTextContent, handleSetNodeProperties,
  handleGetNodeById, handleFindNodesByName,
} from './handlers/node-manipulation-handlers';
// Component handlers
import {
  handleInstantiateComponent, handleSearchComponents,
  handleGetComponentMetadata, handleArrangeComponentSet,
} from './handlers/component-handlers';
// Extraction handlers
import {
  handleExtractDesignSystem, handleExtractDesignSummary, handleGetLocalStyles,
} from './handlers/extraction-handlers';
// Debug, image, audit, execute, doc handlers
import { handleGetConsoleBuffer, handleClearConsole, handleReloadPage } from './handlers/debug-handlers';
import { handleExportNodeImage, handleTakeScreenshot } from './handlers/image-handlers';
import {
  handleLintDesign, handleCheckDesignParity, handleGetDesignHealthScore,
} from './handlers/audit-handlers';
import { handleExecuteCode } from './handlers/execute-handler';
import { handleGenerateComponentDoc } from './handlers/doc-handlers';
// Batch handlers (build orchestrator batch operations)
import { handleBatchSetValues, handleBatchSetAliases } from './handlers/batch-handlers';
// Role handlers (pipeline file role toggle)
import { handleSetFileRole, handleGetFileRole } from './handlers/role-handler';
// Deep extraction handler (full variable values + node tree for replication)
import { handleDeepExtract } from './handlers/deep-extraction-handler';

// ============================================================================
// SECTION 1: COMMAND REGISTRY
// ============================================================================

type CommandHandler = (cmd: PollCommand) => Promise<CommandResult>;

/**
 * Maps command type strings to handler functions.
 * Adding a new command = adding one entry here.
 */
var COMMAND_HANDLERS: Record<string, CommandHandler> = {
  // Token / Variable operations
  'create_collection': handleCreateCollection,
  'get_collections': handleGetCollections,
  'delete_collection': handleDeleteCollection,
  'batch_create_variables': handleBatchCreateVariables,
  'set_variable_value': handleSetVariableValue,
  'set_variable_alias': handleSetVariableAlias,
  'set_scopes': handleSetScopes,
  'get_variables': handleGetVariables,
  'batch_set_values': handleBatchSetValues,
  'batch_set_aliases': handleBatchSetAliases,

  // Style operations
  'create_color_style': handleCreateColorStyle,
  'create_text_style': handleCreateTextStyle,
  'create_effect_style': handleCreateEffectStyle,
  'create_grid_style': handleCreateGridStyle,
  'get_styles': handleGetStyles,

  // Page operations
  'create_page': handleCreatePage,
  'create_pages': handleCreatePages,
  'get_pages': handleGetPages,
  'set_current_page': handleSetCurrentPage,
  'delete_page': handleDeletePage,
  'find_page_by_name': handleFindPageByName,

  // Node operations
  'create_frame': handleCreateFrame,
  'create_section': handleCreateSection,
  'create_text': handleCreateText,
  'create_rectangle': handleCreateRectangle,
  'append_child': handleAppendChild,
  'remove_node': handleRemoveNode,

  // Query operations
  'get_file_info': handleGetFileInfo,
  'get_collection_details': handleGetCollectionDetails,
  'get_selection_info': handleGetSelectionInfo,
  'check_fonts': handleCheckFonts,
  'load_font': handleLoadFont,
  'load_fonts': handleLoadFonts,

  // Node manipulation
  'resize_node': handleResizeNode,
  'move_node': handleMoveNode,
  'clone_node': handleCloneNode,
  'set_fills': handleSetFills,
  'set_strokes': handleSetStrokes,
  'set_text_content': handleSetTextContent,
  'set_node_properties': handleSetNodeProperties,
  'get_node_by_id': handleGetNodeById,
  'find_nodes_by_name': handleFindNodesByName,

  // Components
  'instantiate_component': handleInstantiateComponent,
  'search_components': handleSearchComponents,
  'get_component_metadata': handleGetComponentMetadata,
  'arrange_component_set': handleArrangeComponentSet,

  // Extraction
  'extract_design_system': handleExtractDesignSystem,
  'extract_design_summary': handleExtractDesignSummary,
  'get_local_styles': handleGetLocalStyles,
  'deep_extract': handleDeepExtract,

  // Debug
  'get_console_buffer': handleGetConsoleBuffer,
  'clear_console': handleClearConsole,
  'reload_page': handleReloadPage,

  // Image
  'export_node_image': handleExportNodeImage,
  'take_screenshot': handleTakeScreenshot,

  // Audit
  'lint_design': handleLintDesign,
  'check_design_parity': handleCheckDesignParity,
  'get_design_health_score': handleGetDesignHealthScore,

  // Execute + Doc
  'execute_code': handleExecuteCode,
  'generate_component_doc': handleGenerateComponentDoc,

  // Pipeline file role
  'set_file_role': handleSetFileRole,
  'get_file_role': handleGetFileRole,

  // Pipeline notification (UI triggers, MCP tool does the work)
  'notify_replicate_requested': function(cmd) {
    return Promise.resolve({ commandId: cmd.id, success: true, data: { acknowledged: true, message: 'Replicate request received. Use dsb_replicate MCP tool to execute.' } });
  },
};

// ============================================================================
// SECTION 2: COMMAND DISPATCHER
// ============================================================================

/**
 * Dispatch a command to its handler.
 * Returns an error result for unknown command types.
 */
async function dispatchCommand(cmd: PollCommand): Promise<CommandResult> {
  var handler = COMMAND_HANDLERS[cmd.type];
  if (!handler) {
    return {
      commandId: cmd.id,
      success: false,
      error: 'Unknown command type: "' + cmd.type + '". Available commands: ' +
        Object.keys(COMMAND_HANDLERS).join(', '),
    };
  }

  try {
    return await handler(cmd);
  } catch (e) {
    return {
      commandId: cmd.id,
      success: false,
      error: 'Handler threw an unexpected error for "' + cmd.type + '": ' + String(e),
    };
  }
}

// ============================================================================
// SECTION 3: UI BRIDGE
// ============================================================================

/**
 * Log buffer — recent messages for the UI live log.
 */
var logBuffer: string[] = [];
var MAX_LOG_SIZE = 200;

function addLog(message: string): void {
  var timestamp = new Date().toLocaleTimeString();
  var entry = '[' + timestamp + '] ' + message;
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_SIZE) {
    logBuffer = logBuffer.slice(logBuffer.length - MAX_LOG_SIZE);
  }

  // Send to UI
  figma.ui.postMessage({ type: 'log', message: entry });
}

function updateConnectionStatus(connected: boolean): void {
  figma.ui.postMessage({ type: 'connection', connected: connected });
}

// ============================================================================
// SECTION 4: UI MESSAGE HANDLING
// ============================================================================

// The UI iframe owns all HTTP networking. It sends commands here for execution
// and forwards results back to the orchestration server.
var pluginConnected = false;

figma.ui.onmessage = function(msg: { type: string; [key: string]: unknown }) {
  // UI iframe received a command from the server — execute it in Figma.
  if (msg.type === 'exec-command') {
    var cmd = msg.command as PollCommand;
    dispatchCommand(cmd).then(function(result) {
      figma.ui.postMessage({ type: 'command-result', result: result });
    }).catch(function(e) {
      figma.ui.postMessage({
        type: 'command-result',
        result: {
          commandId: cmd.id,
          success: false,
          error: 'Dispatch failed: ' + String(e),
        },
      });
    });
    return;
  }

  // UI iframe reports server reachability changes.
  if (msg.type === 'connection-status') {
    pluginConnected = (msg.connected as boolean) === true;
    updateConnectionStatus(pluginConnected);
    addLog(pluginConnected
      ? 'Connected to orchestration server.'
      : 'Disconnected from orchestration server.');
    return;
  }

  if (msg.type === 'get-status') {
    figma.ui.postMessage({
      type: 'status',
      connected: pluginConnected,
      commandCount: Object.keys(COMMAND_HANDLERS).length,
      logBuffer: logBuffer,
    });
    return;
  }

  if (msg.type === 'get-supported-commands') {
    figma.ui.postMessage({
      type: 'supported-commands',
      commands: Object.keys(COMMAND_HANDLERS),
    });
    return;
  }
};

// ============================================================================
// SECTION 5: INITIALIZATION
// ============================================================================

figma.showUI(__html__, { width: 360, height: 480, themeColors: true });

addLog('Design System Builder plugin loaded.');
addLog('Ready. Enter session token and click Connect.');
figma.ui.postMessage({
  type: 'init',
  pluginVersion: '1.0.0',
  supportedCommands: Object.keys(COMMAND_HANDLERS),
});

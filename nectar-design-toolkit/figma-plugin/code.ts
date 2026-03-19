// Portfolio DS Builder - Figma Plugin Main Code
// This plugin uses HTTP polling to communicate with the orchestration server
// (WebSocket is blocked by Figma's sandbox)

// ============================================================================
// TYPES
// ============================================================================

interface BridgeMessage {
  id: string;
  type: 'command';
  command: string;
  payload: Record<string, unknown>;
}

interface BridgeResponse {
  id: string;
  type: 'response';
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

// Removed WebSocket - using HTTP polling via UI instead
let isPluginActive = true;

// ============================================================================
// FILE INFO HELPERS
// ============================================================================

function sendFileInfo(): void {
  figma.ui.postMessage({
    type: 'file_info',
    data: {
      name: figma.root.name,
      id: figma.fileKey,
      currentPage: figma.currentPage.name
    }
  });
}

// Send file info periodically to keep UI in sync
setInterval(() => {
  if (isPluginActive) {
    sendFileInfo();
  }
}, 10000);

// Listen for page changes
figma.on('currentpagechange', () => {
  sendFileInfo();
});

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

async function handleCommand(message: BridgeMessage): Promise<void> {
  const { id, command, payload } = message;

  figma.ui.postMessage({ type: 'log', command, payload });

  try {
    let result: unknown;

    switch (command) {
      // Variable Collection Commands
      case 'create_variable_collection':
        result = await createVariableCollection(payload as unknown as CreateCollectionPayload);
        break;
      case 'create_variable':
        result = await createVariable(payload as unknown as CreateVariablePayload);
        break;
      case 'set_variable_value':
        result = await setVariableValue(payload as unknown as SetVariableValuePayload);
        break;
      case 'delete_variable':
        result = await deleteVariable(payload as unknown as DeleteVariablePayload);
        break;
      case 'create_mode':
        result = await createMode(payload as unknown as CreateModePayload);
        break;

      // Style Commands
      case 'create_color_style':
        result = await createColorStyle(payload as unknown as CreateColorStylePayload);
        break;
      case 'update_color_style':
        result = await updateColorStyle(payload as unknown as UpdateColorStylePayload);
        break;
      case 'create_text_style':
        result = await createTextStyle(payload as unknown as CreateTextStylePayload);
        break;
      case 'update_text_style':
        result = await updateTextStyle(payload as unknown as UpdateTextStylePayload);
        break;
      case 'create_effect_style':
        result = await createEffectStyle(payload as unknown as CreateEffectStylePayload);
        break;
      case 'update_effect_style':
        result = await updateEffectStyle(payload as unknown as UpdateEffectStylePayload);
        break;
      case 'create_grid_style':
        result = await createGridStyle(payload as unknown as CreateGridStylePayload);
        break;
      case 'update_grid_style':
        result = await updateGridStyle(payload as unknown as UpdateGridStylePayload);
        break;
      case 'delete_style':
        result = await deleteStyle(payload as unknown as DeleteStylePayload);
        break;

      // Page Commands
      case 'create_page':
        result = await createPage(payload as unknown as CreatePagePayload);
        break;
      case 'get_pages':
        result = getPages();
        break;
      case 'set_current_page':
        result = setCurrentPage(payload as unknown as SetCurrentPagePayload);
        break;

      // Frame/Component Commands
      case 'create_frame':
        result = await createFrame(payload as unknown as CreateFramePayload);
        break;
      case 'create_section':
        result = await createSection(payload as unknown as CreateSectionPayload);
        break;
      case 'create_color_swatches_group':
        await createColorSwatchesGroup(payload as unknown as CreateColorSwatchesGroupPayload);
        result = { message: 'Success' };
        break;
      case 'create_typography_group':
        await createTypographyGroup(payload as unknown as CreateTypographyGroupPayload);
        result = { message: 'Success' };
        break;
      case 'create_effect_group':
        await createEffectGroup(payload as unknown as CreateEffectGroupPayload);
        result = { message: 'Success' };
        break;
      case 'create_grid_group':
        await createGridGroup(payload as unknown as CreateGridGroupPayload);
        result = { message: 'Success' };
        break;
      case 'create_text':
        result = await createText(payload as unknown as CreateTextPayload);
        break;
      case 'update_text':
        result = await updateText(payload as unknown as UpdateTextPayload);
        break;
      case 'create_rectangle':
        result = await createRectangle(payload as unknown as CreateRectanglePayload);
        break;
      case 'create_ellipse':
        result = await createEllipse(payload as unknown as CreateEllipsePayload);
        break;
      case 'create_vector':
        result = await createVector(payload as unknown as CreateVectorPayload);
        break;
      case 'create_line':
        result = await createLine(payload as unknown as CreateLinePayload);
        break;
      case 'append_to_frame':
        result = await appendToFrame(payload as unknown as AppendToFramePayload);
        break;
      case 'apply_effect':
        result = await applyEffect(payload as unknown as ApplyEffectPayload);
        break;
      case 'create_component':
        result = await createComponent(payload as unknown as CreateComponentPayload);
        break;
      case 'create_component_set':
        result = await createComponentSet(payload as unknown as CreateComponentSetPayload);
        break;
      case 'create_instance':
        result = await createInstance(payload as unknown as CreateInstancePayload);
        break;
      case 'bind_variable':
        result = await bindVariable(payload as unknown as BindVariablePayload);
        break;
      case 'set_component_properties':
        result = await setComponentProperties(payload as unknown as SetComponentPropertiesPayload);
        break;

      // Query Commands
      case 'get_variable_collections':
      case 'get_collections':  // Alias
        result = await getVariableCollections();
        break;
      case 'get_variables':
        result = await getVariables(payload as GetVariablesPayload);
        break;
      case 'get_vars':  // Detailed version with scopes and values
      case 'get_vars_detailed':
        result = await getVarsDetailed(payload as unknown as GetVarsDetailedPayload);
        break;
      case 'get_local_styles':
        result = await getLocalStyles();
        break;
      case 'get_grid_styles':
        result = await getGridStyles();
        break;
      case 'get_file_info':
        result = getFileInfo();
        break;

      // Selection Commands
      case 'get_selection':
        result = getSelection();
        break;

      // Scoping Commands
      case 'set_variable_scopes':
        result = await setVariableScopes(payload as unknown as SetVariableScopesPayload);
        break;
      case 'set_collection_scopes':
        result = await setCollectionScopes(payload as unknown as SetCollectionScopesPayload);
        break;

      // Publishing Commands
      case 'hide_collection_from_publishing':
        result = await hideCollectionFromPublishing(payload as unknown as HideCollectionPayload);
        break;
      case 'rename_collection':
        result = await renameCollection(payload as unknown as RenameCollectionPayload);
        break;
      case 'delete_collection':
        result = await deleteCollection(payload as unknown as DeleteCollectionPayload);
        break;

      // Mode Binding Commands
      case 'set_explicit_variable_modes':
        result = await setExplicitVariableModes(payload as unknown as SetExplicitVariableModesPayload);
        break;
      case 'get_explicit_variable_modes':
        result = await getExplicitVariableModes(payload as unknown as GetExplicitVariableModesPayload);
        break;
      case 'clear_explicit_variable_modes':
        result = await clearExplicitVariableModes(payload as unknown as ClearExplicitVariableModesPayload);
        break;
      case 'create_mode_switching_frames':
        result = await createModeSwitchingFrames(payload as unknown as CreateModeSwitchingFramesPayload);
        break;

      // Node Query and Move Commands
      case 'get_page_children':
        result = await getPageChildren(payload as unknown as GetPageChildrenPayload);
        break;
      case 'get_local_components':
        result = await getLocalComponents();
        break;
      case 'move_node_to_page':
        result = await moveNodeToPage(payload as unknown as MoveNodeToPagePayload);
        break;
      case 'clone_node_to_page':
        result = await cloneNodeToPage(payload as unknown as CloneNodeToPagePayload);
        break;
      case 'delete_node':
        result = await deleteNode(payload as unknown as DeleteNodePayload);
        break;
      case 'clear_page_children':
        result = await clearPageChildren(payload as unknown as { pageName?: string });
        break;
      case 'get_node_info':
        result = await getNodeInfo(payload as unknown as GetNodeInfoPayload);
        break;
      case 'set_node_position':
        result = await setNodePosition(payload as unknown as SetNodePositionPayload);
        break;
      case 'append_node_to_frame':
        result = await appendNodeToFrame(payload as unknown as AppendNodeToFramePayload);
        break;
      case 'resize_node':
        result = await resizeNode(payload as unknown as ResizeNodePayload);
        break;
      case 'set_auto_layout':
        result = await setAutoLayout(payload as unknown as SetAutoLayoutPayload);
        break;
      case 'bind_variable_to_node':
        result = await bindVariableToNode(payload as unknown as BindVariableToNodePayload);
        break;
      case 'set_node_fills':
        result = await setNodeFills(payload as unknown as SetNodeFillsPayload);
        break;
      case 'rename_node':
        result = await renameNode(payload as unknown as RenameNodePayload);
        break;
      case 'add_component_description':
        result = await addComponentDescription(payload as unknown as AddComponentDescriptionPayload);
        break;

      // Library Commands
      case 'import_component_by_key':
        result = await importComponentByKey(payload as unknown as ImportComponentByKeyPayload);
        break;
      case 'search_library_components':
        result = await searchLibraryComponents(payload as unknown as SearchLibraryComponentsPayload);
        break;
      case 'flatten_node':
        result = await flattenNode(payload as unknown as FlattenNodePayload);
        break;
      case 'convert_to_component':
        result = await convertToComponent(payload as unknown as ConvertToComponentPayload);
        break;
      case 'set_instance_swap_property':
        result = await setInstanceSwapProperty(payload as unknown as SetInstanceSwapPropertyPayload);
        break;
      case 'swap_instance':
        result = await swapInstance(payload as unknown as SwapInstancePayload);
        break;
      case 'get_available_library_components':
        result = await getAvailableLibraryComponents();
        break;
      case 'batch_import_and_flatten':
        result = await batchImportAndFlatten(payload as unknown as BatchImportAndFlattenPayload);
        break;

      // SVG Import Commands
      case 'create_from_svg':
        result = await createFromSvg(payload as unknown as CreateFromSvgPayload);
        break;
      case 'batch_create_icons_from_svg':
        result = await batchCreateIconsFromSvg(payload as unknown as BatchCreateIconsFromSvgPayload);
        break;

      // Icon Processing Commands (for Temporary page → Icons page)
      case 'process_temp_icons':
        result = await processTempIcons(payload as unknown as ProcessTempIconsPayload);
        break;
      case 'clone_and_convert_icon':
        result = await cloneAndConvertIcon(payload as unknown as CloneAndConvertIconPayload);
        break;
      case 'batch_move_to_page':
        result = await batchMoveToPage(payload as unknown as BatchMoveToPagePayload);
        break;
      case 'scan_page_instances':
        result = await scanPageInstances(payload as unknown as ScanPageInstancesPayload);
        break;
      case 'flatten_and_rename_instances':
        result = await flattenAndRenameInstances(payload as unknown as FlattenAndRenameInstancesPayload);
        break;

      // Deep scan and extract icons from Temporary Icons page
      case 'extract_temp_icons':
        result = await extractTempIcons(payload as unknown as ExtractTempIconsPayload);
        break;
      case 'extract_single_category':
        result = await extractSingleCategory(payload as unknown as ExtractSingleCategoryPayload);
        break;
      case 'get_category_list':
        result = await getCategoryList(payload as unknown as GetCategoryListPayload);
        break;
      case 'get_frame_children':
        result = await getFrameChildren(payload as unknown as GetFrameChildrenPayload);
        break;
      case 'analyze_page_styles':
        result = await analyzePageStyles(payload as unknown as AnalyzePageStylesPayload);
        break;

      case 'remap_paint_styles':
        result = await remapPaintStyles(payload as unknown as RemapPaintStylesPayload);
        break;

      case 'remap_text_styles':
        result = await remapTextStyles(payload as unknown as RemapTextStylesPayload);
        break;

      case 'remap_effect_styles':
        result = await remapEffectStyles(payload as unknown as RemapEffectStylesPayload);
        break;

      // Batch variable operations (build-figma-ds.js optimized)
      case 'batch_create_variables':
        result = await batchCreateVariables(payload as unknown as BatchCreateVariablesPayload);
        break;
      case 'batch_set_variable_aliases':
        result = await batchSetVariableAliases(payload as unknown as BatchSetVariableAliasesPayload);
        break;
      case 'batch_create_styles':
        result = await batchCreateStyles(payload as unknown as BatchCreateStylesPayload);
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    // Send result to UI which will POST to orchestration server
    figma.ui.postMessage({ type: 'result', id, success: true, command, data: result });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    figma.ui.postMessage({ type: 'result', id, success: false, command, error: errorMessage });
  }
}

// ============================================================================
// VARIABLE OPERATIONS
// ============================================================================

interface CreateCollectionPayload {
  name: string;
  modes?: string[];
}

async function createVariableCollection(payload: CreateCollectionPayload): Promise<{ id: string; name: string; modeIds: Record<string, string> }> {
  const collection = figma.variables.createVariableCollection(payload.name);

  const modeIds: Record<string, string> = {};

  // Rename default mode to first mode name if provided
  if (payload.modes && payload.modes.length > 0) {
    collection.renameMode(collection.modes[0].modeId, payload.modes[0]);
    modeIds[payload.modes[0]] = collection.modes[0].modeId;

    // Add additional modes
    for (let i = 1; i < payload.modes.length; i++) {
      const modeId = collection.addMode(payload.modes[i]);
      modeIds[payload.modes[i]] = modeId;
    }
  } else {
    modeIds['Mode 1'] = collection.modes[0].modeId;
  }

  return {
    id: collection.id,
    name: collection.name,
    modeIds
  };
}

interface CreateVariablePayload {
  collectionId: string;
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
}

async function createVariable(payload: CreateVariablePayload): Promise<{ id: string; name: string }> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
  if (!collection) {
    throw new Error(`Collection not found: ${payload.collectionId}`);
  }

  const variable = figma.variables.createVariable(payload.name, collection, payload.resolvedType);

  return {
    id: variable.id,
    name: variable.name
  };
}

interface SetVariableValuePayload {
  variableId: string;
  modeId: string;
  value: string | number | boolean | { r: number; g: number; b: number; a?: number } | { type: 'VARIABLE_ALIAS'; id: string };
}

async function setVariableValue(payload: SetVariableValuePayload): Promise<{ success: boolean }> {
  const variable = await figma.variables.getVariableByIdAsync(payload.variableId);
  if (!variable) {
    throw new Error(`Variable not found: ${payload.variableId}`);
  }

  let value = payload.value;

  // Handle variable alias
  if (typeof value === 'object' && value !== null && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    const aliasVariable = await figma.variables.getVariableByIdAsync(value.id);
    if (!aliasVariable) {
      throw new Error(`Alias variable not found: ${value.id}`);
    }
    value = figma.variables.createVariableAlias(aliasVariable);
  }

  variable.setValueForMode(payload.modeId, value);

  return { success: true };
}

interface DeleteVariablePayload {
  variableId: string;
}

async function deleteVariable(payload: DeleteVariablePayload): Promise<{ success: boolean }> {
  const variable = await figma.variables.getVariableByIdAsync(payload.variableId);
  if (!variable) {
    throw new Error(`Variable not found: ${payload.variableId}`);
  }

  variable.remove();
  return { success: true };
}

interface CreateModePayload {
  collectionId: string;
  name: string;
}

async function createMode(payload: CreateModePayload): Promise<{ modeId: string }> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
  if (!collection) {
    throw new Error(`Collection not found: ${payload.collectionId}`);
  }

  const modeId = collection.addMode(payload.name);
  return { modeId };
}

// ============================================================================
// VARIABLE SCOPING OPERATIONS
// ============================================================================

interface SetVariableScopesPayload {
  variableId: string;
  scopes: VariableScope[];
}

async function setVariableScopes(payload: SetVariableScopesPayload): Promise<{ success: boolean }> {
  const variable = await figma.variables.getVariableByIdAsync(payload.variableId);
  if (!variable) {
    throw new Error(`Variable not found: ${payload.variableId}`);
  }

  variable.scopes = payload.scopes;
  return { success: true };
}

interface SetCollectionScopesPayload {
  collectionId: string;
  scopes: VariableScope[];
}

async function setCollectionScopes(payload: SetCollectionScopesPayload): Promise<{ success: boolean; count: number }> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
  if (!collection) {
    throw new Error(`Collection not found: ${payload.collectionId}`);
  }

  const variables = await figma.variables.getLocalVariablesAsync();
  const collectionVars = variables.filter(v => v.variableCollectionId === payload.collectionId);

  for (const variable of collectionVars) {
    variable.scopes = payload.scopes;
  }

  return { success: true, count: collectionVars.length };
}

// ============================================================================
// STYLE OPERATIONS
// ============================================================================

interface CreateColorStylePayload {
  name: string;
  color: { r: number; g: number; b: number };
  opacity?: number;
  description?: string;
}

async function createColorStyle(payload: CreateColorStylePayload): Promise<{ id: string; name: string }> {
  const style = figma.createPaintStyle();
  style.name = payload.name;

  if (payload.description) {
    style.description = payload.description;
  }

  style.paints = [{
    type: 'SOLID',
    color: payload.color,
    opacity: payload.opacity ?? 1
  }];

  return {
    id: style.id,
    name: style.name
  };
}

interface CreateTextStylePayload {
  name: string;
  fontFamily: string;
  fontStyle?: string;
  fontSize: number;
  lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
  letterSpacing?: { value: number; unit: 'PIXELS' | 'PERCENT' };
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
  description?: string;
}

async function createTextStyle(payload: CreateTextStylePayload): Promise<{ id: string; name: string }> {
  const style = figma.createTextStyle();
  style.name = payload.name;

  // Load font first
  await figma.loadFontAsync({
    family: payload.fontFamily,
    style: payload.fontStyle || 'Regular'
  });

  style.fontName = {
    family: payload.fontFamily,
    style: payload.fontStyle || 'Regular'
  };
  style.fontSize = payload.fontSize;

  if (payload.lineHeight) {
    if (payload.lineHeight.unit === 'AUTO') {
      style.lineHeight = { unit: 'AUTO' };
    } else {
      style.lineHeight = { value: payload.lineHeight.value, unit: payload.lineHeight.unit };
    }
  }

  if (payload.letterSpacing) {
    style.letterSpacing = payload.letterSpacing;
  }

  if (payload.textCase) {
    style.textCase = payload.textCase;
  }

  if (payload.description) {
    style.description = payload.description;
  }

  return {
    id: style.id,
    name: style.name
  };
}

interface UpdateTextStylePayload {
  name: string;  // Style name to find and update
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
  letterSpacing?: { value: number; unit: 'PIXELS' | 'PERCENT' };
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
  description?: string;
}

async function updateTextStyle(payload: UpdateTextStylePayload): Promise<{ id: string; name: string }> {
  // Find the text style by name (use async API)
  const styles = await figma.getLocalTextStylesAsync();
  const style = styles.find(s => s.name === payload.name);

  if (!style) {
    throw new Error(`Text style "${payload.name}" not found`);
  }

  // Load and update font if provided
  if (payload.fontFamily) {
    await figma.loadFontAsync({
      family: payload.fontFamily,
      style: payload.fontStyle || 'Regular'
    });
    style.fontName = {
      family: payload.fontFamily,
      style: payload.fontStyle || 'Regular'
    };
  }

  if (payload.fontSize !== undefined) {
    style.fontSize = payload.fontSize;
  }

  if (payload.lineHeight) {
    if (payload.lineHeight.unit === 'AUTO') {
      style.lineHeight = { unit: 'AUTO' };
    } else {
      style.lineHeight = { value: payload.lineHeight.value, unit: payload.lineHeight.unit };
    }
  }

  if (payload.letterSpacing) {
    style.letterSpacing = payload.letterSpacing;
  }

  if (payload.textCase) {
    style.textCase = payload.textCase;
  }

  if (payload.description !== undefined) {
    style.description = payload.description;
  }

  return {
    id: style.id,
    name: style.name
  };
}

interface CreateEffectStylePayload {
  name: string;
  effects: Array<{
    type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
    color?: { r: number; g: number; b: number; a: number };
    offset?: { x: number; y: number };
    radius?: number;
    spread?: number;
    visible?: boolean;
  }>;
  description?: string;
}

async function createEffectStyle(payload: CreateEffectStylePayload): Promise<{ id: string; name: string }> {
  const style = figma.createEffectStyle();
  style.name = payload.name;

  if (payload.description) {
    style.description = payload.description;
  }

  style.effects = payload.effects.map(effect => {
    if (effect.type === 'DROP_SHADOW') {
      return {
        type: 'DROP_SHADOW',
        color: effect.color || { r: 0, g: 0, b: 0, a: 0.25 },
        offset: effect.offset || { x: 0, y: 4 },
        radius: effect.radius || 4,
        spread: effect.spread || 0,
        visible: effect.visible !== false,
        blendMode: 'NORMAL'
      } as DropShadowEffect;
    } else if (effect.type === 'INNER_SHADOW') {
      return {
        type: 'INNER_SHADOW',
        color: effect.color || { r: 0, g: 0, b: 0, a: 0.25 },
        offset: effect.offset || { x: 0, y: 4 },
        radius: effect.radius || 4,
        spread: effect.spread || 0,
        visible: effect.visible !== false,
        blendMode: 'NORMAL'
      } as InnerShadowEffect;
    } else if (effect.type === 'LAYER_BLUR') {
      return {
        type: 'LAYER_BLUR',
        radius: effect.radius || 4,
        visible: effect.visible !== false
      } as BlurEffect;
    } else {
      return {
        type: 'BACKGROUND_BLUR',
        radius: effect.radius || 4,
        visible: effect.visible !== false
      } as BlurEffect;
    }
  });


  return {
    id: style.id,
    name: style.name
  };
}

interface UpdateEffectStylePayload {
  name: string;
  effects?: Array<{
    type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
    color?: { r: number; g: number; b: number; a: number };
    offset?: { x: number; y: number };
    radius?: number;
    spread?: number;
    visible?: boolean;
  }>;
  description?: string;
}

async function updateEffectStyle(payload: UpdateEffectStylePayload): Promise<{ id: string; name: string }> {
  const styles = await figma.getLocalEffectStylesAsync();
  const style = styles.find(s => s.name === payload.name);

  if (!style) {
    throw new Error(`Effect style "${payload.name}" not found`);
  }

  if (payload.effects) {
    style.effects = payload.effects.map(effect => {
      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        return {
          type: effect.type,
          color: effect.color || { r: 0, g: 0, b: 0, a: 0.25 },
          offset: effect.offset || { x: 0, y: 4 },
          radius: effect.radius || 4,
          spread: effect.spread || 0,
          visible: effect.visible !== false,
          blendMode: 'NORMAL'
        } as DropShadowEffect | InnerShadowEffect;
      } else {
        return {
          type: effect.type,
          radius: effect.radius || 4,
          visible: effect.visible !== false
        } as BlurEffect;
      }
    });
  }

  if (payload.description) {
    style.description = payload.description;
  }

  return {
    id: style.id,
    name: style.name
  };
}

interface CreateSectionPayload {
  name: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

async function createSection(payload: CreateSectionPayload): Promise<{ id: string; name: string }> {
  const section = figma.createSection();
  section.name = payload.name;

  if (payload.x !== undefined) section.x = payload.x;
  if (payload.y !== undefined) section.y = payload.y;

  if (payload.width && payload.height) {
    section.resizeWithoutConstraints(payload.width, payload.height);
  } else {
    section.resizeWithoutConstraints(1000, 1000); // Default size
  }

  return {
    id: section.id,
    name: section.name
  };
}

interface CreateGridStylePayload {
  name: string;
  layoutGrids: Array<{
    pattern: 'ROWS' | 'COLUMNS' | 'GRID';
    alignment?: 'MIN' | 'MAX' | 'STRETCH' | 'CENTER';
    gutterSize?: number;
    count?: number;
    sectionSize?: number;
    offset?: number;
    visible?: boolean;
    color?: { r: number; g: number; b: number; a: number };
  }>;
  description?: string;
}

async function createGridStyle(payload: CreateGridStylePayload): Promise<{ id: string; name: string }> {
  const style = figma.createGridStyle();
  style.name = payload.name;

  if (payload.description) {
    style.description = payload.description;
  }

  style.layoutGrids = payload.layoutGrids.map(grid => {
    const baseGrid = {
      visible: grid.visible !== false,
      color: grid.color || { r: 1, g: 0, b: 0, a: 0.1 }
    };

    if (grid.pattern === 'GRID') {
      return {
        ...baseGrid,
        pattern: 'GRID',
        sectionSize: grid.sectionSize || 8
      } as GridLayoutGrid;
    } else {
      return {
        ...baseGrid,
        pattern: grid.pattern,
        alignment: grid.alignment || 'STRETCH',
        gutterSize: grid.gutterSize || 20,
        count: grid.count || 12,
        offset: grid.offset || 0
      } as RowsColsLayoutGrid;
    }
  });

  return {
    id: style.id,
    name: style.name
  };
}


interface UpdateColorStylePayload {
  name: string;
  color?: { r: number; g: number; b: number };
  opacity?: number;
  description?: string;
}

async function updateColorStyle(payload: UpdateColorStylePayload): Promise<{ id: string; name: string }> {
  const styles = await figma.getLocalPaintStylesAsync();
  const style = styles.find(s => s.name === payload.name);

  if (!style) {
    throw new Error(`Color style "${payload.name}" not found`);
  }

  if (payload.color) {
    const paints = [...style.paints];
    const newPaint: SolidPaint = {
      type: 'SOLID',
      color: payload.color,
      opacity: payload.opacity !== undefined ? payload.opacity : 1
    };
    style.paints = [newPaint];
  }

  if (payload.description) {
    style.description = payload.description;
  }

  return {
    id: style.id,
    name: style.name
  };
}

interface UpdateGridStylePayload {
  name: string;
  layoutGrids?: GridLayoutGrid[] | RowsColsLayoutGrid[];
  description?: string;
}

async function updateGridStyle(payload: UpdateGridStylePayload): Promise<{ id: string; name: string }> {
  const styles = await figma.getLocalGridStylesAsync();
  const style = styles.find(s => s.name === payload.name);

  if (!style) {
    throw new Error(`Grid style "${payload.name}" not found`);
  }

  if (payload.layoutGrids) {
    style.layoutGrids = payload.layoutGrids.map(grid => {
      const baseGrid = {
        visible: grid.visible !== false,
        color: grid.color || { r: 1, g: 0, b: 0, a: 0.1 }
      };
      if (grid.pattern === 'GRID') {
        return { ...baseGrid, pattern: 'GRID', sectionSize: grid.sectionSize || 8 } as GridLayoutGrid;
      } else {
        return {
          ...baseGrid,
          pattern: grid.pattern,
          alignment: grid.alignment || 'STRETCH',
          gutterSize: grid.gutterSize || 20,
          count: grid.count || 12,
          offset: grid.offset || 0
        } as RowsColsLayoutGrid;
      }
    });
  }

  if (payload.description) {
    style.description = payload.description;
  }

  return {
    id: style.id,
    name: style.name
  };
}

interface DeleteStylePayload {
  id: string;
}

async function deleteStyle(payload: DeleteStylePayload): Promise<{ success: boolean }> {
  const style = await figma.getStyleByIdAsync(payload.id);
  if (style) {
    style.remove();
    return { success: true };
  }
  return { success: false };
}

// ============================================================================
// PAGE OPERATIONS
// ============================================================================

interface CreatePagePayload {
  name: string;
}

async function createPage(payload: CreatePagePayload): Promise<{ id: string; name: string }> {
  const page = figma.createPage();
  page.name = payload.name;

  return {
    id: page.id,
    name: page.name
  };
}

function getPages(): Array<{ id: string; name: string }> {
  return figma.root.children.map(page => ({
    id: page.id,
    name: page.name
  }));
}

interface SetCurrentPagePayload {
  pageId?: string;
  pageName?: string;
}

async function setCurrentPage(payload: SetCurrentPagePayload): Promise<{ success: boolean; pageId: string }> {
  let page: PageNode | undefined;

  if (payload.pageId) {
    page = figma.root.children.find(p => p.id === payload.pageId);
  } else if (payload.pageName) {
    page = figma.root.children.find(p => p.name === payload.pageName);
  }

  if (!page) {
    throw new Error('Page not found');
  }

  await figma.setCurrentPageAsync(page);
  return { success: true, pageId: page.id };
}

// ============================================================================
// FRAME/COMPONENT OPERATIONS
// ============================================================================

interface CreateFramePayload {
  name: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  parentId?: string;
  cornerRadius?: number;
  fills?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number }; opacity?: number }>;
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  itemSpacing?: number;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  autoLayout?: {
    mode: 'VERTICAL' | 'HORIZONTAL';
    itemSpacing?: number;
    paddingLeft?: number;
    paddingRight?: number;
    paddingTop?: number;
    paddingBottom?: number;
    primaryAxisSizingMode?: 'FIXED' | 'AUTO';
    counterAxisSizingMode?: 'FIXED' | 'AUTO';
  };
}

async function createFrame(payload: CreateFramePayload): Promise<{ id: string; name: string }> {
  const frame = figma.createFrame();
  frame.name = payload.name;

  if (payload.width) frame.resize(payload.width, payload.height || 100);
  if (payload.x !== undefined) frame.x = payload.x;
  if (payload.y !== undefined) frame.y = payload.y;

  if (payload.fills) {
    frame.fills = payload.fills;
  }

  if (payload.cornerRadius !== undefined) {
    frame.cornerRadius = payload.cornerRadius;
  }

  // Support autoLayout shorthand (from build-figma-ds.js)
  if (payload.autoLayout) {
    frame.layoutMode = payload.autoLayout.mode;
    if (payload.autoLayout.itemSpacing !== undefined) frame.itemSpacing = payload.autoLayout.itemSpacing;
    if (payload.autoLayout.paddingTop !== undefined) frame.paddingTop = payload.autoLayout.paddingTop;
    if (payload.autoLayout.paddingRight !== undefined) frame.paddingRight = payload.autoLayout.paddingRight;
    if (payload.autoLayout.paddingBottom !== undefined) frame.paddingBottom = payload.autoLayout.paddingBottom;
    if (payload.autoLayout.paddingLeft !== undefined) frame.paddingLeft = payload.autoLayout.paddingLeft;
    if (payload.autoLayout.primaryAxisSizingMode) frame.primaryAxisSizingMode = payload.autoLayout.primaryAxisSizingMode;
    if (payload.autoLayout.counterAxisSizingMode) frame.counterAxisSizingMode = payload.autoLayout.counterAxisSizingMode;
  }
  // Also support legacy layoutMode/padding format
  else if (payload.layoutMode && payload.layoutMode !== 'NONE') {
    frame.layoutMode = payload.layoutMode;
    if (payload.itemSpacing !== undefined) frame.itemSpacing = payload.itemSpacing;
    if (payload.padding) {
      if (payload.padding.top !== undefined) frame.paddingTop = payload.padding.top;
      if (payload.padding.right !== undefined) frame.paddingRight = payload.padding.right;
      if (payload.padding.bottom !== undefined) frame.paddingBottom = payload.padding.bottom;
      if (payload.padding.left !== undefined) frame.paddingLeft = payload.padding.left;
    }
  }

  // Parent nesting: move frame into the specified parent node (section or frame)
  if (payload.parentId) {
    const parentNode = await figma.getNodeByIdAsync(payload.parentId);
    if (parentNode && ('appendChild' in parentNode)) {
      (parentNode as FrameNode | SectionNode).appendChild(frame);
    }
  }

  return {
    id: frame.id,
    name: frame.name
  };
}

interface CreateTextPayload {
  text: string;
  x?: number;
  y?: number;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  fills?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number }; opacity?: number }>;
  width?: number;
  textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
}

async function createText(payload: CreateTextPayload): Promise<{ id: string; characters: string }> {
  const text = figma.createText();

  // Load font first
  const fontFamily = payload.fontFamily || 'Switzer';
  const fontStyle = payload.fontStyle || 'Regular';
  await figma.loadFontAsync({ family: fontFamily, style: fontStyle });

  text.fontName = { family: fontFamily, style: fontStyle };
  text.characters = payload.text;

  if (payload.fontSize) text.fontSize = payload.fontSize;
  if (payload.x !== undefined) text.x = payload.x;
  if (payload.y !== undefined) text.y = payload.y;
  if (payload.fills) text.fills = payload.fills;
  if (payload.width) {
    text.resize(payload.width, text.height);
    text.textAutoResize = 'HEIGHT';
  }
  if (payload.textAlignHorizontal) text.textAlignHorizontal = payload.textAlignHorizontal;

  return {
    id: text.id,
    characters: text.characters
  };
}

// Update text node content
interface UpdateTextPayload {
  nodeId: string;
  text: string;
  fontFamily?: string;
  fontStyle?: string;
}

async function updateText(payload: UpdateTextPayload): Promise<{ id: string; characters: string; success: boolean }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);

  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (node.type !== 'TEXT') {
    throw new Error(`Node is not a text node: ${node.type}`);
  }

  const textNode = node as TextNode;

  // Load the font before updating
  const fontFamily = payload.fontFamily || (textNode.fontName as FontName).family || 'Switzer';
  const fontStyle = payload.fontStyle || (textNode.fontName as FontName).style || 'Regular';
  await figma.loadFontAsync({ family: fontFamily, style: fontStyle });

  textNode.characters = payload.text;

  return {
    id: textNode.id,
    characters: textNode.characters,
    success: true
  };
}

interface CreateRectanglePayload {
  name?: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  fills?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number }; opacity?: number }>;
  cornerRadius?: number;
  strokes?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number }; opacity?: number }>;
  strokeWeight?: number;
}

async function createRectangle(payload: CreateRectanglePayload): Promise<{ id: string; name: string }> {
  const rect = figma.createRectangle();

  if (payload.name) rect.name = payload.name;
  rect.resize(payload.width, payload.height);
  if (payload.x !== undefined) rect.x = payload.x;
  if (payload.y !== undefined) rect.y = payload.y;
  if (payload.fills) rect.fills = payload.fills;
  if (payload.cornerRadius !== undefined) rect.cornerRadius = payload.cornerRadius;
  if (payload.strokes) rect.strokes = payload.strokes;
  if (payload.strokeWeight !== undefined) rect.strokeWeight = payload.strokeWeight;

  return {
    id: rect.id,
    name: rect.name
  };
}

interface AppendToFramePayload {
  frameId: string;
  childIds: string[];
}

async function appendToFrame(payload: AppendToFramePayload): Promise<{ success: boolean; frameId: string }> {
  const frame = await figma.getNodeByIdAsync(payload.frameId);
  if (!frame || (frame.type !== 'FRAME' && frame.type !== 'COMPONENT')) {
    throw new Error(`Frame not found: ${payload.frameId}`);
  }

  for (const childId of payload.childIds) {
    const child = await figma.getNodeByIdAsync(childId);
    if (child && 'parent' in child) {
      (frame as FrameNode).appendChild(child as SceneNode);
    }
  }

  return { success: true, frameId: payload.frameId };
}

interface ApplyEffectPayload {
  nodeId: string;
  effects: Array<{
    type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
    color?: { r: number; g: number; b: number; a: number };
    offset?: { x: number; y: number };
    radius?: number;
    spread?: number;
    visible?: boolean;
  }>;
}

async function applyEffect(payload: ApplyEffectPayload): Promise<{ success: boolean; nodeId: string }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node || !('effects' in node)) {
    throw new Error(`Node not found or doesn't support effects: ${payload.nodeId}`);
  }

  const effects: Effect[] = payload.effects.map(effect => {
    if (effect.type === 'DROP_SHADOW') {
      return {
        type: 'DROP_SHADOW',
        color: effect.color || { r: 0, g: 0, b: 0, a: 0.25 },
        offset: effect.offset || { x: 0, y: 4 },
        radius: effect.radius || 4,
        spread: effect.spread || 0,
        visible: effect.visible !== false,
        blendMode: 'NORMAL'
      } as DropShadowEffect;
    } else if (effect.type === 'INNER_SHADOW') {
      return {
        type: 'INNER_SHADOW',
        color: effect.color || { r: 0, g: 0, b: 0, a: 0.25 },
        offset: effect.offset || { x: 0, y: 4 },
        radius: effect.radius || 4,
        spread: effect.spread || 0,
        visible: effect.visible !== false,
        blendMode: 'NORMAL'
      } as InnerShadowEffect;
    } else if (effect.type === 'LAYER_BLUR') {
      return {
        type: 'LAYER_BLUR',
        radius: effect.radius || 4,
        visible: effect.visible !== false
      } as BlurEffect;
    } else {
      return {
        type: 'BACKGROUND_BLUR',
        radius: effect.radius || 4,
        visible: effect.visible !== false
      } as BlurEffect;
    }
  });

  (node as FrameNode | RectangleNode).effects = effects;
  return { success: true, nodeId: payload.nodeId };
}

interface CreateComponentPayload {
  name: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  description?: string;
  fills?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number }; opacity?: number }>;
  strokes?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number }; opacity?: number }>;
  strokeWeight?: number;
  cornerRadius?: number;
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  itemSpacing?: number;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
}

async function createComponent(payload: CreateComponentPayload): Promise<{ id: string; name: string; key: string }> {
  const component = figma.createComponent();
  component.name = payload.name;

  if (payload.width && payload.height) {
    component.resize(payload.width, payload.height);
  }

  if (payload.x !== undefined) component.x = payload.x;
  if (payload.y !== undefined) component.y = payload.y;

  if (payload.description) {
    component.description = payload.description;
  }

  if (payload.fills) {
    component.fills = payload.fills;
  }

  if (payload.strokes) {
    component.strokes = payload.strokes;
  }

  if (payload.strokeWeight !== undefined) {
    component.strokeWeight = payload.strokeWeight;
  }

  if (payload.cornerRadius !== undefined) {
    component.cornerRadius = payload.cornerRadius;
  }

  if (payload.layoutMode && payload.layoutMode !== 'NONE') {
    component.layoutMode = payload.layoutMode;
    if (payload.itemSpacing !== undefined) component.itemSpacing = payload.itemSpacing;
    if (payload.padding) {
      if (payload.padding.top !== undefined) component.paddingTop = payload.padding.top;
      if (payload.padding.right !== undefined) component.paddingRight = payload.padding.right;
      if (payload.padding.bottom !== undefined) component.paddingBottom = payload.padding.bottom;
      if (payload.padding.left !== undefined) component.paddingLeft = payload.padding.left;
    }
    if (payload.primaryAxisAlignItems) component.primaryAxisAlignItems = payload.primaryAxisAlignItems;
    if (payload.counterAxisAlignItems) component.counterAxisAlignItems = payload.counterAxisAlignItems;
    if (payload.primaryAxisSizingMode) component.primaryAxisSizingMode = payload.primaryAxisSizingMode;
    if (payload.counterAxisSizingMode) component.counterAxisSizingMode = payload.counterAxisSizingMode;
  }

  return {
    id: component.id,
    name: component.name,
    key: component.key
  };
}

interface CreateComponentSetPayload {
  name: string;
  componentIds: string[];
}

async function createComponentSet(payload: CreateComponentSetPayload): Promise<{ id: string; name: string; key: string }> {
  const components: ComponentNode[] = [];

  for (const id of payload.componentIds) {
    const node = figma.getNodeById(id);
    if (node && node.type === 'COMPONENT') {
      components.push(node);
    }
  }

  if (components.length === 0) {
    throw new Error('No valid components found');
  }

  const componentSet = figma.combineAsVariants(components, figma.currentPage);
  componentSet.name = payload.name;

  return {
    id: componentSet.id,
    name: componentSet.name,
    key: componentSet.key
  };
}

interface CreateInstancePayload {
  componentId: string;
  x?: number;
  y?: number;
  name?: string;
}

async function createInstance(payload: CreateInstancePayload): Promise<{ id: string; name: string; componentId: string }> {
  const component = await figma.getNodeByIdAsync(payload.componentId);
  if (!component || component.type !== 'COMPONENT') {
    throw new Error(`Component not found: ${payload.componentId}`);
  }

  const instance = (component as ComponentNode).createInstance();

  if (payload.x !== undefined) instance.x = payload.x;
  if (payload.y !== undefined) instance.y = payload.y;
  if (payload.name) instance.name = payload.name;

  return {
    id: instance.id,
    name: instance.name,
    componentId: payload.componentId
  };
}

interface BindVariablePayload {
  nodeId: string;
  property: 'fills' | 'strokes' | 'effects' | 'layoutGrids' | 'opacity' | 'visible' | 'cornerRadius' |
  'paddingTop' | 'paddingBottom' | 'paddingLeft' | 'paddingRight' | 'itemSpacing' |
  'strokeWeight' | 'width' | 'height' | 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight';
  variableId: string;
  index?: number;  // For fills/strokes array index
}

async function bindVariable(payload: BindVariablePayload): Promise<{ success: boolean; nodeId: string; property: string }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  const variable = await figma.variables.getVariableByIdAsync(payload.variableId);
  if (!variable) {
    throw new Error(`Variable not found: ${payload.variableId}`);
  }

  const sceneNode = node as SceneNode;

  // Handle different property types
  if (payload.property === 'fills' && 'fills' in sceneNode) {
    const fills = [...(sceneNode as GeometryMixin).fills as Paint[]];
    const idx = payload.index ?? 0;
    if (fills[idx] && fills[idx].type === 'SOLID') {
      const fill = { ...fills[idx] } as SolidPaint;
      fills[idx] = figma.variables.setBoundVariableForPaint(fill, 'color', variable);
      (sceneNode as GeometryMixin).fills = fills;
    }
  } else if (payload.property === 'strokes' && 'strokes' in sceneNode) {
    const strokes = [...(sceneNode as GeometryMixin).strokes as Paint[]];
    const idx = payload.index ?? 0;
    if (strokes[idx] && strokes[idx].type === 'SOLID') {
      const stroke = { ...strokes[idx] } as SolidPaint;
      strokes[idx] = figma.variables.setBoundVariableForPaint(stroke, 'color', variable);
      (sceneNode as GeometryMixin).strokes = strokes;
    }
  } else if ('setBoundVariable' in sceneNode) {
    // For numeric/boolean properties
    (sceneNode as FrameNode).setBoundVariable(payload.property as VariableBindableNodeField, variable);
  }

  return {
    success: true,
    nodeId: node.id,
    property: payload.property
  };
}

interface SetComponentPropertiesPayload {
  componentId: string;
  properties: Array<{
    name: string;
    type: 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT';
    defaultValue?: boolean | string;
    preferredValues?: Array<{ type: 'COMPONENT' | 'COMPONENT_SET'; key: string }>;
  }>;
}

async function setComponentProperties(payload: SetComponentPropertiesPayload): Promise<{ success: boolean; componentId: string; propertiesCount: number }> {
  const node = await figma.getNodeByIdAsync(payload.componentId);
  if (!node || (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET')) {
    throw new Error(`Component not found: ${payload.componentId}`);
  }

  const component = node as ComponentNode | ComponentSetNode;

  for (const prop of payload.properties) {
    if (prop.type === 'BOOLEAN') {
      component.addComponentProperty(prop.name, 'BOOLEAN', prop.defaultValue ?? true);
    } else if (prop.type === 'TEXT') {
      component.addComponentProperty(prop.name, 'TEXT', prop.defaultValue ?? '');
    } else if (prop.type === 'INSTANCE_SWAP') {
      component.addComponentProperty(prop.name, 'INSTANCE_SWAP', '');
    } else if (prop.type === 'VARIANT') {
      component.addComponentProperty(prop.name, 'VARIANT', prop.defaultValue ?? '');
    }
  }

  return {
    success: true,
    componentId: component.id,
    propertiesCount: payload.properties.length
  };
}

interface CreateEllipsePayload {
  name?: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  fills?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number }; opacity?: number }>;
  strokes?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number }; opacity?: number }>;
  strokeWeight?: number;
}

async function createEllipse(payload: CreateEllipsePayload): Promise<{ id: string; name: string }> {
  const ellipse = figma.createEllipse();

  if (payload.name) ellipse.name = payload.name;
  ellipse.resize(payload.width, payload.height);
  if (payload.x !== undefined) ellipse.x = payload.x;
  if (payload.y !== undefined) ellipse.y = payload.y;
  if (payload.fills) ellipse.fills = payload.fills;
  if (payload.strokes) ellipse.strokes = payload.strokes;
  if (payload.strokeWeight !== undefined) ellipse.strokeWeight = payload.strokeWeight;

  return {
    id: ellipse.id,
    name: ellipse.name
  };
}

interface CreateVectorPayload {
  name?: string;
  x?: number;
  y?: number;
  vectorPaths: Array<{ windingRule: 'NONE' | 'NONZERO' | 'EVENODD'; data: string }>;
  fills?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number }; opacity?: number }>;
  strokes?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number }; opacity?: number }>;
  strokeWeight?: number;
  strokeCap?: 'NONE' | 'ROUND' | 'SQUARE' | 'ARROW_LINES' | 'ARROW_EQUILATERAL';
}

async function createVector(payload: CreateVectorPayload): Promise<{ id: string; name: string }> {
  const vector = figma.createVector();

  if (payload.name) vector.name = payload.name;
  if (payload.x !== undefined) vector.x = payload.x;
  if (payload.y !== undefined) vector.y = payload.y;
  vector.vectorPaths = payload.vectorPaths;
  if (payload.fills) vector.fills = payload.fills;
  if (payload.strokes) vector.strokes = payload.strokes;
  if (payload.strokeWeight !== undefined) vector.strokeWeight = payload.strokeWeight;
  if (payload.strokeCap) vector.strokeCap = payload.strokeCap;

  return {
    id: vector.id,
    name: vector.name
  };
}

interface CreateLinePayload {
  name?: string;
  x?: number;
  y?: number;
  length: number;
  rotation?: number;
  strokes?: Array<{ type: 'SOLID'; color: { r: number; g: number; b: number }; opacity?: number }>;
  strokeWeight?: number;
  strokeCap?: 'NONE' | 'ROUND' | 'SQUARE';
}

async function createLine(payload: CreateLinePayload): Promise<{ id: string; name: string }> {
  const line = figma.createLine();

  if (payload.name) line.name = payload.name;
  line.resize(payload.length, 0);
  if (payload.x !== undefined) line.x = payload.x;
  if (payload.y !== undefined) line.y = payload.y;
  if (payload.rotation !== undefined) line.rotation = payload.rotation;
  if (payload.strokes) line.strokes = payload.strokes;
  if (payload.strokeWeight !== undefined) line.strokeWeight = payload.strokeWeight;
  if (payload.strokeCap) line.strokeCap = payload.strokeCap;

  return {
    id: line.id,
    name: line.name
  };
}

// ============================================================================
// QUERY OPERATIONS
// ============================================================================

async function getVariableCollections(): Promise<Array<{ id: string; name: string; modes: Array<{ modeId: string; name: string }> }>> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  return collections.map(c => ({
    id: c.id,
    name: c.name,
    modes: c.modes.map(m => ({ modeId: m.modeId, name: m.name }))
  }));
}

interface GetVariablesPayload {
  collectionId?: string;
}

async function getVariables(payload: GetVariablesPayload): Promise<Array<{ id: string; name: string; resolvedType: string; collectionId: string }>> {
  const variables = await figma.variables.getLocalVariablesAsync();

  let filtered = variables;
  if (payload.collectionId) {
    filtered = variables.filter(v => v.variableCollectionId === payload.collectionId);
  }

  return filtered.map(v => ({
    id: v.id,
    name: v.name,
    resolvedType: v.resolvedType,
    collectionId: v.variableCollectionId
  }));
}

// Detailed version with scopes and values
interface GetVarsDetailedPayload {
  collectionId: string;
}

async function getVarsDetailed(payload: GetVarsDetailedPayload): Promise<Array<{
  id: string;
  name: string;
  resolvedType: string;
  scopes: VariableScope[];
  valuesByMode: Record<string, unknown>;
}>> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
  if (!collection) {
    throw new Error(`Collection not found: ${payload.collectionId}`);
  }

  const variables = await figma.variables.getLocalVariablesAsync();
  const collectionVars = variables.filter(v => v.variableCollectionId === payload.collectionId);

  return collectionVars.map(v => {
    const valuesByMode: Record<string, unknown> = {};
    for (const mode of collection.modes) {
      const modeValues = v.valuesByMode;
      const val = modeValues[mode.modeId];
      // Check if it's a variable alias
      if (val && typeof val === 'object' && 'type' in val && val.type === 'VARIABLE_ALIAS') {
        valuesByMode[mode.modeId] = { type: 'VARIABLE_ALIAS', id: (val as VariableAlias).id };
      } else {
        valuesByMode[mode.modeId] = val;
      }
    }
    return {
      id: v.id,
      name: v.name,
      resolvedType: v.resolvedType,
      scopes: v.scopes,
      valuesByMode
    };
  });
}

async function getLocalStyles(): Promise<{ paintStyles: Array<{ id: string; name: string }>; textStyles: Array<{ id: string; name: string }>; effectStyles: Array<{ id: string; name: string }> }> {
  const [paintStyles, textStyles, effectStyles] = await Promise.all([
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync()
  ]);

  return {
    paintStyles: paintStyles.map(s => ({ id: s.id, name: s.name })),
    textStyles: textStyles.map(s => ({ id: s.id, name: s.name })),
    effectStyles: effectStyles.map(s => ({ id: s.id, name: s.name }))
  };
}

interface GridStyleInfo {
  id: string;
  name: string;
  layoutGrids: Array<{
    pattern: string;
    alignment?: string;
    count?: number;
    gutterSize?: number;
    offset?: number;
    sectionSize?: number;
    visible: boolean;
  }>;
}

async function getGridStyles(): Promise<{ gridStyles: GridStyleInfo[] }> {
  const gridStyles = await figma.getLocalGridStylesAsync();
  
  return {
    gridStyles: gridStyles.map(s => ({
      id: s.id,
      name: s.name,
      layoutGrids: s.layoutGrids.map(grid => {
        if (grid.pattern === 'GRID') {
          return {
            pattern: grid.pattern,
            sectionSize: (grid as GridLayoutGrid).sectionSize,
            visible: grid.visible
          };
        } else {
          const rowColGrid = grid as RowsColsLayoutGrid;
          return {
            pattern: grid.pattern,
            alignment: rowColGrid.alignment,
            count: rowColGrid.count,
            gutterSize: rowColGrid.gutterSize,
            offset: rowColGrid.offset,
            sectionSize: rowColGrid.sectionSize,
            visible: grid.visible
          };
        }
      })
    }))
  };
}

function getFileInfo(): { name: string; id: string | null; currentPage: string; pageCount: number } {
  return {
    name: figma.root.name,
    id: figma.fileKey,
    currentPage: figma.currentPage.name,
    pageCount: figma.root.children.length
  };
}

function getSelection(): Array<{ id: string; name: string; type: string }> {
  return figma.currentPage.selection.map(node => ({
    id: node.id,
    name: node.name,
    type: node.type
  }));
}

// ============================================================================
// PUBLISHING OPERATIONS
// ============================================================================

interface HideCollectionPayload {
  collectionId: string;
  hide?: boolean;  // true to hide, false to show (default: true)
}

async function hideCollectionFromPublishing(payload: HideCollectionPayload): Promise<{ success: boolean; collectionId: string; hidden: boolean }> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
  if (!collection) {
    throw new Error(`Collection not found: ${payload.collectionId}`);
  }

  const hide = payload.hide !== false;  // default to true
  collection.hiddenFromPublishing = hide;

  return {
    success: true,
    collectionId: collection.id,
    hidden: hide
  };
}

interface RenameCollectionPayload {
  collectionId: string;
  name: string;
}

async function renameCollection(payload: RenameCollectionPayload): Promise<{ success: boolean; collectionId: string; name: string }> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
  if (!collection) {
    throw new Error(`Collection not found: ${payload.collectionId}`);
  }

  collection.name = payload.name;

  return {
    success: true,
    collectionId: collection.id,
    name: collection.name
  };
}

interface DeleteCollectionPayload {
  collectionId: string;
}

async function deleteCollection(payload: DeleteCollectionPayload): Promise<{ success: boolean; deletedId: string }> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
  if (!collection) {
    throw new Error(`Collection not found: ${payload.collectionId}`);
  }

  collection.remove();

  return {
    success: true,
    deletedId: payload.collectionId
  };
}

// ============================================================================
// MODE BINDING OPERATIONS
// ============================================================================

interface SetExplicitVariableModesPayload {
  nodeId: string;
  modeBindings: Array<{ collectionId: string; modeId: string }>;
}

async function setExplicitVariableModes(payload: SetExplicitVariableModesPayload): Promise<{ success: boolean; nodeId: string; bindings: number }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (!('setExplicitVariableModeForCollection' in node)) {
    throw new Error(`Node type ${node.type} does not support explicit variable modes`);
  }

  const frameNode = node as FrameNode | ComponentNode | InstanceNode;

  // Set each mode binding using the method
  for (const binding of payload.modeBindings) {
    const collection = await figma.variables.getVariableCollectionByIdAsync(binding.collectionId);
    if (collection) {
      frameNode.setExplicitVariableModeForCollection(collection, binding.modeId);
    }
  }

  return {
    success: true,
    nodeId: node.id,
    bindings: payload.modeBindings.length
  };
}

interface GetExplicitVariableModesPayload {
  nodeId: string;
}

async function getExplicitVariableModes(payload: GetExplicitVariableModesPayload): Promise<{ nodeId: string; modes: { [collectionId: string]: string } }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (!('explicitVariableModes' in node)) {
    throw new Error(`Node type ${node.type} does not support explicit variable modes`);
  }

  const frameNode = node as FrameNode | ComponentNode | InstanceNode;

  return {
    nodeId: node.id,
    modes: frameNode.explicitVariableModes || {}
  };
}

interface ClearExplicitVariableModesPayload {
  nodeId: string;
  collectionIds?: string[];  // If provided, only clear these; otherwise clear all
}

async function clearExplicitVariableModes(payload: ClearExplicitVariableModesPayload): Promise<{ success: boolean; nodeId: string; cleared: number }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (!('clearExplicitVariableModeForCollection' in node)) {
    throw new Error(`Node type ${node.type} does not support explicit variable modes`);
  }

  const frameNode = node as FrameNode | ComponentNode | InstanceNode;
  let cleared = 0;

  if (payload.collectionIds && payload.collectionIds.length > 0) {
    // Clear specific collections
    for (const collId of payload.collectionIds) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(collId);
      if (collection) {
        frameNode.clearExplicitVariableModeForCollection(collection);
        cleared++;
      }
    }
  } else {
    // Clear all - get current bindings and clear each
    const currentModes = frameNode.explicitVariableModes || {};
    for (const collId of Object.keys(currentModes)) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(collId);
      if (collection) {
        frameNode.clearExplicitVariableModeForCollection(collection);
        cleared++;
      }
    }
  }

  return {
    success: true,
    nodeId: node.id,
    cleared
  };
}

interface CreateModeSwitchingFramesPayload {
  pageId?: string;
  createThemeFrames?: boolean;
  createDeviceFrames?: boolean;
}

async function createModeSwitchingFrames(payload: CreateModeSwitchingFramesPayload): Promise<{
  success: boolean;
  themeFrames?: Array<{ id: string; name: string; mode: string }>;
  deviceFrames?: Array<{ id: string; name: string; mode: string }>;
}> {
  // Get all collections to find theme and device collections
  const collections = await figma.variables.getLocalVariableCollectionsAsync();

  const themeCollections: Array<{ id: string; lightModeId: string; darkModeId: string }> = [];
  const deviceCollections: Array<{ id: string; desktopModeId: string; tabletModeId: string; mobileModeId: string }> = [];

  for (const c of collections) {
    const modeNames = c.modes.map(m => m.name);

    // Check if it's a theme collection (Light/Dark)
    if (modeNames.includes('Light') && modeNames.includes('Dark')) {
      const lightMode = c.modes.find(m => m.name === 'Light');
      const darkMode = c.modes.find(m => m.name === 'Dark');
      if (lightMode && darkMode) {
        themeCollections.push({
          id: c.id,
          lightModeId: lightMode.modeId,
          darkModeId: darkMode.modeId
        });
      }
    }

    // Check if it's a device collection (Desktop/Tablet/Mobile)
    if (modeNames.includes('Desktop') && modeNames.includes('Mobile')) {
      const desktopMode = c.modes.find(m => m.name === 'Desktop');
      const tabletMode = c.modes.find(m => m.name === 'Tablet');
      const mobileMode = c.modes.find(m => m.name === 'Mobile');
      if (desktopMode && mobileMode) {
        deviceCollections.push({
          id: c.id,
          desktopModeId: desktopMode.modeId,
          tabletModeId: tabletMode?.modeId || desktopMode.modeId,
          mobileModeId: mobileMode.modeId
        });
      }
    }
  }

  const result: {
    success: boolean;
    themeFrames?: Array<{ id: string; name: string; mode: string }>;
    deviceFrames?: Array<{ id: string; name: string; mode: string }>;
  } = { success: true };

  // Create theme frames (Light / Dark)
  if (payload.createThemeFrames !== false && themeCollections.length > 0) {
    result.themeFrames = [];

    // Light mode frame
    const lightFrame = figma.createFrame();
    lightFrame.name = '🌞 Light Mode';
    lightFrame.resize(400, 300);
    lightFrame.x = 0;
    lightFrame.y = 0;

    for (const tc of themeCollections) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(tc.id);
      if (collection) {
        lightFrame.setExplicitVariableModeForCollection(collection, tc.lightModeId);
      }
    }
    result.themeFrames.push({ id: lightFrame.id, name: lightFrame.name, mode: 'Light' });

    // Dark mode frame
    const darkFrame = figma.createFrame();
    darkFrame.name = '🌙 Dark Mode';
    darkFrame.resize(400, 300);
    darkFrame.x = 450;
    darkFrame.y = 0;

    for (const tc of themeCollections) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(tc.id);
      if (collection) {
        darkFrame.setExplicitVariableModeForCollection(collection, tc.darkModeId);
      }
    }
    result.themeFrames.push({ id: darkFrame.id, name: darkFrame.name, mode: 'Dark' });
  }

  // Create device frames (Desktop / Tablet / Mobile)
  if (payload.createDeviceFrames !== false && deviceCollections.length > 0) {
    result.deviceFrames = [];

    // Desktop frame
    const desktopFrame = figma.createFrame();
    desktopFrame.name = '🖥️ Desktop';
    desktopFrame.resize(1440, 900);
    desktopFrame.x = 0;
    desktopFrame.y = 400;

    for (const dc of deviceCollections) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(dc.id);
      if (collection) {
        desktopFrame.setExplicitVariableModeForCollection(collection, dc.desktopModeId);
      }
    }
    result.deviceFrames.push({ id: desktopFrame.id, name: desktopFrame.name, mode: 'Desktop' });

    // Tablet frame
    const tabletFrame = figma.createFrame();
    tabletFrame.name = '📱 Tablet';
    tabletFrame.resize(768, 1024);
    tabletFrame.x = 1500;
    tabletFrame.y = 400;

    for (const dc of deviceCollections) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(dc.id);
      if (collection) {
        tabletFrame.setExplicitVariableModeForCollection(collection, dc.tabletModeId);
      }
    }
    result.deviceFrames.push({ id: tabletFrame.id, name: tabletFrame.name, mode: 'Tablet' });

    // Mobile frame
    const mobileFrame = figma.createFrame();
    mobileFrame.name = '📱 Mobile';
    mobileFrame.resize(375, 812);
    mobileFrame.x = 2350;
    mobileFrame.y = 400;

    for (const dc of deviceCollections) {
      const collection = await figma.variables.getVariableCollectionByIdAsync(dc.id);
      if (collection) {
        mobileFrame.setExplicitVariableModeForCollection(collection, dc.mobileModeId);
      }
    }
    result.deviceFrames.push({ id: mobileFrame.id, name: mobileFrame.name, mode: 'Mobile' });
  }

  return result;
}

// ============================================================================
// NODE QUERY AND MOVE OPERATIONS
// ============================================================================

interface GetPageChildrenPayload {
  pageId?: string;
  types?: string[];  // Filter by node types like 'COMPONENT', 'FRAME', etc.
}

async function getPageChildren(payload: GetPageChildrenPayload): Promise<{ id: string; name: string; type: string; x: number; y: number; width: number; height: number }[]> {
  let page: PageNode;

  if (payload.pageId) {
    const foundPage = figma.root.children.find(p => p.id === payload.pageId);
    if (!foundPage) {
      throw new Error(`Page not found: ${payload.pageId}`);
    }
    // Load the page if not current
    if (foundPage.id !== figma.currentPage.id) {
      await foundPage.loadAsync();
    }
    page = foundPage;
  } else {
    page = figma.currentPage;
  }

  const children = page.children.map(node => ({
    id: node.id,
    name: node.name,
    type: node.type,
    x: 'x' in node ? node.x : 0,
    y: 'y' in node ? node.y : 0,
    width: 'width' in node ? node.width : 0,
    height: 'height' in node ? node.height : 0
  }));

  if (payload.types && payload.types.length > 0) {
    return children.filter(c => payload.types!.includes(c.type));
  }

  return children;
}

async function getLocalComponents(): Promise<{ id: string; name: string; key: string; description: string; x: number; y: number; pageId: string; pageName: string }[]> {
  const components: { id: string; name: string; key: string; description: string; x: number; y: number; pageId: string; pageName: string }[] = [];

  // Load all pages first
  await figma.loadAllPagesAsync();

  // Search all pages for components
  for (const page of figma.root.children) {
    function findComponents(node: SceneNode): void {
      if (node.type === 'COMPONENT') {
        components.push({
          id: node.id,
          name: node.name,
          key: node.key,
          description: node.description || '',
          x: node.x,
          y: node.y,
          pageId: page.id,
          pageName: page.name
        });
      }
      if ('children' in node) {
        for (const child of node.children) {
          findComponents(child);
        }
      }
    }

    for (const child of page.children) {
      findComponents(child);
    }
  }

  return components;
}

interface MoveNodeToPagePayload {
  nodeId: string;
  targetPageId: string;
  x?: number;
  y?: number;
}

async function moveNodeToPage(payload: MoveNodeToPagePayload): Promise<{ id: string; name: string; newPageId: string }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (!('parent' in node) || node.type === 'PAGE' || node.type === 'DOCUMENT') {
    throw new Error(`Cannot move node of type: ${node.type}`);
  }

  const targetPage = figma.root.children.find(p => p.id === payload.targetPageId);
  if (!targetPage) {
    throw new Error(`Target page not found: ${payload.targetPageId}`);
  }

  // Cast to SceneNode since we've verified it's moveable
  const sceneNode = node as SceneNode;

  // Store position
  const newX = payload.x !== undefined ? payload.x : ('x' in sceneNode ? sceneNode.x : 0);
  const newY = payload.y !== undefined ? payload.y : ('y' in sceneNode ? sceneNode.y : 0);

  // Move node to new page
  targetPage.appendChild(sceneNode);

  // Set position
  if ('x' in sceneNode && 'y' in sceneNode) {
    sceneNode.x = newX;
    sceneNode.y = newY;
  }

  return {
    id: sceneNode.id,
    name: sceneNode.name,
    newPageId: targetPage.id
  };
}

interface CloneNodeToPagePayload {
  nodeId: string;
  targetPageId: string;
  x?: number;
  y?: number;
}

async function cloneNodeToPage(payload: CloneNodeToPagePayload): Promise<{ id: string; name: string; originalId: string; newPageId: string }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (!('clone' in node)) {
    throw new Error(`Cannot clone node of type: ${node.type}`);
  }

  const targetPage = figma.root.children.find(p => p.id === payload.targetPageId);
  if (!targetPage) {
    throw new Error(`Target page not found: ${payload.targetPageId}`);
  }

  // Clone the node
  const sceneNode = node as SceneNode;
  const cloned = sceneNode.clone();

  // Add to target page
  targetPage.appendChild(cloned);

  // Set position
  if ('x' in cloned && 'y' in cloned) {
    cloned.x = payload.x !== undefined ? payload.x : ('x' in sceneNode ? sceneNode.x : 0);
    cloned.y = payload.y !== undefined ? payload.y : ('y' in sceneNode ? sceneNode.y : 0);
  }

  return {
    id: cloned.id,
    name: cloned.name,
    originalId: payload.nodeId,
    newPageId: targetPage.id
  };
}

interface DeleteNodePayload {
  nodeId: string;
}

async function deleteNode(payload: DeleteNodePayload): Promise<{ success: boolean; deletedId: string }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (node.type === 'DOCUMENT' || node.type === 'PAGE') {
    throw new Error(`Cannot delete node of type: ${node.type}`);
  }

  const sceneNode = node as SceneNode;
  sceneNode.remove();

  return {
    success: true,
    deletedId: payload.nodeId
  };
}

async function clearPageChildren(payload: { pageName?: string }): Promise<{ success: boolean; deletedCount: number }> {
  let page: PageNode | undefined;
  if (payload.pageName) {
    page = figma.root.children.find(p => p.name === payload.pageName);
  } else {
    page = figma.currentPage;
  }
  if (!page) throw new Error(`Page not found: ${payload.pageName || 'current'}`);

  const children = [...page.children];
  let count = 0;
  for (const child of children) {
    child.remove();
    count++;
  }
  return { success: true, deletedCount: count };
}

interface GetNodeInfoPayload {
  nodeId: string;
}

async function getNodeInfo(payload: GetNodeInfoPayload): Promise<Record<string, unknown>> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  const info: Record<string, unknown> = {
    id: node.id,
    name: node.name,
    type: node.type
  };

  if ('x' in node) info.x = node.x;
  if ('y' in node) info.y = node.y;
  if ('width' in node) info.width = node.width;
  if ('height' in node) info.height = node.height;
  if ('parent' in node && node.parent) {
    info.parentId = node.parent.id;
    info.parentName = node.parent.name;
    info.parentType = node.parent.type;
  }
  if (node.type === 'COMPONENT') {
    info.key = (node as ComponentNode).key;
    info.description = (node as ComponentNode).description;
  }

  return info;
}

// ============================================================================
// NODE POSITION AND PARENT MANIPULATION
// ============================================================================

interface SetNodePositionPayload {
  nodeId: string;
  x: number;
  y: number;
}

async function setNodePosition(payload: SetNodePositionPayload): Promise<{ id: string; x: number; y: number }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (!('x' in node) || !('y' in node)) {
    throw new Error(`Node type ${node.type} does not support positioning`);
  }

  const sceneNode = node as SceneNode;
  sceneNode.x = payload.x;
  sceneNode.y = payload.y;

  return {
    id: sceneNode.id,
    x: sceneNode.x,
    y: sceneNode.y
  };
}

interface AppendNodeToFramePayload {
  nodeId: string;
  frameId: string;
  x?: number;
  y?: number;
}

async function appendNodeToFrame(payload: AppendNodeToFramePayload): Promise<{ id: string; parentId: string; x: number; y: number }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  const frame = await figma.getNodeByIdAsync(payload.frameId);
  if (!frame) {
    throw new Error(`Frame not found: ${payload.frameId}`);
  }

  if (frame.type !== 'FRAME' && frame.type !== 'GROUP' && frame.type !== 'COMPONENT') {
    throw new Error(`Target must be FRAME, GROUP, or COMPONENT. Got: ${frame.type}`);
  }

  if (!('parent' in node) || node.type === 'PAGE' || node.type === 'DOCUMENT') {
    throw new Error(`Cannot move node of type: ${node.type}`);
  }

  const sceneNode = node as SceneNode;
  const containerNode = frame as FrameNode | GroupNode | ComponentNode;

  // Append to frame
  containerNode.appendChild(sceneNode);

  // Set position if provided
  if (payload.x !== undefined) sceneNode.x = payload.x;
  if (payload.y !== undefined) sceneNode.y = payload.y;

  return {
    id: sceneNode.id,
    parentId: containerNode.id,
    x: sceneNode.x,
    y: sceneNode.y
  };
}

interface ResizeNodePayload {
  nodeId: string;
  width?: number;
  height?: number;
}

async function resizeNode(payload: ResizeNodePayload): Promise<{ id: string; width: number; height: number }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (!('resize' in node)) {
    throw new Error(`Node type ${node.type} does not support resizing`);
  }

  const resizable = node as FrameNode | ComponentNode | InstanceNode | RectangleNode;

  const newWidth = payload.width !== undefined ? payload.width : resizable.width;
  const newHeight = payload.height !== undefined ? payload.height : resizable.height;

  resizable.resize(newWidth, newHeight);

  return {
    id: resizable.id,
    width: resizable.width,
    height: resizable.height
  };
}

interface SetAutoLayoutPayload {
  nodeId: string;
  layoutMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  counterAxisSpacing?: number;
  layoutWrap?: 'NO_WRAP' | 'WRAP';
}

// --- Bulk Creation Interfaces ---

interface ColorSwatchData {
  variableId: string;
  name: string;
  description: string;
}

interface CreateColorSwatchesGroupPayload {
  name: string; // Group name
  swatches: ColorSwatchData[];
  parentFrameId: string;
}

async function createColorSwatchesGroup(payload: CreateColorSwatchesGroupPayload): Promise<void> {
  const parent = await figma.getNodeByIdAsync(payload.parentFrameId) as FrameNode;
  if (!parent) throw new Error(`Parent frame not found: ${payload.parentFrameId}`);

  // Group Frame
  const groupFrame = figma.createFrame();
  groupFrame.name = payload.name;
  groupFrame.layoutMode = 'VERTICAL';
  groupFrame.itemSpacing = 20;
  groupFrame.primaryAxisSizingMode = 'AUTO';
  groupFrame.counterAxisSizingMode = 'AUTO';
  groupFrame.fills = [];
  parent.appendChild(groupFrame);

  // Title
  const title = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  title.fontName = { family: "Inter", style: "Bold" };
  title.characters = payload.name.charAt(0).toUpperCase() + payload.name.slice(1);
  title.fontSize = 24;
  groupFrame.appendChild(title);

  // Swatches Container
  const swatchesContainer = figma.createFrame();
  swatchesContainer.name = "Swatches";
  swatchesContainer.layoutMode = 'HORIZONTAL';
  swatchesContainer.layoutWrap = 'WRAP';
  swatchesContainer.itemSpacing = 20;
  swatchesContainer.counterAxisSpacing = 20;
  swatchesContainer.primaryAxisSizingMode = 'AUTO';
  swatchesContainer.counterAxisSizingMode = 'AUTO';
  swatchesContainer.fills = [];
  groupFrame.appendChild(swatchesContainer);

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  for (const swatch of payload.swatches) {
    // Item Frame
    const item = figma.createFrame();
    item.name = "Item";
    item.layoutMode = 'VERTICAL';
    item.itemSpacing = 8;
    item.primaryAxisSizingMode = 'AUTO';
    item.counterAxisSizingMode = 'AUTO';
    item.fills = [];
    swatchesContainer.appendChild(item);

    // Color Rect
    const rect = figma.createRectangle();
    rect.resize(80, 80);
    rect.cornerRadius = 8;

    // Bind Variable to Paint
    const variable = await figma.variables.getVariableByIdAsync(swatch.variableId);
    if (variable) {
      // Create a solid paint and bind the variable to it
      const paint: SolidPaint = {
        type: 'SOLID',
        color: { r: 1, g: 1, b: 1 }, // Default color, will be overridden by variable
        boundVariables: {
          color: {
            type: 'VARIABLE_ALIAS',
            id: variable.id
          }
        }
      };
      rect.fills = [paint];
    }
    item.appendChild(rect);

    // Name
    const nameText = figma.createText();
    nameText.characters = swatch.name;
    nameText.fontName = { family: "Inter", style: "Bold" };
    nameText.fontSize = 14;
    item.appendChild(nameText);

    // Description
    const descText = figma.createText();
    descText.characters = swatch.description;
    descText.fontName = { family: "Inter", style: "Regular" };
    descText.fontSize = 10;
    descText.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
    item.appendChild(descText);
  }
}

interface TypographyStyleData {
  id: string;
  name: string;
  fontSize: number;
  fontName: { family: string; style: string };
}

interface CreateTypographyGroupPayload {
  name: string;
  styles: TypographyStyleData[];
  parentFrameId: string;
}

async function createTypographyGroup(payload: CreateTypographyGroupPayload): Promise<void> {
  const parent = await figma.getNodeByIdAsync(payload.parentFrameId) as FrameNode;
  if (!parent) throw new Error(`Parent frame not found: ${payload.parentFrameId}`);

  // Group Frame
  const groupFrame = figma.createFrame();
  groupFrame.name = payload.name;
  groupFrame.layoutMode = 'VERTICAL';
  groupFrame.itemSpacing = 20;
  groupFrame.primaryAxisSizingMode = 'AUTO';
  groupFrame.counterAxisSizingMode = 'AUTO';
  groupFrame.fills = [];
  parent.appendChild(groupFrame);

  // Title
  const title = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  title.fontName = { family: "Inter", style: "Bold" };
  title.characters = payload.name;
  title.fontSize = 24;
  groupFrame.appendChild(title);

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  for (const style of payload.styles) {
    // Row
    const row = figma.createFrame();
    row.name = style.name;
    row.layoutMode = 'HORIZONTAL';
    row.itemSpacing = 40;
    row.primaryAxisSizingMode = 'AUTO';
    row.counterAxisSizingMode = 'AUTO';
    row.fills = [];
    groupFrame.appendChild(row);

    // Info Column
    const info = figma.createFrame();
    info.name = "Info";
    info.layoutMode = 'VERTICAL';
    info.itemSpacing = 4;
    info.primaryAxisSizingMode = 'AUTO';
    info.counterAxisSizingMode = 'AUTO';
    info.fills = [];
    row.appendChild(info);

    const nameText = figma.createText();
    nameText.characters = style.name;
    nameText.fontName = { family: "Inter", style: "Bold" };
    nameText.fontSize = 16;
    info.appendChild(nameText);

    const metaText = figma.createText();
    metaText.characters = `${style.fontSize}px • ${style.fontName.family} ${style.fontName.style}`;
    metaText.fontName = { family: "Inter", style: "Regular" };
    metaText.fontSize = 12;
    metaText.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
    info.appendChild(metaText);

    // Sample Text
    const sampleText = figma.createText();
    await figma.loadFontAsync(style.fontName); // Load the style's font
    sampleText.fontName = style.fontName;
    sampleText.fontSize = style.fontSize;
    sampleText.characters = "The quick brown fox jumps over the lazy dog.";
    // Try to apply text style if possible, but fontName/fontSize is manual
    // If we have style ID, we can try setting it, but async loading might be tricky.
    // For now, manual properties are safer.
    row.appendChild(sampleText);
  }
}

interface EffectStyleData {
  id: string;
  name: string;
  description: string;
}

interface CreateEffectGroupPayload {
  name: string;
  styles: EffectStyleData[];
  parentFrameId: string;
}

async function createEffectGroup(payload: CreateEffectGroupPayload): Promise<void> {
  const parent = await figma.getNodeByIdAsync(payload.parentFrameId) as FrameNode;
  if (!parent) throw new Error(`Parent frame not found: ${payload.parentFrameId}`);

  // Group Frame
  const groupFrame = figma.createFrame();
  groupFrame.name = payload.name;
  groupFrame.layoutMode = 'VERTICAL';
  groupFrame.itemSpacing = 20;
  groupFrame.primaryAxisSizingMode = 'AUTO';
  groupFrame.counterAxisSizingMode = 'AUTO';
  groupFrame.fills = [];
  parent.appendChild(groupFrame);

  // Title
  const title = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  title.fontName = { family: "Inter", style: "Bold" };
  title.characters = payload.name;
  title.fontSize = 24;
  groupFrame.appendChild(title);

  // Grid of Cards
  const grid = figma.createFrame();
  grid.name = "Grid";
  grid.layoutMode = 'HORIZONTAL';
  grid.layoutWrap = 'WRAP';
  grid.itemSpacing = 40;
  grid.counterAxisSpacing = 40;
  grid.primaryAxisSizingMode = 'AUTO';
  grid.counterAxisSizingMode = 'AUTO';
  grid.fills = [];
  groupFrame.appendChild(grid);

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  for (const style of payload.styles) {
    const card = figma.createFrame();
    card.name = "Card";
    card.layoutMode = 'VERTICAL';
    card.itemSpacing = 16;
    card.primaryAxisSizingMode = 'AUTO';
    card.counterAxisSizingMode = 'AUTO';
    card.fills = [];
    grid.appendChild(card);

    // Preview Box
    const rect = figma.createRectangle();
    rect.resize(120, 120);
    rect.cornerRadius = 8;
    rect.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    await rect.setEffectStyleIdAsync(style.id); // Apply effect style (async required)
    card.appendChild(rect);

    // Label
    const nameText = figma.createText();
    nameText.characters = style.name;
    nameText.fontName = { family: "Inter", style: "Bold" };
    nameText.fontSize = 16;
    card.appendChild(nameText);
  }
}

interface GridStyleData {
  id: string;
  name: string;
}

interface CreateGridGroupPayload {
  name: string;
  styles: GridStyleData[];
  parentFrameId: string;
}

async function createGridGroup(payload: CreateGridGroupPayload): Promise<void> {
  const parent = await figma.getNodeByIdAsync(payload.parentFrameId) as FrameNode;
  if (!parent) throw new Error(`Parent frame not found: ${payload.parentFrameId}`);

  // Group Frame
  const groupFrame = figma.createFrame();
  groupFrame.name = payload.name;
  groupFrame.layoutMode = 'VERTICAL';
  groupFrame.itemSpacing = 20;
  groupFrame.primaryAxisSizingMode = 'AUTO';
  groupFrame.counterAxisSizingMode = 'AUTO';
  groupFrame.fills = [];
  parent.appendChild(groupFrame);

  // Title
  const title = figma.createText();
  await figma.loadFontAsync({ family: "Inter", style: "Bold" });
  title.fontName = { family: "Inter", style: "Bold" };
  title.characters = payload.name;
  title.fontSize = 24;
  groupFrame.appendChild(title);

  await figma.loadFontAsync({ family: "Inter", style: "Regular" });

  for (const style of payload.styles) {
    const row = figma.createFrame();
    row.name = style.name;
    row.layoutMode = 'VERTICAL';
    row.itemSpacing = 8;
    row.primaryAxisSizingMode = 'AUTO';
    row.counterAxisSizingMode = 'AUTO';
    row.fills = [];
    groupFrame.appendChild(row);

    const nameText = figma.createText();
    nameText.characters = style.name;
    nameText.fontName = { family: "Inter", style: "Bold" };
    nameText.fontSize = 18;
    row.appendChild(nameText);

    // Preview Frame
    const preview = figma.createFrame();
    preview.name = "Preview";
    preview.resize(800, 100);
    preview.gridStyleId = style.id; // Apply grid style
    // Add a stroke so we can see the frame bounds
    preview.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
    row.appendChild(preview);
  }
}


async function setAutoLayout(payload: SetAutoLayoutPayload): Promise<{ id: string; layoutMode: string }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (node.type !== 'FRAME' && node.type !== 'COMPONENT') {
    throw new Error(`Auto-layout only works on FRAME or COMPONENT. Got: ${node.type}`);
  }

  const frame = node as FrameNode | ComponentNode;

  frame.layoutMode = payload.layoutMode;

  if (payload.primaryAxisSizingMode) {
    frame.primaryAxisSizingMode = payload.primaryAxisSizingMode;
  }
  if (payload.counterAxisSizingMode) {
    frame.counterAxisSizingMode = payload.counterAxisSizingMode;
  }
  if (payload.paddingLeft !== undefined) frame.paddingLeft = payload.paddingLeft;
  if (payload.paddingRight !== undefined) frame.paddingRight = payload.paddingRight;
  if (payload.paddingTop !== undefined) frame.paddingTop = payload.paddingTop;
  if (payload.paddingBottom !== undefined) frame.paddingBottom = payload.paddingBottom;
  if (payload.itemSpacing !== undefined) frame.itemSpacing = payload.itemSpacing;
  if (payload.counterAxisSpacing !== undefined) frame.counterAxisSpacing = payload.counterAxisSpacing;
  if (payload.layoutWrap) frame.layoutWrap = payload.layoutWrap;

  return {
    id: frame.id,
    layoutMode: frame.layoutMode
  };
}

// ============================================================================
// VARIABLE BINDING TO NODES
// ============================================================================

interface BindVariableToNodePayload {
  nodeId: string;
  variableId?: string;
  variableName?: string;  // Alternative: lookup by name
  field: 'fills' | 'strokes' | 'width' | 'height' | 'paddingLeft' | 'paddingRight' | 'paddingTop' | 'paddingBottom' | 'itemSpacing' | 'cornerRadius';
}

async function bindVariableToNode(payload: BindVariableToNodePayload): Promise<{ id: string; field: string; variableId: string }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  let variable: Variable | null = null;

  // Support lookup by ID or by name
  if (payload.variableId) {
    variable = await figma.variables.getVariableByIdAsync(payload.variableId);
  } else if (payload.variableName) {
    // Search all variables by name
    const allVariables = await figma.variables.getLocalVariablesAsync();
    variable = allVariables.find(v => v.name === payload.variableName) || null;
  }

  if (!variable) {
    throw new Error(`Variable not found: ${payload.variableId || payload.variableName}`);
  }

  const sceneNode = node as SceneNode;

  switch (payload.field) {
    case 'fills':
      if ('fills' in sceneNode && Array.isArray(sceneNode.fills) && sceneNode.fills.length > 0) {
        // Use setBoundVariable for fill color
        const fillsCopy = figma.variables.setBoundVariableForPaint(
          sceneNode.fills[0] as SolidPaint,
          'color',
          variable
        );
        (sceneNode as GeometryMixin).fills = [fillsCopy];
      }
      break;
    case 'strokes':
      if ('strokes' in sceneNode && Array.isArray(sceneNode.strokes) && sceneNode.strokes.length > 0) {
        const strokesCopy = figma.variables.setBoundVariableForPaint(
          sceneNode.strokes[0] as SolidPaint,
          'color',
          variable
        );
        (sceneNode as GeometryMixin).strokes = [strokesCopy];
      }
      break;
    case 'width':
    case 'height':
    case 'paddingLeft':
    case 'paddingRight':
    case 'paddingTop':
    case 'paddingBottom':
    case 'itemSpacing':
    case 'cornerRadius':
      if (payload.field in sceneNode) {
        sceneNode.setBoundVariable(payload.field as VariableBindableNodeField, variable);
      }
      break;
  }

  return {
    id: sceneNode.id,
    field: payload.field,
    variableId: variable.id
  };
}

interface SetNodeFillsPayload {
  nodeId: string;
  fills: Array<{
    type: 'SOLID';
    color: { r: number; g: number; b: number };
    opacity?: number;
  }>;
}

async function setNodeFills(payload: SetNodeFillsPayload): Promise<{ id: string; fillCount: number }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (!('fills' in node)) {
    throw new Error(`Node type ${node.type} does not support fills`);
  }

  const fillableNode = node as GeometryMixin;
  const newFills: Paint[] = payload.fills.map(f => ({
    type: 'SOLID' as const,
    color: f.color,
    opacity: f.opacity ?? 1
  }));

  fillableNode.fills = newFills;

  return {
    id: node.id,
    fillCount: newFills.length
  };
}

interface RenameNodePayload {
  nodeId: string;
  name: string;
}

async function renameNode(payload: RenameNodePayload): Promise<{ id: string; name: string }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  node.name = payload.name;

  return {
    id: node.id,
    name: node.name
  };
}

// ============================================================================
// COMPONENT DESCRIPTION
// ============================================================================

interface AddComponentDescriptionPayload {
  nodeId: string;
  description: string;
}

async function addComponentDescription(payload: AddComponentDescriptionPayload): Promise<{ id: string; description: string }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') {
    throw new Error(`Node is not a component: ${node.type}`);
  }

  (node as ComponentNode | ComponentSetNode).description = payload.description;

  return {
    id: node.id,
    description: payload.description
  };
}

// ============================================================================
// LIBRARY & IMPORT OPERATIONS
// ============================================================================

interface ImportComponentByKeyPayload {
  key: string;
  x?: number;
  y?: number;
}

async function importComponentByKey(payload: ImportComponentByKeyPayload): Promise<{ id: string; name: string; componentKey: string }> {
  try {
    // Import component from library using its key
    const component = await figma.importComponentByKeyAsync(payload.key);

    // Create an instance
    const instance = component.createInstance();

    if (payload.x !== undefined) instance.x = payload.x;
    if (payload.y !== undefined) instance.y = payload.y;

    return {
      id: instance.id,
      name: instance.name,
      componentKey: payload.key
    };
  } catch (e) {
    throw new Error(`Failed to import component with key "${payload.key}": ${e}`);
  }
}

interface SearchLibraryComponentsPayload {
  query?: string;
  limit?: number;
}

async function searchLibraryComponents(payload: SearchLibraryComponentsPayload): Promise<Array<{ key: string; name: string; description: string; libraryName: string }>> {
  const results: Array<{ key: string; name: string; description: string; libraryName: string }> = [];

  try {
    // Get team/shared components - this requires the component to be used in the file first
    // Or we need to iterate through available libraries

    // For now, search local instances that came from libraries
    await figma.loadAllPagesAsync();

    for (const page of figma.root.children) {
      function searchNode(node: SceneNode): void {
        if (node.type === 'INSTANCE') {
          const mainComp = node.mainComponent;
          if (mainComp && mainComp.remote) {
            const matchesQuery = !payload.query ||
              mainComp.name.toLowerCase().includes(payload.query.toLowerCase()) ||
              mainComp.description.toLowerCase().includes(payload.query.toLowerCase());

            if (matchesQuery) {
              // Avoid duplicates
              if (!results.find(r => r.key === mainComp.key)) {
                results.push({
                  key: mainComp.key,
                  name: mainComp.name,
                  description: mainComp.description || '',
                  libraryName: mainComp.parent?.name || 'Unknown Library'
                });
              }
            }
          }
        }
        if ('children' in node) {
          for (const child of node.children) {
            searchNode(child);
          }
        }
      }

      for (const child of page.children) {
        searchNode(child);
        if (payload.limit && results.length >= payload.limit) break;
      }
      if (payload.limit && results.length >= payload.limit) break;
    }
  } catch (e) {
    console.error('Error searching library components:', e);
  }

  return results;
}

interface FlattenNodePayload {
  nodeId: string;
  name?: string;
}

async function flattenNode(payload: FlattenNodePayload): Promise<{ id: string; name: string; type: string }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  if (!('parent' in node) || node.type === 'PAGE' || node.type === 'DOCUMENT') {
    throw new Error(`Cannot flatten node of type: ${node.type}`);
  }

  const sceneNode = node as SceneNode;
  const parent = sceneNode.parent;
  const x = 'x' in sceneNode ? sceneNode.x : 0;
  const y = 'y' in sceneNode ? sceneNode.y : 0;

  // Flatten the node (converts to vector)
  const flattened = figma.flatten([sceneNode]);

  if (payload.name) {
    flattened.name = payload.name;
  }

  // Position the flattened node
  flattened.x = x;
  flattened.y = y;

  return {
    id: flattened.id,
    name: flattened.name,
    type: flattened.type
  };
}

interface ConvertToComponentPayload {
  nodeId: string;
  name?: string;
  description?: string;
}

async function convertToComponent(payload: ConvertToComponentPayload): Promise<{ id: string; name: string; key: string }> {
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) {
    throw new Error(`Node not found: ${payload.nodeId}`);
  }

  // Get node type
  if (node.type === 'COMPONENT') {
    // Already a component
    return {
      id: node.id,
      name: node.name,
      key: (node as ComponentNode).key
    };
  }

  if (node.type !== 'FRAME' && node.type !== 'GROUP' && node.type !== 'RECTANGLE' &&
    node.type !== 'ELLIPSE' && node.type !== 'VECTOR' && node.type !== 'INSTANCE') {
    throw new Error(`Cannot convert node of type ${node.type} to component`);
  }

  // For vectors and shapes, wrap in a frame first then convert
  if (node.type === 'VECTOR' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
    const sceneNode = node as SceneNode;
    const parent = sceneNode.parent;
    const x = sceneNode.x;
    const y = sceneNode.y;

    // Create a component at the same position
    const component = figma.createComponent();
    component.name = payload.name || sceneNode.name;
    component.resize(sceneNode.width, sceneNode.height);
    component.x = x;
    component.y = y;

    // Move the shape into the component
    component.appendChild(sceneNode);
    sceneNode.x = 0;
    sceneNode.y = 0;

    if (payload.description) {
      component.description = payload.description;
    }

    return {
      id: component.id,
      name: component.name,
      key: component.key
    };
  }

  // For frames, groups, and instances - use createComponentFromNode if available or manual conversion
  const sceneNode = node as FrameNode | GroupNode | InstanceNode;
  const x = sceneNode.x;
  const y = sceneNode.y;

  // Create component
  const component = figma.createComponent();
  component.name = payload.name || sceneNode.name;
  component.resize(sceneNode.width, sceneNode.height);
  component.x = x;
  component.y = y;

  // Copy children if it's a frame/group
  if ('children' in sceneNode) {
    for (const child of [...sceneNode.children]) {
      component.appendChild(child);
    }
  }

  // Copy fills, strokes, effects if applicable
  if ('fills' in sceneNode) {
    component.fills = sceneNode.fills as Paint[];
  }
  if ('strokes' in sceneNode) {
    component.strokes = sceneNode.strokes as Paint[];
  }
  if ('effects' in sceneNode) {
    component.effects = sceneNode.effects;
  }
  if ('cornerRadius' in sceneNode && typeof sceneNode.cornerRadius === 'number') {
    component.cornerRadius = sceneNode.cornerRadius;
  }

  // Copy layout properties
  if ('layoutMode' in sceneNode) {
    component.layoutMode = sceneNode.layoutMode;
    component.primaryAxisSizingMode = sceneNode.primaryAxisSizingMode;
    component.counterAxisSizingMode = sceneNode.counterAxisSizingMode;
    component.paddingTop = sceneNode.paddingTop;
    component.paddingBottom = sceneNode.paddingBottom;
    component.paddingLeft = sceneNode.paddingLeft;
    component.paddingRight = sceneNode.paddingRight;
    component.itemSpacing = sceneNode.itemSpacing;
  }

  if (payload.description) {
    component.description = payload.description;
  }

  // Remove original node
  sceneNode.remove();

  return {
    id: component.id,
    name: component.name,
    key: component.key
  };
}

interface SetInstanceSwapPropertyPayload {
  componentId: string;
  propertyName: string;
  targetNodeId: string;  // The nested instance to enable swap for
}

async function setInstanceSwapProperty(payload: SetInstanceSwapPropertyPayload): Promise<{ success: boolean }> {
  const component = await figma.getNodeByIdAsync(payload.componentId);
  if (!component || (component.type !== 'COMPONENT' && component.type !== 'COMPONENT_SET')) {
    throw new Error(`Component not found: ${payload.componentId}`);
  }

  // Add instance swap property
  (component as ComponentNode | ComponentSetNode).addComponentProperty(
    payload.propertyName,
    'INSTANCE_SWAP',
    ''  // Default value is empty (will use current instance)
  );

  return { success: true };
}

interface SwapInstancePayload {
  instanceId: string;
  newComponentKey: string;
}

async function swapInstance(payload: SwapInstancePayload): Promise<{ id: string; name: string; newComponentKey: string }> {
  const instance = await figma.getNodeByIdAsync(payload.instanceId);
  if (!instance || instance.type !== 'INSTANCE') {
    throw new Error(`Instance not found: ${payload.instanceId}`);
  }

  // Import the new component
  const newComponent = await figma.importComponentByKeyAsync(payload.newComponentKey);

  // Swap the instance
  (instance as InstanceNode).swapComponent(newComponent);

  return {
    id: instance.id,
    name: instance.name,
    newComponentKey: payload.newComponentKey
  };
}

async function getAvailableLibraryComponents(): Promise<Array<{ key: string; name: string; description: string; remote: boolean }>> {
  const components: Array<{ key: string; name: string; description: string; remote: boolean }> = [];

  await figma.loadAllPagesAsync();

  // Collect all unique components (both local and from libraries)
  const seenKeys = new Set<string>();

  for (const page of figma.root.children) {
    function collectComponents(node: SceneNode): void {
      if (node.type === 'INSTANCE') {
        const mainComp = (node as InstanceNode).mainComponent;
        if (mainComp && !seenKeys.has(mainComp.key)) {
          seenKeys.add(mainComp.key);
          components.push({
            key: mainComp.key,
            name: mainComp.name,
            description: mainComp.description || '',
            remote: mainComp.remote
          });
        }
      }
      if ('children' in node) {
        for (const child of node.children) {
          collectComponents(child);
        }
      }
    }

    for (const child of page.children) {
      collectComponents(child);
    }
  }

  // Also get local components
  const localComponents = await figma.variables.getLocalVariablesAsync();
  // Note: For actual local components, we'd need a different approach

  return components;
}

interface BatchImportAndFlattenPayload {
  componentKeys: Array<{
    key: string;
    name: string;  // New name for the icon
    properties?: Record<string, string | boolean>;  // Variant properties to set
  }>;
  x?: number;
  y?: number;
  spacing?: number;
  bindStrokeToVariable?: string;  // Variable ID or name to bind stroke color
  createComponents?: boolean;  // Convert flattened vectors to components
}

async function batchImportAndFlatten(payload: BatchImportAndFlattenPayload): Promise<{
  success: boolean;
  icons: Array<{ id: string; name: string; type: string }>;
  errors: string[];
}> {
  const icons: Array<{ id: string; name: string; type: string }> = [];
  const errors: string[] = [];

  let currentX = payload.x ?? 0;
  let currentY = payload.y ?? 0;
  const spacing = payload.spacing ?? 40;

  // Find the variable to bind if specified
  let strokeVariable: Variable | null = null;
  if (payload.bindStrokeToVariable) {
    if (payload.bindStrokeToVariable.startsWith('VariableID:')) {
      strokeVariable = await figma.variables.getVariableByIdAsync(payload.bindStrokeToVariable);
    } else {
      // Search by name
      const allVariables = await figma.variables.getLocalVariablesAsync();
      strokeVariable = allVariables.find(v => v.name === payload.bindStrokeToVariable) || null;
    }
  }

  for (const item of payload.componentKeys) {
    try {
      // Import the component
      const component = await figma.importComponentByKeyAsync(item.key);

      // Create instance
      const instance = component.createInstance();
      instance.x = currentX;
      instance.y = currentY;

      // Set variant properties if provided
      if (item.properties) {
        try {
          instance.setProperties(item.properties);
        } catch (e) {
          errors.push(`Failed to set properties for ${item.name}: ${e}`);
        }
      }

      // Flatten the instance
      const flattened = figma.flatten([instance]);
      flattened.name = item.name;
      flattened.x = currentX;
      flattened.y = currentY;

      // Bind stroke to variable if specified
      if (strokeVariable && 'strokes' in flattened && Array.isArray(flattened.strokes) && flattened.strokes.length > 0) {
        const strokes = [...flattened.strokes];
        if (strokes[0] && strokes[0].type === 'SOLID') {
          const boundStroke = figma.variables.setBoundVariableForPaint(
            strokes[0] as SolidPaint,
            'color',
            strokeVariable
          );
          flattened.strokes = [boundStroke];
        }
      }

      let finalNode: SceneNode = flattened;

      // Convert to component if requested
      if (payload.createComponents) {
        const comp = figma.createComponent();
        comp.name = item.name;
        comp.resize(flattened.width, flattened.height);
        comp.x = currentX;
        comp.y = currentY;
        comp.appendChild(flattened);
        flattened.x = 0;
        flattened.y = 0;
        finalNode = comp;
      }

      icons.push({
        id: finalNode.id,
        name: finalNode.name,
        type: finalNode.type
      });

      currentX += spacing;

      // Wrap to new row every 10 icons
      if (icons.length % 10 === 0) {
        currentX = payload.x ?? 0;
        currentY += spacing;
      }

    } catch (e) {
      errors.push(`Failed to import ${item.name} (key: ${item.key}): ${e}`);
    }
  }

  return {
    success: errors.length === 0,
    icons,
    errors
  };
}

// ============================================================================
// SVG IMPORT OPERATIONS
// ============================================================================

interface CreateFromSvgPayload {
  svg: string;          // The SVG string content
  name?: string;        // Name for the created node
  x?: number;
  y?: number;
  createComponent?: boolean;  // Whether to wrap in a component
}

async function createFromSvg(payload: CreateFromSvgPayload): Promise<{
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
}> {
  // Create node from SVG using Figma's built-in function
  const node = figma.createNodeFromSvg(payload.svg);

  if (payload.name) {
    node.name = payload.name;
  }

  if (payload.x !== undefined) node.x = payload.x;
  if (payload.y !== undefined) node.y = payload.y;

  let finalNode: FrameNode | ComponentNode = node;

  // Optionally convert to component
  if (payload.createComponent) {
    const component = figma.createComponent();
    component.name = payload.name || 'icon';
    component.resize(node.width, node.height);
    component.x = node.x;
    component.y = node.y;

    // Move all children from the SVG frame to the component
    while (node.children.length > 0) {
      const child = node.children[0];
      component.appendChild(child);
    }

    // Remove the empty frame
    node.remove();
    finalNode = component;
  }

  return {
    id: finalNode.id,
    name: finalNode.name,
    type: finalNode.type,
    width: finalNode.width,
    height: finalNode.height
  };
}

interface BatchCreateIconsFromSvgPayload {
  icons: Array<{
    name: string;
    svg: string;
    variant?: 'outline' | 'filled';  // Optional variant info
  }>;
  x?: number;
  y?: number;
  spacing?: number;
  iconsPerRow?: number;
  createComponents?: boolean;
  createVariantSet?: boolean;  // Group outline/filled as variants
  strokeVariableId?: string;   // Variable to bind stroke color to
}

async function batchCreateIconsFromSvg(payload: BatchCreateIconsFromSvgPayload): Promise<{
  success: boolean;
  icons: Array<{ id: string; name: string; type: string }>;
  errors: string[];
}> {
  const icons: Array<{ id: string; name: string; type: string }> = [];
  const errors: string[] = [];

  const spacing = payload.spacing ?? 40;
  const iconsPerRow = payload.iconsPerRow ?? 10;
  let currentX = payload.x ?? 0;
  let currentY = payload.y ?? 0;

  // Get stroke variable if specified
  let strokeVariable: Variable | null = null;
  if (payload.strokeVariableId) {
    strokeVariable = await figma.variables.getVariableByIdAsync(payload.strokeVariableId);
  }

  for (let i = 0; i < payload.icons.length; i++) {
    const item = payload.icons[i];

    try {
      // Create node from SVG
      const node = figma.createNodeFromSvg(item.svg);
      node.name = item.name;
      node.x = currentX;
      node.y = currentY;

      // Flatten to a single vector for cleaner output
      const flattened = figma.flatten([node]);
      flattened.name = item.name;
      flattened.x = currentX;
      flattened.y = currentY;

      // Bind stroke to variable if specified
      if (strokeVariable && 'strokes' in flattened && Array.isArray(flattened.strokes) && flattened.strokes.length > 0) {
        const strokes = [...flattened.strokes];
        if (strokes[0] && strokes[0].type === 'SOLID') {
          const boundStroke = figma.variables.setBoundVariableForPaint(
            strokes[0] as SolidPaint,
            'color',
            strokeVariable
          );
          flattened.strokes = [boundStroke];
        }
      }

      let finalNode: SceneNode = flattened;

      // Convert to component if requested
      if (payload.createComponents) {
        const comp = figma.createComponent();
        comp.name = item.name;
        comp.resize(flattened.width, flattened.height);
        comp.x = currentX;
        comp.y = currentY;
        comp.appendChild(flattened);
        flattened.x = 0;
        flattened.y = 0;
        finalNode = comp;
      }

      icons.push({
        id: finalNode.id,
        name: finalNode.name,
        type: finalNode.type
      });

      // Update position for next icon
      currentX += spacing;
      if ((i + 1) % iconsPerRow === 0) {
        currentX = payload.x ?? 0;
        currentY += spacing;
      }

    } catch (e) {
      errors.push(`Failed to create ${item.name}: ${e}`);
    }
  }

  return {
    success: errors.length === 0,
    icons,
    errors
  };
}

// ============================================================================
// ICON PROCESSING OPERATIONS (Temporary page → Icons page)
// ============================================================================

interface CloneAndConvertIconPayload {
  sourceNodeId: string;      // Node ID in Temporary page
  targetPageName: string;    // "Icons" or "🎯 Icons"
  componentName: string;     // e.g., "icon/arrow-up" or "icon/arrow-up-filled"
  x?: number;
  y?: number;
  bindStrokeVariable?: string;  // Variable name like "icon/default"
}

async function cloneAndConvertIcon(payload: CloneAndConvertIconPayload): Promise<{
  id: string;
  name: string;
  type: string;
  key: string;
}> {
  // Find source node
  const sourceNode = await figma.getNodeByIdAsync(payload.sourceNodeId);
  if (!sourceNode) {
    throw new Error(`Source node not found: ${payload.sourceNodeId}`);
  }

  // Find target page
  const targetPage = figma.root.children.find(p =>
    p.name === payload.targetPageName ||
    p.name.includes('Icons') ||
    p.name === '🎯 Icons'
  );

  if (!targetPage) {
    throw new Error(`Target page not found: ${payload.targetPageName}`);
  }

  // Clone the node
  const sceneNode = sourceNode as SceneNode;
  const cloned = sceneNode.clone();

  // Add to target page
  targetPage.appendChild(cloned);

  // Position
  cloned.x = payload.x ?? 0;
  cloned.y = payload.y ?? 0;

  // If it's an instance, detach it first
  if (cloned.type === 'INSTANCE') {
    const detached = (cloned as InstanceNode).detachInstance();

    // Now flatten all children
    const flattened = figma.flatten([detached]);
    flattened.name = payload.componentName;
    flattened.x = payload.x ?? 0;
    flattened.y = payload.y ?? 0;

    // Bind stroke to variable if specified
    if (payload.bindStrokeVariable) {
      const allVariables = await figma.variables.getLocalVariablesAsync();
      const strokeVariable = allVariables.find(v => v.name === payload.bindStrokeVariable);

      if (strokeVariable && 'strokes' in flattened && Array.isArray(flattened.strokes) && flattened.strokes.length > 0) {
        const strokes = [...flattened.strokes];
        if (strokes[0] && strokes[0].type === 'SOLID') {
          const boundStroke = figma.variables.setBoundVariableForPaint(
            strokes[0] as SolidPaint,
            'color',
            strokeVariable
          );
          flattened.strokes = [boundStroke];
        }
      }

      // Also bind fills if it has any (for filled icons)
      if ('fills' in flattened && Array.isArray(flattened.fills) && flattened.fills.length > 0) {
        const fills = [...flattened.fills];
        if (fills[0] && fills[0].type === 'SOLID') {
          const boundFill = figma.variables.setBoundVariableForPaint(
            fills[0] as SolidPaint,
            'color',
            strokeVariable
          );
          (flattened as GeometryMixin).fills = [boundFill];
        }
      }
    }

    // Create component wrapper
    const component = figma.createComponent();
    component.name = payload.componentName;
    component.resize(24, 24);  // Standard icon size
    component.x = payload.x ?? 0;
    component.y = payload.y ?? 0;
    component.appendChild(flattened);
    flattened.x = 0;
    flattened.y = 0;

    return {
      id: component.id,
      name: component.name,
      type: 'COMPONENT',
      key: component.key
    };
  }

  // For non-instance nodes (frame, group, etc.)
  cloned.name = payload.componentName;

  // Flatten
  const flattened = figma.flatten([cloned]);
  flattened.name = payload.componentName;

  // Create component
  const component = figma.createComponent();
  component.name = payload.componentName;
  component.resize(24, 24);
  component.x = payload.x ?? 0;
  component.y = payload.y ?? 0;
  component.appendChild(flattened);
  flattened.x = 0;
  flattened.y = 0;

  return {
    id: component.id,
    name: component.name,
    type: 'COMPONENT',
    key: component.key
  };
}

interface ProcessTempIconsPayload {
  icons: Array<{
    name: string;         // Component name (e.g., "icon/arrow-up")
    nodeId: string;       // Source node ID in Temporary page
    variant: 'outline' | 'filled';
  }>;
  targetPageName?: string;  // Default: "Icons"
  bindStrokeVariable?: string;  // Default: "icon/default"
  startX?: number;
  startY?: number;
  spacing?: number;
  iconsPerRow?: number;
}

async function processTempIcons(payload: ProcessTempIconsPayload): Promise<{
  success: boolean;
  processed: number;
  icons: Array<{ id: string; name: string; key: string }>;
  errors: string[];
}> {
  const icons: Array<{ id: string; name: string; key: string }> = [];
  const errors: string[] = [];

  const targetPageName = payload.targetPageName || 'Icons';
  const bindStrokeVariable = payload.bindStrokeVariable || 'icon/default';
  const spacing = payload.spacing || 40;
  const iconsPerRow = payload.iconsPerRow || 10;
  let currentX = payload.startX ?? 100;
  let currentY = payload.startY ?? 100;
  const startX = currentX;

  // Find target page - be specific to avoid matching wrong pages
  const targetPage = figma.root.children.find(p =>
    p.name === targetPageName ||
    p.name === '🎯 Icons' ||
    (p.name.includes('Icons') && !p.name.includes('Temporary'))
  );

  if (!targetPage) {
    throw new Error(`Target page "${targetPageName}" not found. Available pages: ${figma.root.children.map(p => p.name).join(', ')}`);
  }

  // Log which page we're using
  console.log(`Using target page: "${targetPage.name}" (${targetPage.id})`);

  // Get stroke variable
  const allVariables = await figma.variables.getLocalVariablesAsync();
  const strokeVariable = allVariables.find(v => v.name === bindStrokeVariable);

  if (!strokeVariable) {
    errors.push(`Warning: Stroke variable "${bindStrokeVariable}" not found. Icons will not be bound to variables.`);
  }

  // Process each icon
  for (let i = 0; i < payload.icons.length; i++) {
    const iconInfo = payload.icons[i];

    try {
      // Find source node
      const sourceNode = await figma.getNodeByIdAsync(iconInfo.nodeId);
      if (!sourceNode) {
        errors.push(`Source node not found: ${iconInfo.nodeId} for ${iconInfo.name}`);
        continue;
      }

      const sceneNode = sourceNode as SceneNode;

      // Clone to target page
      const cloned = sceneNode.clone();
      targetPage.appendChild(cloned);
      cloned.x = currentX;
      cloned.y = currentY;

      // Handle based on node type
      let vectorNode: VectorNode | null = null;

      if (cloned.type === 'INSTANCE') {
        // Detach instance and flatten
        const detached = (cloned as InstanceNode).detachInstance();
        vectorNode = figma.flatten([detached]);
      } else if (cloned.type === 'FRAME' || cloned.type === 'GROUP') {
        vectorNode = figma.flatten([cloned]);
      } else if (cloned.type === 'VECTOR') {
        vectorNode = cloned as VectorNode;
      } else {
        // Try to flatten anyway
        try {
          vectorNode = figma.flatten([cloned]);
        } catch (e) {
          errors.push(`Cannot flatten ${iconInfo.name}: ${e}`);
          cloned.remove();
          continue;
        }
      }

      if (!vectorNode) {
        errors.push(`Failed to get vector for ${iconInfo.name}`);
        continue;
      }

      vectorNode.name = `${iconInfo.name}-vector`;
      vectorNode.x = 0;
      vectorNode.y = 0;

      // Bind colors to variable
      if (strokeVariable) {
        // Bind strokes
        if ('strokes' in vectorNode && Array.isArray(vectorNode.strokes) && vectorNode.strokes.length > 0) {
          const strokes = [...vectorNode.strokes];
          if (strokes[0] && strokes[0].type === 'SOLID') {
            const boundStroke = figma.variables.setBoundVariableForPaint(
              strokes[0] as SolidPaint,
              'color',
              strokeVariable
            );
            vectorNode.strokes = [boundStroke];
          }
        }

        // Bind fills (for filled icons)
        if (iconInfo.variant === 'filled' && 'fills' in vectorNode && Array.isArray(vectorNode.fills) && vectorNode.fills.length > 0) {
          const fills = [...vectorNode.fills];
          if (fills[0] && fills[0].type === 'SOLID') {
            const boundFill = figma.variables.setBoundVariableForPaint(
              fills[0] as SolidPaint,
              'color',
              strokeVariable
            );
            vectorNode.fills = [boundFill];
          }
        }
      }

      // Create component wrapper
      const component = figma.createComponent();
      component.name = iconInfo.name;
      component.resize(24, 24);  // Standard icon size
      component.x = currentX;
      component.y = currentY;
      component.fills = [];  // Transparent background
      component.appendChild(vectorNode);

      // Center the vector in the component
      vectorNode.x = (24 - vectorNode.width) / 2;
      vectorNode.y = (24 - vectorNode.height) / 2;

      icons.push({
        id: component.id,
        name: component.name,
        key: component.key
      });

      // Update position
      currentX += spacing;
      if ((i + 1) % iconsPerRow === 0) {
        currentX = startX;
        currentY += spacing;
      }

    } catch (e) {
      errors.push(`Failed to process ${iconInfo.name}: ${e}`);
    }
  }

  return {
    success: errors.length === 0 || icons.length > 0,
    processed: icons.length,
    icons,
    errors
  };
}

interface BatchMoveToPagePayload {
  nodeIds: string[];
  targetPageId: string;
  arrangeInGrid?: boolean;
  startX?: number;
  startY?: number;
  spacing?: number;
  itemsPerRow?: number;
}

async function batchMoveToPage(payload: BatchMoveToPagePayload): Promise<{
  success: boolean;
  moved: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let moved = 0;

  const targetPage = figma.root.children.find(p => p.id === payload.targetPageId);
  if (!targetPage) {
    throw new Error(`Target page not found: ${payload.targetPageId}`);
  }

  const spacing = payload.spacing || 40;
  const itemsPerRow = payload.itemsPerRow || 10;
  let currentX = payload.startX ?? 100;
  let currentY = payload.startY ?? 100;
  const startX = currentX;

  for (let i = 0; i < payload.nodeIds.length; i++) {
    const nodeId = payload.nodeIds[i];
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node) {
        errors.push(`Node not found: ${nodeId}`);
        continue;
      }

      if (node.type === 'PAGE' || node.type === 'DOCUMENT') {
        errors.push(`Cannot move node of type: ${node.type}`);
        continue;
      }

      const sceneNode = node as SceneNode;
      targetPage.appendChild(sceneNode);

      if (payload.arrangeInGrid) {
        sceneNode.x = currentX;
        sceneNode.y = currentY;
        currentX += spacing;
        if ((i + 1) % itemsPerRow === 0) {
          currentX = startX;
          currentY += spacing;
        }
      }

      moved++;
    } catch (e) {
      errors.push(`Failed to move ${nodeId}: ${e}`);
    }
  }

  return {
    success: moved > 0,
    moved,
    errors
  };
}

// ============================================================================
// SCAN AND FLATTEN ICON INSTANCES
// ============================================================================

interface ScanPageInstancesPayload {
  pageId?: string;  // Optional, defaults to current page
  filterByRemote?: boolean;  // Only return remote library instances
}

async function scanPageInstances(payload: ScanPageInstancesPayload): Promise<{
  instances: Array<{
    id: string;
    name: string;
    mainComponentName: string | null;
    mainComponentKey: string | null;
    isRemote: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  total: number;
}> {
  let page: PageNode;

  if (payload.pageId) {
    const foundPage = figma.root.children.find(p => p.id === payload.pageId);
    if (!foundPage) {
      throw new Error(`Page not found: ${payload.pageId}`);
    }
    page = foundPage;
  } else {
    page = figma.currentPage;
  }

  const instances: Array<{
    id: string;
    name: string;
    mainComponentName: string | null;
    mainComponentKey: string | null;
    isRemote: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  // Recursive function to find all instances
  function findInstances(node: SceneNode): void {
    if (node.type === 'INSTANCE') {
      const instance = node as InstanceNode;
      const mainComp = instance.mainComponent;
      const isRemote = mainComp ? mainComp.remote : false;

      // Filter if requested
      if (payload.filterByRemote !== undefined && payload.filterByRemote !== isRemote) {
        return;
      }

      instances.push({
        id: instance.id,
        name: instance.name,
        mainComponentName: mainComp?.name || null,
        mainComponentKey: mainComp?.key || null,
        isRemote,
        x: instance.x,
        y: instance.y,
        width: instance.width,
        height: instance.height
      });
    }

    // Recursively search children
    if ('children' in node) {
      for (const child of (node as FrameNode | GroupNode).children) {
        findInstances(child);
      }
    }
  }

  // Search all children of the page
  for (const child of page.children) {
    findInstances(child);
  }

  return {
    instances,
    total: instances.length
  };
}

interface FlattenAndRenameInstancesPayload {
  instanceIds?: string[];  // Optional - if not provided, uses all instances on current page
  namePrefix?: string;     // e.g., "icon/" - will result in "icon/arrow-up"
  nameSuffix?: string;     // e.g., "-outline"
  bindStrokeVariable?: string;  // Variable name to bind stroke color
  createComponents?: boolean;   // Convert to components (default: true)
  arrangeInGrid?: boolean;      // Arrange in grid (default: true)
  startX?: number;
  startY?: number;
  spacing?: number;
  iconsPerRow?: number;
  targetPageId?: string;  // Optional - move to different page
}

async function flattenAndRenameInstances(payload: FlattenAndRenameInstancesPayload): Promise<{
  success: boolean;
  processed: number;
  icons: Array<{ id: string; name: string; key?: string; type: string }>;
  errors: string[];
}> {
  const icons: Array<{ id: string; name: string; key?: string; type: string }> = [];
  const errors: string[] = [];

  const namePrefix = payload.namePrefix || '';
  const nameSuffix = payload.nameSuffix || '';
  const createComponents = payload.createComponents !== false;
  const arrangeInGrid = payload.arrangeInGrid !== false;
  const spacing = payload.spacing || 50;
  const iconsPerRow = payload.iconsPerRow || 12;
  let currentX = payload.startX ?? 100;
  let currentY = payload.startY ?? 600;
  const startX = currentX;

  // Get target page
  let targetPage: PageNode = figma.currentPage;
  if (payload.targetPageId) {
    const foundPage = figma.root.children.find(p => p.id === payload.targetPageId);
    if (foundPage) {
      targetPage = foundPage;
    }
  }

  // Get instances to process
  let instanceIds = payload.instanceIds;
  if (!instanceIds || instanceIds.length === 0) {
    // Scan current page for all instances
    const scanResult = await scanPageInstances({ filterByRemote: true });
    instanceIds = scanResult.instances.map(i => i.id);
  }

  // Get stroke variable if specified
  let strokeVariable: Variable | null = null;
  if (payload.bindStrokeVariable) {
    const allVariables = await figma.variables.getLocalVariablesAsync();
    strokeVariable = allVariables.find(v => v.name === payload.bindStrokeVariable) || null;
    if (!strokeVariable) {
      errors.push(`Warning: Variable "${payload.bindStrokeVariable}" not found`);
    }
  }

  for (let i = 0; i < instanceIds.length; i++) {
    const instanceId = instanceIds[i];

    try {
      const node = await figma.getNodeByIdAsync(instanceId);
      if (!node || node.type !== 'INSTANCE') {
        errors.push(`Not an instance: ${instanceId}`);
        continue;
      }

      const instance = node as InstanceNode;

      // Get clean name from the instance (remove variant properties from name)
      let baseName = instance.name;
      // If name contains comma (variant notation), use the main component name
      if (baseName.includes(',') || baseName.includes('=')) {
        const mainComp = instance.mainComponent;
        if (mainComp) {
          // Get the component set name if it's a variant
          const parent = mainComp.parent;
          if (parent && parent.type === 'COMPONENT_SET') {
            baseName = parent.name;
          } else {
            baseName = mainComp.name;
          }
        }
      }

      // Clean up the name - remove slashes, convert to kebab case
      const cleanName = baseName
        .replace(/\//g, '-')
        .replace(/\s+/g, '-')
        .toLowerCase();

      const newName = `${namePrefix}${cleanName}${nameSuffix}`;

      // Detach the instance
      const detached = instance.detachInstance();

      // Flatten to vector
      const flattened = figma.flatten([detached]);
      flattened.name = newName;

      // Bind stroke/fill to variable
      if (strokeVariable) {
        // Bind strokes
        if ('strokes' in flattened && Array.isArray(flattened.strokes) && flattened.strokes.length > 0) {
          const strokes = [...flattened.strokes];
          if (strokes[0] && strokes[0].type === 'SOLID') {
            try {
              const boundStroke = figma.variables.setBoundVariableForPaint(
                strokes[0] as SolidPaint,
                'color',
                strokeVariable
              );
              flattened.strokes = [boundStroke];
            } catch (e) {
              // Ignore binding errors
            }
          }
        }

        // Bind fills (for filled icons)
        if ('fills' in flattened && Array.isArray(flattened.fills) && flattened.fills.length > 0) {
          const fills = [...flattened.fills];
          if (fills[0] && fills[0].type === 'SOLID') {
            try {
              const boundFill = figma.variables.setBoundVariableForPaint(
                fills[0] as SolidPaint,
                'color',
                strokeVariable
              );
              (flattened as GeometryMixin).fills = [boundFill];
            } catch (e) {
              // Ignore binding errors
            }
          }
        }
      }

      let finalNode: SceneNode = flattened;

      // Create component wrapper if requested
      if (createComponents) {
        const component = figma.createComponent();
        component.name = newName;
        component.resize(24, 24);
        targetPage.appendChild(component);
        component.appendChild(flattened);

        // Center the flattened vector in the component
        flattened.x = (24 - flattened.width) / 2;
        flattened.y = (24 - flattened.height) / 2;

        finalNode = component;

        icons.push({
          id: component.id,
          name: component.name,
          key: component.key,
          type: 'COMPONENT'
        });
      } else {
        targetPage.appendChild(flattened);
        icons.push({
          id: flattened.id,
          name: flattened.name,
          type: 'VECTOR'
        });
      }

      // Position
      if (arrangeInGrid) {
        finalNode.x = currentX;
        finalNode.y = currentY;
        currentX += spacing;
        if ((i + 1) % iconsPerRow === 0) {
          currentX = startX;
          currentY += spacing;
        }
      }

    } catch (e) {
      errors.push(`Failed to process ${instanceId}: ${e}`);
    }
  }

  return {
    success: icons.length > 0,
    processed: icons.length,
    icons,
    errors
  };
}

// ============================================================================
// GET FRAME CHILDREN (Deep scan)
// ============================================================================

interface GetFrameChildrenPayload {
  frameId: string;
  depth?: number;  // How deep to traverse (default: 1)
}

async function getFrameChildren(payload: GetFrameChildrenPayload): Promise<{
  children: Array<{
    id: string;
    name: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}> {
  const node = await figma.getNodeByIdAsync(payload.frameId);
  if (!node) {
    throw new Error(`Node not found: ${payload.frameId}`);
  }

  if (!('children' in node)) {
    throw new Error(`Node ${payload.frameId} has no children`);
  }

  const children = (node as FrameNode | GroupNode | ComponentNode | ComponentSetNode).children.map(child => ({
    id: child.id,
    name: child.name,
    type: child.type,
    x: 'x' in child ? child.x : 0,
    y: 'y' in child ? child.y : 0,
    width: 'width' in child ? child.width : 0,
    height: 'height' in child ? child.height : 0
  }));

  return { children };
}

// ============================================================================
// EXTRACT ICONS FROM TEMPORARY ICONS PAGE
// ============================================================================

interface ExtractTempIconsPayload {
  sourcePageId?: string;   // Temporary Icons page ID (default: "138:478")
  targetPageId?: string;   // Icons page ID (default: "110:2")
  targetVariant?: {
    stroke?: string;       // e.g., "1"
    radius?: string;       // e.g., "3"
    join?: string;         // e.g., "round"
  };
  bindStrokeVariable?: string;  // Variable name to bind (default: "fg/default")
  organizeByCategory?: boolean; // Create category frames (default: true)
  spacing?: number;
  iconsPerRow?: number;
  dryRun?: boolean;        // If true, just scan and report
}

interface ExtractSingleCategoryPayload {
  categoryName: string;     // The exact category name to process
  sourcePageId?: string;    // Temporary Icons page ID (default: "138:478")
  targetPageId?: string;    // Icons page ID (default: "110:2")
  targetVariant?: {
    stroke?: string;
    radius?: string;
    join?: string;
  };
  bindStrokeVariable?: string;
  spacing?: number;
  iconsPerRow?: number;
  categoryY?: number;       // Y position for the category (default: auto-calculated)
}

interface GetCategoryListPayload {
  sourcePageId?: string;    // Temporary Icons page ID (default: "138:478")
}

async function extractTempIcons(payload: ExtractTempIconsPayload): Promise<{
  success: boolean;
  scanned: number;
  extracted: number;
  icons: Array<{
    id: string;
    name: string;
    key?: string;
    sourceId: string;
    variant: string;
    category: string;
  }>;
  categories: Array<{ name: string; iconCount: number; frameId?: string }>;
  errors: string[];
}> {
  const sourcePageId = payload.sourcePageId || '138:478';
  const targetPageId = payload.targetPageId || '110:2';
  const targetVariant = payload.targetVariant || { stroke: '1', radius: '3', join: 'round' };
  const bindStrokeVariable = payload.bindStrokeVariable || 'fg/default';  // Use Mapped collection variable
  const organizeByCategory = payload.organizeByCategory !== false;
  const spacing = payload.spacing || 40;
  const iconsPerRow = payload.iconsPerRow || 20;
  const dryRun = payload.dryRun || false;

  const icons: Array<{ id: string; name: string; key?: string; sourceId: string; variant: string; category: string }> = [];
  const categories: Array<{ name: string; iconCount: number; frameId?: string }> = [];
  const errors: string[] = [];
  let scanned = 0;

  // Find source and target pages
  const sourcePage = figma.root.children.find(p => p.id === sourcePageId);
  const targetPage = figma.root.children.find(p => p.id === targetPageId);

  if (!sourcePage) {
    throw new Error(`Source page not found: ${sourcePageId}`);
  }
  if (!targetPage && !dryRun) {
    throw new Error(`Target page not found: ${targetPageId}`);
  }

  // Load source page
  await sourcePage.loadAsync();

  // Get stroke variable from Mapped collection
  let strokeVariable: Variable | null = null;
  if (bindStrokeVariable && !dryRun) {
    const allVariables = await figma.variables.getLocalVariablesAsync();
    strokeVariable = allVariables.find(v => v.name === bindStrokeVariable) || null;
    if (!strokeVariable) {
      errors.push(`Warning: Variable "${bindStrokeVariable}" not found`);
    }
  }

  // Check if variant name matches our target exactly
  // Variant name format: "filled=off, stroke=1, radius=3, join=round"
  function matchesTarget(variantName: string, filled: boolean): boolean {
    const name = variantName.toLowerCase();

    // Parse the variant properties from the name
    // Expected format: "filled=off, stroke=1, radius=3, join=round"
    const parts = name.split(',').map(p => p.trim());
    const props: Record<string, string> = {};

    for (const part of parts) {
      const [key, value] = part.split('=').map(s => s.trim());
      if (key && value !== undefined) {
        props[key] = value;
      }
    }

    // Check filled state
    const filledMatch = filled
      ? props['filled'] === 'on'
      : props['filled'] === 'off';

    // Check stroke (exact match to avoid 1 matching 1.5)
    const strokeMatch = targetVariant.stroke
      ? props['stroke'] === targetVariant.stroke
      : true;

    // Check radius
    const radiusMatch = targetVariant.radius
      ? props['radius'] === targetVariant.radius
      : true;

    // Check join
    const joinMatch = targetVariant.join
      ? props['join'] === targetVariant.join
      : true;

    return filledMatch && strokeMatch && radiusMatch && joinMatch;
  }

  // Track category frames for positioning
  let categoryY = 100;
  const categoryGap = 100;  // Gap between categories
  const categoryFramesToConvert: FrameNode[] = [];  // Store frames to convert to components at the end

  // Process each category frame on the source page
  for (const categoryFrame of sourcePage.children) {
    if (categoryFrame.type !== 'FRAME') continue;

    const categoryName = categoryFrame.name;
    let categoryIconCount = 0;
    let categoryFrameNode: FrameNode | null = null;
    let iconsContainer: FrameNode | null = null;

    // Create category container as a FRAME on target page (if not dry run)
    // Note: We use Frame instead of Component because Figma doesn't allow components inside components
    if (!dryRun && organizeByCategory && targetPage) {
      categoryFrameNode = figma.createFrame();
      categoryFrameNode.name = `icon-category/${categoryName.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and')}`;
      categoryFrameNode.layoutMode = 'VERTICAL';
      categoryFrameNode.primaryAxisSizingMode = 'AUTO';
      categoryFrameNode.counterAxisSizingMode = 'AUTO';
      categoryFrameNode.itemSpacing = 16;
      categoryFrameNode.paddingTop = 24;
      categoryFrameNode.paddingBottom = 24;
      categoryFrameNode.paddingLeft = 24;
      categoryFrameNode.paddingRight = 24;
      categoryFrameNode.fills = [];  // Transparent
      categoryFrameNode.x = 100;
      categoryFrameNode.y = categoryY;
      targetPage.appendChild(categoryFrameNode);

      // Add category title text
      const titleText = figma.createText();
      await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
      titleText.fontName = { family: 'Inter', style: 'Semi Bold' };
      titleText.characters = categoryName;
      titleText.fontSize = 18;
      titleText.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
      categoryFrameNode.appendChild(titleText);

      // Create icons container with auto-layout (wrap)
      iconsContainer = figma.createFrame();
      iconsContainer.name = 'Icons';
      iconsContainer.layoutMode = 'HORIZONTAL';
      iconsContainer.layoutWrap = 'WRAP';
      iconsContainer.primaryAxisSizingMode = 'FIXED';
      iconsContainer.counterAxisSizingMode = 'AUTO';
      iconsContainer.resize(iconsPerRow * spacing, 100);
      iconsContainer.itemSpacing = spacing - 24;  // Account for icon size
      iconsContainer.counterAxisSpacing = spacing - 24;
      iconsContainer.fills = [];
      categoryFrameNode.appendChild(iconsContainer);
    }

    // Each category frame contains COMPONENT_SET nodes (icon variants)
    for (const iconSet of (categoryFrame as FrameNode).children) {
      // Skip non-component-sets (like TEXT labels)
      if (iconSet.type !== 'COMPONENT_SET') continue;

      scanned++;

      // Parse icon name from component set name
      const fullIconName = iconSet.name;
      const primaryName = fullIconName.split(',')[0].trim().toLowerCase().replace(/\s+/g, '-');

      // Find the target variants within this component set
      for (const variant of (iconSet as ComponentSetNode).children) {
        if (variant.type !== 'COMPONENT') continue;

        const variantName = variant.name;

        // Check for outline variant (filled=off)
        if (matchesTarget(variantName, false)) {
          if (dryRun) {
            icons.push({
              id: '',
              name: primaryName,
              sourceId: variant.id,
              variant: 'outline',
              category: categoryName
            });
            categoryIconCount++;
          } else {
            try {
              const result = await createFlatIconFrame(
                variant as ComponentNode,
                primaryName,
                iconsContainer || targetPage!,
                strokeVariable
              );
              icons.push({
                id: result.id,
                name: result.name,
                sourceId: variant.id,
                variant: 'outline',
                category: categoryName
              });
              categoryIconCount++;
            } catch (e) {
              errors.push(`Failed to create ${primaryName}: ${e}`);
            }
          }
        }

        // Check for filled variant (filled=on)
        if (matchesTarget(variantName, true)) {
          const filledName = `${primaryName}_filled`;
          if (dryRun) {
            icons.push({
              id: '',
              name: filledName,
              sourceId: variant.id,
              variant: 'filled',
              category: categoryName
            });
            categoryIconCount++;
          } else {
            try {
              const result = await createFlatIconFrame(
                variant as ComponentNode,
                filledName,
                iconsContainer || targetPage!,
                strokeVariable
              );
              icons.push({
                id: result.id,
                name: result.name,
                sourceId: variant.id,
                variant: 'filled',
                category: categoryName
              });
              categoryIconCount++;
            } catch (e) {
              errors.push(`Failed to create ${filledName}: ${e}`);
            }
          }
        }
      }
    }

    if (categoryIconCount > 0) {
      categories.push({
        name: categoryName,
        iconCount: categoryIconCount,
        frameId: categoryFrameNode?.id
      });

      // Store frame for conversion to component later
      if (categoryFrameNode) {
        categoryFramesToConvert.push(categoryFrameNode);
        categoryY += categoryFrameNode.height + categoryGap;
      }
    } else if (categoryFrameNode) {
      // Remove empty category frame
      categoryFrameNode.remove();
    }
  }

  // After all icons are created, convert each category frame to a component
  if (!dryRun && categoryFramesToConvert.length > 0) {
    for (const frame of categoryFramesToConvert) {
      try {
        const component = figma.createComponentFromNode(frame);
        // Update the category entry with the new component ID
        const catEntry = categories.find(c => c.frameId === frame.id);
        if (catEntry) {
          catEntry.frameId = component.id;
        }
      } catch (e) {
        errors.push(`Failed to convert category "${frame.name}" to component: ${e}`);
      }
    }
  }

  return {
    success: errors.length === 0 || icons.length > 0,
    scanned,
    extracted: icons.length,
    icons,
    categories,
    errors
  };
}

// Helper function to create a flat icon frame from a variant node
// Creates a frame with flattened vector named 'icon' inside
async function createFlatIconFrame(
  sourceNode: ComponentNode,
  frameName: string,
  targetContainer: FrameNode | PageNode,
  strokeVariable: Variable | null
): Promise<{ id: string; name: string }> {
  // Clone the source component
  const cloned = sourceNode.clone();
  targetContainer.appendChild(cloned);

  // Flatten to vector (handles all children)
  let vectorNode: VectorNode;

  if (cloned.children.length > 0) {
    // Flatten all children into a single vector
    const childrenToFlatten = [...cloned.children] as SceneNode[];
    vectorNode = figma.flatten(childrenToFlatten);
  } else {
    // Component itself might be the vector
    vectorNode = figma.flatten([cloned]);
  }

  vectorNode.name = 'icon';  // Name the inner vector as 'icon'

  // Bind colors to stroke variable (fg/default from Mapped collection)
  if (strokeVariable) {
    // Bind strokes
    if ('strokes' in vectorNode && Array.isArray(vectorNode.strokes) && vectorNode.strokes.length > 0) {
      const strokes = [...vectorNode.strokes];
      if (strokes[0] && strokes[0].type === 'SOLID') {
        try {
          const boundStroke = figma.variables.setBoundVariableForPaint(
            strokes[0] as SolidPaint,
            'color',
            strokeVariable
          );
          vectorNode.strokes = [boundStroke];
        } catch (e) {
          // Ignore binding errors
        }
      }
    }

    // Bind fills (for filled icons)
    if ('fills' in vectorNode && Array.isArray(vectorNode.fills) && vectorNode.fills.length > 0) {
      const fills = [...vectorNode.fills];
      if (fills[0] && fills[0].type === 'SOLID') {
        try {
          const boundFill = figma.variables.setBoundVariableForPaint(
            fills[0] as SolidPaint,
            'color',
            strokeVariable
          );
          vectorNode.fills = [boundFill];
        } catch (e) {
          // Ignore binding errors
        }
      }
    }
  }

  // Create frame wrapper (not component - will be part of category component)
  const iconFrame = figma.createFrame();
  iconFrame.name = frameName;
  iconFrame.resize(24, 24);  // Standard icon size
  iconFrame.fills = [];  // Transparent background
  targetContainer.appendChild(iconFrame);
  iconFrame.appendChild(vectorNode);

  // Center the vector in the frame
  vectorNode.x = (24 - vectorNode.width) / 2;
  vectorNode.y = (24 - vectorNode.height) / 2;

  // Remove the original cloned node if it still exists
  if (cloned.parent) {
    cloned.remove();
  }

  return {
    id: iconFrame.id,
    name: iconFrame.name
  };
}

// ============================================================================
// GET CATEGORY LIST (for batch processing)
// ============================================================================

async function getCategoryList(payload: GetCategoryListPayload): Promise<{
  success: boolean;
  categories: Array<{ name: string; frameId: string; iconSetCount: number }>;
}> {
  const sourcePageId = payload.sourcePageId || '138:478';

  const sourcePage = figma.root.children.find(p => p.id === sourcePageId);
  if (!sourcePage) {
    throw new Error(`Source page not found: ${sourcePageId}`);
  }

  await sourcePage.loadAsync();

  const categories: Array<{ name: string; frameId: string; iconSetCount: number }> = [];

  for (const categoryFrame of sourcePage.children) {
    if (categoryFrame.type !== 'FRAME') continue;

    // Count COMPONENT_SET children (icon sets)
    let iconSetCount = 0;
    for (const child of (categoryFrame as FrameNode).children) {
      if (child.type === 'COMPONENT_SET') {
        iconSetCount++;
      }
    }

    if (iconSetCount > 0) {
      categories.push({
        name: categoryFrame.name,
        frameId: categoryFrame.id,
        iconSetCount
      });
    }
  }

  return {
    success: true,
    categories
  };
}

// ============================================================================
// EXTRACT SINGLE CATEGORY (for batch processing - avoids timeout)
// ============================================================================

async function extractSingleCategory(payload: ExtractSingleCategoryPayload): Promise<{
  success: boolean;
  categoryName: string;
  extracted: number;
  icons: Array<{ id: string; name: string; sourceId: string; variant: string }>;
  categoryFrameId?: string;
  errors: string[];
}> {
  const categoryName = payload.categoryName;
  const sourcePageId = payload.sourcePageId || '138:478';
  const targetPageId = payload.targetPageId || '110:2';
  const targetVariant = payload.targetVariant || { stroke: '1', radius: '3', join: 'round' };
  const bindStrokeVariable = payload.bindStrokeVariable || 'fg/default';
  const spacing = payload.spacing || 40;
  const iconsPerRow = payload.iconsPerRow || 20;
  const categoryY = payload.categoryY || 100;

  const icons: Array<{ id: string; name: string; sourceId: string; variant: string }> = [];
  const errors: string[] = [];

  // Find source and target pages
  const sourcePage = figma.root.children.find(p => p.id === sourcePageId);
  const targetPage = figma.root.children.find(p => p.id === targetPageId);

  if (!sourcePage) {
    throw new Error(`Source page not found: ${sourcePageId}`);
  }
  if (!targetPage) {
    throw new Error(`Target page not found: ${targetPageId}`);
  }

  await sourcePage.loadAsync();

  // Get stroke variable from Mapped collection
  let strokeVariable: Variable | null = null;
  if (bindStrokeVariable) {
    const allVariables = await figma.variables.getLocalVariablesAsync();
    strokeVariable = allVariables.find(v => v.name === bindStrokeVariable) || null;
    if (!strokeVariable) {
      errors.push(`Warning: Variable "${bindStrokeVariable}" not found`);
    }
  }

  // Find the category frame by name
  let sourceCategoryFrame: FrameNode | null = null;
  for (const frame of sourcePage.children) {
    if (frame.type === 'FRAME' && frame.name === categoryName) {
      sourceCategoryFrame = frame as FrameNode;
      break;
    }
  }

  if (!sourceCategoryFrame) {
    throw new Error(`Category "${categoryName}" not found on source page`);
  }

  // Check if variant name matches our target exactly
  function matchesTarget(variantName: string, filled: boolean): boolean {
    const name = variantName.toLowerCase();
    const parts = name.split(',').map(p => p.trim());
    const props: Record<string, string> = {};

    for (const part of parts) {
      const [key, value] = part.split('=').map(s => s.trim());
      if (key && value !== undefined) {
        props[key] = value;
      }
    }

    const filledMatch = filled
      ? props['filled'] === 'on'
      : props['filled'] === 'off';
    const strokeMatch = targetVariant.stroke
      ? props['stroke'] === targetVariant.stroke
      : true;
    const radiusMatch = targetVariant.radius
      ? props['radius'] === targetVariant.radius
      : true;
    const joinMatch = targetVariant.join
      ? props['join'] === targetVariant.join
      : true;

    return filledMatch && strokeMatch && radiusMatch && joinMatch;
  }

  // Create category container frame
  const categoryFrameNode = figma.createFrame();
  categoryFrameNode.name = `icon-category/${categoryName.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and')}`;
  categoryFrameNode.layoutMode = 'VERTICAL';
  categoryFrameNode.primaryAxisSizingMode = 'AUTO';
  categoryFrameNode.counterAxisSizingMode = 'AUTO';
  categoryFrameNode.itemSpacing = 16;
  categoryFrameNode.paddingTop = 24;
  categoryFrameNode.paddingBottom = 24;
  categoryFrameNode.paddingLeft = 24;
  categoryFrameNode.paddingRight = 24;
  categoryFrameNode.fills = [];
  categoryFrameNode.x = 100;
  categoryFrameNode.y = categoryY;
  targetPage.appendChild(categoryFrameNode);

  // Add category title text
  const titleText = figma.createText();
  await figma.loadFontAsync({ family: 'Inter', style: 'Semi Bold' });
  titleText.fontName = { family: 'Inter', style: 'Semi Bold' };
  titleText.characters = categoryName;
  titleText.fontSize = 18;
  titleText.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
  categoryFrameNode.appendChild(titleText);

  // Create icons container with auto-layout (wrap)
  const iconsContainer = figma.createFrame();
  iconsContainer.name = 'Icons';
  iconsContainer.layoutMode = 'HORIZONTAL';
  iconsContainer.layoutWrap = 'WRAP';
  iconsContainer.primaryAxisSizingMode = 'FIXED';
  iconsContainer.counterAxisSizingMode = 'AUTO';
  iconsContainer.resize(iconsPerRow * spacing, 100);
  iconsContainer.itemSpacing = spacing - 24;
  iconsContainer.counterAxisSpacing = spacing - 24;
  iconsContainer.fills = [];
  categoryFrameNode.appendChild(iconsContainer);

  // Process each icon set in this category
  for (const iconSet of sourceCategoryFrame.children) {
    if (iconSet.type !== 'COMPONENT_SET') continue;

    const fullIconName = iconSet.name;
    const primaryName = fullIconName.split(',')[0].trim().toLowerCase().replace(/\s+/g, '-');

    for (const variant of (iconSet as ComponentSetNode).children) {
      if (variant.type !== 'COMPONENT') continue;

      const variantName = variant.name;

      // Extract outline variant
      if (matchesTarget(variantName, false)) {
        try {
          const result = await createFlatIconFrame(
            variant as ComponentNode,
            primaryName,
            iconsContainer,
            strokeVariable
          );
          icons.push({
            id: result.id,
            name: result.name,
            sourceId: variant.id,
            variant: 'outline'
          });
        } catch (e) {
          errors.push(`Failed to create ${primaryName}: ${e}`);
        }
      }

      // Extract filled variant
      if (matchesTarget(variantName, true)) {
        const filledName = `${primaryName}_filled`;
        try {
          const result = await createFlatIconFrame(
            variant as ComponentNode,
            filledName,
            iconsContainer,
            strokeVariable
          );
          icons.push({
            id: result.id,
            name: result.name,
            sourceId: variant.id,
            variant: 'filled'
          });
        } catch (e) {
          errors.push(`Failed to create ${filledName}: ${e}`);
        }
      }
    }
  }

  // Convert the category frame to a component
  let finalFrameId = categoryFrameNode.id;
  if (icons.length > 0) {
    try {
      const component = figma.createComponentFromNode(categoryFrameNode);
      finalFrameId = component.id;
    } catch (e) {
      errors.push(`Failed to convert category "${categoryName}" to component: ${e}`);
    }
  } else {
    // Remove empty category frame
    categoryFrameNode.remove();
  }

  return {
    success: errors.length === 0 || icons.length > 0,
    categoryName,
    extracted: icons.length,
    icons,
    categoryFrameId: icons.length > 0 ? finalFrameId : undefined,
    errors
  };
}

// ============================================================================
// STYLE ANALYSIS
// ============================================================================

interface AnalyzePageStylesPayload {
  pageId: string;
  maxNodes?: number;
}

interface StyleAnalysisResult {
  fills: Array<{ color: string; count: number; hasStyleId: boolean; styleName?: string }>;
  strokes: Array<{ color: string; count: number; hasStyleId: boolean; styleName?: string }>;
  effects: Array<{ type: string; count: number; hasStyleId: boolean; styleName?: string }>;
  textStyles: Array<{ fontFamily: string; fontSize: number; count: number; hasStyleId: boolean; styleName?: string }>;
  totalNodesScanned: number;
  variableBindings: Array<{ variableName: string; property: string; count: number }>;
}

async function analyzePageStyles(payload: AnalyzePageStylesPayload): Promise<StyleAnalysisResult> {
  const page = figma.root.children.find(p => p.id === payload.pageId);
  if (!page) {
    throw new Error(`Page not found: ${payload.pageId}`);
  }

  // Load the page first
  await page.loadAsync();

  const fills: Map<string, { count: number; hasStyleId: boolean; styleName?: string }> = new Map();
  const strokes: Map<string, { count: number; hasStyleId: boolean; styleName?: string }> = new Map();
  const effects: Map<string, { count: number; hasStyleId: boolean; styleName?: string }> = new Map();
  const textStyles: Map<string, { fontFamily: string; fontSize: number; count: number; hasStyleId: boolean; styleName?: string }> = new Map();
  const variableBindings: Map<string, { property: string; count: number }> = new Map();

  let nodesScanned = 0;
  const maxNodes = payload.maxNodes || 5000;

  function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  async function analyzeNode(node: SceneNode): Promise<void> {
    if (nodesScanned >= maxNodes) return;
    nodesScanned++;

    // Analyze fills
    if ('fills' in node && Array.isArray(node.fills)) {
      const hasFillStyleId = 'fillStyleId' in node && node.fillStyleId && typeof node.fillStyleId === 'string' && node.fillStyleId.length > 0;
      let fillStyleName: string | undefined;
      
      if (hasFillStyleId && typeof node.fillStyleId === 'string') {
        const style = await figma.getStyleByIdAsync(node.fillStyleId);
        fillStyleName = style?.name;
      }

      for (const fill of node.fills as Paint[]) {
        if (fill.type === 'SOLID' && fill.visible !== false) {
          const hex = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
          const existing = fills.get(hex) || { count: 0, hasStyleId: false };
          fills.set(hex, { 
            count: existing.count + 1, 
            hasStyleId: existing.hasStyleId || hasFillStyleId,
            styleName: fillStyleName || existing.styleName
          });
        }
      }
    }

    // Analyze strokes
    if ('strokes' in node && Array.isArray(node.strokes)) {
      const hasStrokeStyleId = 'strokeStyleId' in node && node.strokeStyleId && typeof node.strokeStyleId === 'string' && node.strokeStyleId.length > 0;
      
      for (const stroke of node.strokes as Paint[]) {
        if (stroke.type === 'SOLID' && stroke.visible !== false) {
          const hex = rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b);
          const existing = strokes.get(hex) || { count: 0, hasStyleId: false };
          strokes.set(hex, { 
            count: existing.count + 1, 
            hasStyleId: existing.hasStyleId || hasStrokeStyleId
          });
        }
      }
    }

    // Analyze effects
    if ('effects' in node && Array.isArray(node.effects)) {
      const hasEffectStyleId = 'effectStyleId' in node && node.effectStyleId && typeof node.effectStyleId === 'string' && node.effectStyleId.length > 0;
      let effectStyleName: string | undefined;
      
      if (hasEffectStyleId && typeof node.effectStyleId === 'string') {
        const style = await figma.getStyleByIdAsync(node.effectStyleId);
        effectStyleName = style?.name;
      }

      for (const effect of node.effects as Effect[]) {
        if (effect.visible !== false) {
          const key = effect.type;
          const existing = effects.get(key) || { count: 0, hasStyleId: false };
          effects.set(key, { 
            count: existing.count + 1, 
            hasStyleId: existing.hasStyleId || hasEffectStyleId,
            styleName: effectStyleName || existing.styleName
          });
        }
      }
    }

    // Analyze text styles
    if (node.type === 'TEXT') {
      const hasTextStyleId = node.textStyleId && typeof node.textStyleId === 'string' && node.textStyleId.length > 0;
      let textStyleName: string | undefined;
      
      if (hasTextStyleId && typeof node.textStyleId === 'string') {
        const style = await figma.getStyleByIdAsync(node.textStyleId);
        textStyleName = style?.name;
      }

      const fontName = node.fontName;
      const fontSize = node.fontSize;
      if (fontName && typeof fontName !== 'symbol' && typeof fontSize === 'number') {
        const key = `${fontName.family}|${String(fontSize)}`;
        const existing = textStyles.get(key) || { fontFamily: fontName.family, fontSize: fontSize, count: 0, hasStyleId: false };
        textStyles.set(key, { 
          ...existing,
          count: existing.count + 1, 
          hasStyleId: existing.hasStyleId || hasTextStyleId,
          styleName: textStyleName || existing.styleName
        });
      }
    }

    // Analyze variable bindings
    if ('boundVariables' in node && node.boundVariables) {
      for (const [prop, binding] of Object.entries(node.boundVariables)) {
        if (binding) {
          const bindings = Array.isArray(binding) ? binding : [binding];
          for (const b of bindings) {
            if (b && 'id' in b && typeof b.id === 'string') {
              const variable = await figma.variables.getVariableByIdAsync(b.id);
              if (variable) {
                const key = `${variable.name}|${prop}`;
                const existing = variableBindings.get(key) || { property: prop, count: 0 };
                variableBindings.set(key, { property: prop, count: existing.count + 1 });
              }
            }
          }
        }
      }
    }

    // Recurse into children
    if ('children' in node) {
      for (const child of node.children) {
        await analyzeNode(child);
        if (nodesScanned >= maxNodes) break;
      }
    }
  }

  // Analyze all children of the page
  for (const child of page.children) {
    await analyzeNode(child);
    if (nodesScanned >= maxNodes) break;
  }

  // Convert maps to arrays and sort by count
  const fillsArray = Array.from(fills.entries())
    .map(([color, data]) => ({ color, ...data }))
    .sort((a, b) => b.count - a.count);

  const strokesArray = Array.from(strokes.entries())
    .map(([color, data]) => ({ color, ...data }))
    .sort((a, b) => b.count - a.count);

  const effectsArray = Array.from(effects.entries())
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.count - a.count);

  const textStylesArray = Array.from(textStyles.values())
    .sort((a, b) => b.count - a.count);

  const variableBindingsArray = Array.from(variableBindings.entries())
    .map(([key, data]) => ({ variableName: key.split('|')[0], ...data }))
    .sort((a, b) => b.count - a.count);

  return {
    fills: fillsArray,
    strokes: strokesArray,
    effects: effectsArray,
    textStyles: textStylesArray,
    totalNodesScanned: nodesScanned,
    variableBindings: variableBindingsArray
  };
}

// ============================================================================
// STYLE REMAPPING OPERATIONS
// ============================================================================

interface RemapPaintStylesPayload {
  pageIds: string[];  // Pages to process
  mappings: Array<{
    sourceColor: string;  // Hex color like "#000000"
    targetStyleName: string;  // NDS style name like "🍯 color/fg/default"
  }>;
  includeStrokes?: boolean;
  dryRun?: boolean;  // If true, just count matches without applying
}

interface RemapPaintStylesResult {
  fillsRemapped: number;
  strokesRemapped: number;
  nodesProcessed: number;
  mappingDetails: Array<{
    sourceColor: string;
    targetStyleName: string;
    fillCount: number;
    strokeCount: number;
  }>;
  errors: string[];
}

async function remapPaintStyles(payload: RemapPaintStylesPayload): Promise<RemapPaintStylesResult> {
  const { pageIds, mappings, includeStrokes = true, dryRun = false } = payload;
  
  // Build a map of hex color → target style
  const colorToStyleMap: Map<string, PaintStyle> = new Map();
  const mappingCounts: Map<string, { fillCount: number; strokeCount: number }> = new Map();
  const errors: string[] = [];
  
  // Load all paint styles once
  const allPaintStyles = await figma.getLocalPaintStylesAsync();
  
  // Resolve target style names to actual styles
  for (const mapping of mappings) {
    const normalizedColor = mapping.sourceColor.toUpperCase();
    const targetStyle = allPaintStyles.find(s => s.name === mapping.targetStyleName);
    
    if (!targetStyle) {
      errors.push(`Style not found: ${mapping.targetStyleName}`);
      continue;
    }
    
    colorToStyleMap.set(normalizedColor, targetStyle);
    mappingCounts.set(normalizedColor, { fillCount: 0, strokeCount: 0 });
  }
  
  if (colorToStyleMap.size === 0) {
    throw new Error('No valid style mappings found. Errors: ' + errors.join(', '));
  }
  
  let nodesProcessed = 0;
  let totalFillsRemapped = 0;
  let totalStrokesRemapped = 0;
  
  function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }
  
  async function processNode(node: SceneNode): Promise<void> {
    nodesProcessed++;
    
    // Process fills
    if ('fills' in node && Array.isArray(node.fills) && 'fillStyleId' in node) {
      for (const fill of node.fills as Paint[]) {
        if (fill.type === 'SOLID' && fill.visible !== false) {
          const hex = rgbToHex(fill.color.r, fill.color.g, fill.color.b);
          const targetStyle = colorToStyleMap.get(hex);
          
          if (targetStyle) {
            const counts = mappingCounts.get(hex)!;
            counts.fillCount++;
            totalFillsRemapped++;
            
            if (!dryRun) {
              // Apply the style using async method
              await (node as GeometryMixin).setFillStyleIdAsync(targetStyle.id);
            }
            break; // Only process first matching fill
          }
        }
      }
    }
    
    // Process strokes
    if (includeStrokes && 'strokes' in node && Array.isArray(node.strokes) && 'strokeStyleId' in node) {
      for (const stroke of node.strokes as Paint[]) {
        if (stroke.type === 'SOLID' && stroke.visible !== false) {
          const hex = rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b);
          const targetStyle = colorToStyleMap.get(hex);
          
          if (targetStyle) {
            const counts = mappingCounts.get(hex)!;
            counts.strokeCount++;
            totalStrokesRemapped++;
            
            if (!dryRun) {
              // Apply the style using async method
              await (node as GeometryMixin).setStrokeStyleIdAsync(targetStyle.id);
            }
            break; // Only process first matching stroke
          }
        }
      }
    }
    
    // Recurse into children
    if ('children' in node) {
      for (const child of node.children) {
        await processNode(child);
      }
    }
  }
  
  // Process each specified page
  for (const pageId of pageIds) {
    const page = figma.root.children.find(p => p.id === pageId);
    if (!page) {
      errors.push(`Page not found: ${pageId}`);
      continue;
    }
    
    await page.loadAsync();
    
    for (const child of page.children) {
      await processNode(child);
    }
  }
  
  // Build detailed results
  const mappingDetails = mappings.map(m => {
    const normalizedColor = m.sourceColor.toUpperCase();
    const counts = mappingCounts.get(normalizedColor) || { fillCount: 0, strokeCount: 0 };
    return {
      sourceColor: m.sourceColor,
      targetStyleName: m.targetStyleName,
      fillCount: counts.fillCount,
      strokeCount: counts.strokeCount
    };
  });
  
  return {
    fillsRemapped: totalFillsRemapped,
    strokesRemapped: totalStrokesRemapped,
    nodesProcessed,
    mappingDetails,
    errors
  };
}

// ============================================================================
// TEXT STYLE REMAPPING
// ============================================================================

interface RemapTextStylesPayload {
  pageIds: string[];
  mappings: Array<{
    sourceFontFamily: string;  // e.g. "DM Sans"
    sourceFontSize: number;    // e.g. 14
    targetStyleName: string;   // NDS style name like "🍯 text/body/sm"
  }>;
  dryRun?: boolean;
}

interface RemapTextStylesResult {
  textNodesRemapped: number;
  nodesProcessed: number;
  mappingDetails: Array<{
    sourceFontFamily: string;
    sourceFontSize: number;
    targetStyleName: string;
    count: number;
  }>;
  errors: string[];
}

async function remapTextStyles(payload: RemapTextStylesPayload): Promise<RemapTextStylesResult> {
  const { pageIds, mappings, dryRun = false } = payload;
  
  // Build a map of "fontFamily|fontSize" → target style
  const fontToStyleMap: Map<string, TextStyle> = new Map();
  const mappingCounts: Map<string, number> = new Map();
  const errors: string[] = [];
  
  // Load all text styles once
  const allTextStyles = await figma.getLocalTextStylesAsync();
  
  // Resolve target style names to actual styles
  for (const mapping of mappings) {
    const key = `${mapping.sourceFontFamily}|${mapping.sourceFontSize}`;
    const targetStyle = allTextStyles.find(s => s.name === mapping.targetStyleName);
    
    if (!targetStyle) {
      errors.push(`Text style not found: ${mapping.targetStyleName}`);
      continue;
    }
    
    fontToStyleMap.set(key, targetStyle);
    mappingCounts.set(key, 0);
  }
  
  if (fontToStyleMap.size === 0) {
    throw new Error('No valid text style mappings found. Errors: ' + errors.join(', '));
  }
  
  let nodesProcessed = 0;
  let totalTextNodesRemapped = 0;
  
  async function processNode(node: SceneNode): Promise<void> {
    nodesProcessed++;
    
    // Process text nodes
    if (node.type === 'TEXT') {
      const fontName = node.fontName;
      const fontSize = node.fontSize;
      
      // Skip if mixed styles (symbol) or already has a style
      if (typeof fontName === 'symbol' || typeof fontSize === 'symbol') {
        // Skip mixed content
      } else if (node.textStyleId && typeof node.textStyleId === 'string' && node.textStyleId.length > 0) {
        // Check if it's a valid style or broken reference
        const existingStyle = await figma.getStyleByIdAsync(node.textStyleId);
        if (existingStyle) {
          // Already has valid style, check if we should remap it anyway based on appearance
          const key = `${fontName.family}|${fontSize}`;
          const targetStyle = fontToStyleMap.get(key);
          
          if (targetStyle && existingStyle.name !== targetStyle.name) {
            const counts = mappingCounts.get(key)!;
            mappingCounts.set(key, counts + 1);
            totalTextNodesRemapped++;
            
            if (!dryRun) {
              await node.setTextStyleIdAsync(targetStyle.id);
            }
          }
        } else {
          // Broken reference - apply based on font appearance
          const key = `${fontName.family}|${fontSize}`;
          const targetStyle = fontToStyleMap.get(key);
          
          if (targetStyle) {
            const counts = mappingCounts.get(key)!;
            mappingCounts.set(key, counts + 1);
            totalTextNodesRemapped++;
            
            if (!dryRun) {
              await node.setTextStyleIdAsync(targetStyle.id);
            }
          }
        }
      } else {
        // No style applied - check by font appearance
        const key = `${fontName.family}|${fontSize}`;
        const targetStyle = fontToStyleMap.get(key);
        
        if (targetStyle) {
          const counts = mappingCounts.get(key)!;
          mappingCounts.set(key, counts + 1);
          totalTextNodesRemapped++;
          
          if (!dryRun) {
            await node.setTextStyleIdAsync(targetStyle.id);
          }
        }
      }
    }
    
    // Recurse into children
    if ('children' in node) {
      for (const child of node.children) {
        await processNode(child);
      }
    }
  }
  
  // Process each specified page
  for (const pageId of pageIds) {
    const page = figma.root.children.find(p => p.id === pageId);
    if (!page) {
      errors.push(`Page not found: ${pageId}`);
      continue;
    }
    
    await page.loadAsync();
    
    for (const child of page.children) {
      await processNode(child);
    }
  }
  
  // Build detailed results
  const mappingDetails = mappings.map(m => {
    const key = `${m.sourceFontFamily}|${m.sourceFontSize}`;
    const count = mappingCounts.get(key) || 0;
    return {
      sourceFontFamily: m.sourceFontFamily,
      sourceFontSize: m.sourceFontSize,
      targetStyleName: m.targetStyleName,
      count
    };
  });
  
  return {
    textNodesRemapped: totalTextNodesRemapped,
    nodesProcessed,
    mappingDetails,
    errors
  };
}

// ============================================================================
// EFFECT STYLE REMAPPING
// ============================================================================

interface RemapEffectStylesPayload {
  pageIds: string[];
  targetStyleName: string;  // e.g. "🍯 effect/elevation-md" - apply this to all DROP_SHADOW effects
  dryRun?: boolean;
}

interface RemapEffectStylesResult {
  nodesRemapped: number;
  nodesProcessed: number;
  errors: string[];
}

async function remapEffectStyles(payload: RemapEffectStylesPayload): Promise<RemapEffectStylesResult> {
  const { pageIds, targetStyleName, dryRun = false } = payload;
  const errors: string[] = [];
  
  // Find the target effect style
  const allEffectStyles = await figma.getLocalEffectStylesAsync();
  const targetStyle = allEffectStyles.find(s => s.name === targetStyleName);
  
  if (!targetStyle) {
    throw new Error(`Effect style not found: ${targetStyleName}`);
  }
  
  let nodesProcessed = 0;
  let nodesRemapped = 0;
  
  async function processNode(node: SceneNode): Promise<void> {
    nodesProcessed++;
    
    // Check if node has effects
    if ('effects' in node && Array.isArray(node.effects) && node.effects.length > 0 && 'effectStyleId' in node) {
      // Check for DROP_SHADOW effects
      const hasDropShadow = node.effects.some(e => e.type === 'DROP_SHADOW' && e.visible !== false);
      
      if (hasDropShadow) {
        nodesRemapped++;
        
        if (!dryRun) {
          await (node as BlendMixin).setEffectStyleIdAsync(targetStyle.id);
        }
      }
    }
    
    // Recurse into children
    if ('children' in node) {
      for (const child of node.children) {
        await processNode(child);
      }
    }
  }
  
  // Process each specified page
  for (const pageId of pageIds) {
    const page = figma.root.children.find(p => p.id === pageId);
    if (!page) {
      errors.push(`Page not found: ${pageId}`);
      continue;
    }
    
    await page.loadAsync();
    
    for (const child of page.children) {
      await processNode(child);
    }
  }
  
  return {
    nodesRemapped,
    nodesProcessed,
    errors
  };
}

// ============================================================================
// UI MESSAGE HANDLER
// ============================================================================

figma.ui.onmessage = (msg: Record<string, unknown>) => {
  if (msg.type === 'connect') {
    // HTTP-only now, just send file info to trigger registration
    sendFileInfo();
  } else if (msg.type === 'disconnect') {
    // No WebSocket to close, just update UI
    figma.ui.postMessage({ type: 'status', connected: false });
  } else if (msg.type === 'manual_command' || msg.type === 'execute_command') {
    // Handle commands from UI (via HTTP polling)
    handleCommand({
      id: (msg.id as string) || `manual-${Date.now()}`,
      type: 'command',
      command: msg.command as string,
      payload: (msg.payload as Record<string, unknown>) || {}
    });
  } else if (msg.type === 'get_file_info') {
    // UI requesting file info
    sendFileInfo();
  }
};

// ============================================================================
// BATCH OPERATIONS (optimized for build-figma-ds.js)
// ============================================================================

/**
 * Batch create variables with values and scopes in a single round-trip.
 * Replaces the create → setValue → setScopes triple-call pattern.
 *
 * Two-pass dependency pattern (from variables-styles-extractor):
 *   Pass 1: Create variables + set raw values + set scopes
 *   Pass 2: Use batch_set_variable_aliases for VARIABLE_ALIAS refs
 *
 * Each variable definition:
 *   { name, resolvedType, values: { [modeId]: rawValue }, scopes? }
 */
interface BatchVarDef {
  name: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  values: Record<string, string | number | boolean | { r: number; g: number; b: number; a?: number }>;
  scopes?: VariableScope[];
  description?: string;
}

interface BatchCreateVariablesPayload {
  collectionId: string;
  variables: BatchVarDef[];
}

interface BatchCreateVariablesResult {
  created: number;
  varIds: Record<string, string>;
  errors: string[];
}

async function batchCreateVariables(payload: BatchCreateVariablesPayload): Promise<BatchCreateVariablesResult> {
  var collection = await figma.variables.getVariableCollectionByIdAsync(payload.collectionId);
  if (!collection) {
    throw new Error('Collection not found: ' + payload.collectionId);
  }

  var varIds: Record<string, string> = {};
  var errors: string[] = [];
  var created = 0;

  for (var i = 0; i < payload.variables.length; i++) {
    var def = payload.variables[i];
    try {
      // 1. Create variable
      var variable = figma.variables.createVariable(def.name, collection, def.resolvedType);

      // 2. Set values for each mode (raw values only — aliases handled in Pass 2)
      var modeIds = Object.keys(def.values);
      for (var m = 0; m < modeIds.length; m++) {
        var modeId = modeIds[m];
        var rawValue = def.values[modeId];
        variable.setValueForMode(modeId, rawValue);
      }

      // 3. Set scopes if provided
      if (def.scopes && def.scopes.length > 0) {
        variable.scopes = def.scopes;
      }

      // 4. Set description if provided
      if (def.description) {
        variable.description = def.description;
      }

      varIds[def.name] = variable.id;
      created++;
    } catch (err) {
      var errMsg = err instanceof Error ? err.message : String(err);
      errors.push(def.name + ': ' + errMsg);
    }
  }

  return { created: created, varIds: varIds, errors: errors };
}

/**
 * Batch set VARIABLE_ALIAS references (Pass 2 of two-pass pattern).
 * Call this after batch_create_variables when all target variables exist.
 */
interface AliasRef {
  variableId: string;
  modeId: string;
  aliasTargetId: string;
}

interface BatchSetVariableAliasesPayload {
  aliases: AliasRef[];
}

interface BatchSetVariableAliasesResult {
  set: number;
  errors: string[];
}

async function batchSetVariableAliases(payload: BatchSetVariableAliasesPayload): Promise<BatchSetVariableAliasesResult> {
  var setCount = 0;
  var errors: string[] = [];

  for (var i = 0; i < payload.aliases.length; i++) {
    var ref = payload.aliases[i];
    try {
      var variable = await figma.variables.getVariableByIdAsync(ref.variableId);
      if (!variable) {
        errors.push('Variable not found: ' + ref.variableId);
        continue;
      }

      var targetVar = await figma.variables.getVariableByIdAsync(ref.aliasTargetId);
      if (!targetVar) {
        errors.push('Alias target not found: ' + ref.aliasTargetId);
        continue;
      }

      var alias = figma.variables.createVariableAlias(targetVar);
      variable.setValueForMode(ref.modeId, alias);
      setCount++;
    } catch (err) {
      var errMsg = err instanceof Error ? err.message : String(err);
      errors.push(ref.variableId + ': ' + errMsg);
    }
  }

  return { set: setCount, errors: errors };
}

/**
 * Batch create text styles and effect styles in a single round-trip.
 * Handles font loading internally.
 */
interface BatchTextStyleDef {
  name: string;
  fontFamily: string;
  fontStyle?: string;
  fontSize: number;
  lineHeight?: { value: number; unit: 'PIXELS' | 'PERCENT' | 'AUTO' };
  letterSpacing?: { value: number; unit: 'PIXELS' | 'PERCENT' };
  description?: string;
}

interface BatchEffectStyleDef {
  name: string;
  effects: Effect[];
  description?: string;
}

interface BatchCreateStylesPayload {
  textStyles?: BatchTextStyleDef[];
  effectStyles?: BatchEffectStyleDef[];
}

interface BatchCreateStylesResult {
  textStyleIds: Record<string, string>;
  effectStyleIds: Record<string, string>;
  textCount: number;
  effectCount: number;
  errors: string[];
}

async function batchCreateStyles(payload: BatchCreateStylesPayload): Promise<BatchCreateStylesResult> {
  var textStyleIds: Record<string, string> = {};
  var effectStyleIds: Record<string, string> = {};
  var errors: string[] = [];
  var textCount = 0;
  var effectCount = 0;

  // Create text styles
  if (payload.textStyles) {
    // Pre-load all unique fonts
    var fontSet: Record<string, boolean> = {};
    for (var i = 0; i < payload.textStyles.length; i++) {
      var ts = payload.textStyles[i];
      var fontKey = ts.fontFamily + '|' + (ts.fontStyle || 'Regular');
      fontSet[fontKey] = true;
    }
    var fontKeys = Object.keys(fontSet);
    for (var f = 0; f < fontKeys.length; f++) {
      var parts = fontKeys[f].split('|');
      try {
        await figma.loadFontAsync({ family: parts[0], style: parts[1] });
      } catch (err) {
        errors.push('Font load failed: ' + fontKeys[f]);
      }
    }

    // Create styles
    for (var j = 0; j < payload.textStyles.length; j++) {
      var def = payload.textStyles[j];
      try {
        var style = figma.createTextStyle();
        style.name = def.name;
        style.fontName = { family: def.fontFamily, style: def.fontStyle || 'Regular' };
        style.fontSize = def.fontSize;

        if (def.lineHeight) {
          if (def.lineHeight.unit === 'AUTO') {
            style.lineHeight = { unit: 'AUTO' };
          } else {
            style.lineHeight = { value: def.lineHeight.value, unit: def.lineHeight.unit };
          }
        }

        if (def.letterSpacing) {
          style.letterSpacing = { value: def.letterSpacing.value, unit: def.letterSpacing.unit };
        }

        if (def.description) {
          style.description = def.description;
        }

        textStyleIds[def.name] = style.id;
        textCount++;
      } catch (err) {
        var errMsg = err instanceof Error ? err.message : String(err);
        errors.push('Text style ' + def.name + ': ' + errMsg);
      }
    }
  }

  // Create effect styles
  if (payload.effectStyles) {
    for (var k = 0; k < payload.effectStyles.length; k++) {
      var eDef = payload.effectStyles[k];
      try {
        var eStyle = figma.createEffectStyle();
        eStyle.name = eDef.name;
        eStyle.effects = eDef.effects;

        if (eDef.description) {
          eStyle.description = eDef.description;
        }

        effectStyleIds[eDef.name] = eStyle.id;
        effectCount++;
      } catch (err) {
        var errMsg2 = err instanceof Error ? err.message : String(err);
        errors.push('Effect style ' + eDef.name + ': ' + errMsg2);
      }
    }
  }

  return {
    textStyleIds: textStyleIds,
    effectStyleIds: effectStyleIds,
    textCount: textCount,
    effectCount: effectCount,
    errors: errors
  };
}

// ============================================================================
// PLUGIN INITIALIZATION
// ============================================================================

figma.showUI(__html__, {
  width: 400,
  height: 500,
  themeColors: true
});


// Send file info immediately to trigger HTTP registration
sendFileInfo();

// Notify when plugin closes
figma.on('close', () => {
  isPluginActive = false;
});

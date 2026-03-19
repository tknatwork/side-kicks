/**
 * @dsb/figma-api — Thin async-safe wrappers around Figma Plugin API.
 *
 * All modules are ES2017-compatible for the Figma QuickJS sandbox.
 * All functions return Result<T, E> for explicit error handling.
 *
 * @module figma-api
 */

// Variables — collections, modes, variables, values, aliases, batch ops
export {
  createCollection,
  getCollections,
  getCollectionById,
  findCollectionByName,
  deleteCollection,
  addMode,
  renameDefaultMode,
  getModeId,
  createVariable,
  getVariableById,
  getVariables,
  findVariableByName,
  deleteVariable,
  setVariableValue,
  setVariableAlias,
  setScopes,
  setDescription,
  setHideFromPublishing,
  batchCreateVariables,
  batchSetAliases,
} from './variables';

// Styles — color, text, effect, grid styles
export {
  createColorStyle,
  updateColorStyle,
  createTextStyle,
  createEffectStyle,
  createGridStyle,
  getColorStyles,
  getTextStyles,
  getEffectStyles,
  deleteStyle,
} from './styles';
export type { TextStyleConfig, ShadowConfig, GridConfig } from './styles';

// Pages — page CRUD operations
export {
  createPage,
  getPages,
  findPageByName,
  setCurrentPage,
  deletePage,
  createPages,
} from './pages';

// Nodes — frames, sections, text, rectangles
export {
  createFrame,
  createSection,
  createText,
  createRectangle,
  appendChild,
  removeNode,
} from './nodes';
export type { FrameConfig, TextConfig } from './nodes';

// Fonts — loading and availability checking
export {
  loadFont,
  loadFonts,
  checkFontAvailability,
  checkFontsAvailability,
  getMissingFonts,
} from './fonts';
export type { FontCheckResult } from './fonts';

// Query — read-only file inspection
export {
  getFileInfo,
  getCollectionDetails,
  getSelectionInfo,
} from './query';
export type { FileInfo, CollectionDetail, SelectionInfo } from './query';

import { serializeNode, type SerializableNode } from "./serializer";

type RequestType =
  | "get_document"
  | "get_selection"
  | "get_node"
  | "get_styles"
  | "get_metadata"
  | "get_design_context"
  | "get_variable_defs"
  | "get_screenshot"
  | "set_node_visibility"
  | "set_text_content"
  | "set_text_properties"
  | "set_node_properties"
  | "set_solid_fill"
  | "set_gradient_fill"
  | "set_effects"
  | "set_stroke_properties"
  | "set_auto_layout"
  | "create_frame"
  | "create_text"
  | "create_shape"
  | "create_image"
  | "duplicate_nodes"
  | "reparent_nodes"
  | "group_nodes"
  | "ungroup_node"
  | "set_selection"
  | "scroll_and_zoom_into_view"
  | "delete_nodes"
  | "list_fonts"
  | "load_fonts"
  | "get_text_styles"
  | "create_text_style"
  | "update_text_style"
  | "apply_text_style"
  | "get_effect_styles"
  | "execute_code"
  | "get_file_digest"
  | "get_variables_deep"
  | "write_variables"
  | "set_grid_layout"
  | "get_annotations"
  | "set_annotation"
  | "get_reactions"
  | "get_motion"
  | "apply_animation_style"
  | "list_shaders"
  | "apply_shader"
  | "set_reactions"
  | "set_flow_starting_point"
  | "create_component_from_node"
  | "combine_as_variants"
  | "add_component_property"
  | "instantiate_component"
  | "set_instance_properties"
  | "swap_instance"
  | "apply_style"
  | "create_paint_style"
  | "create_effect_style"
  | "import_library_asset"
  | "list_library_variables"
  | "create_slot"
  | "get_slots"
  | "reset_slot"
  | "append_to_slot"
  | "create_sticky"
  | "create_shape_with_text"
  | "create_connector"
  | "create_section"
  | "create_table"
  | "create_code_block"
  | "create_gif"
  | "create_slide"
  | "create_slide_row"
  | "set_slide_transition"
  | "set_slide_skip"
  | "focus_slide"
  | "get_slide_grid"
  | "set_slide_grid"
  | "create_buzz_frame"
  | "set_buzz_asset_type"
  | "get_buzz_content"
  | "set_buzz_text"
  | "buzz_smart_resize"
  | "lint_run"
  | "dev_resources";

type ServerRequestParams = Record<string, unknown> & {
  format?: "PNG" | "SVG" | "JPG" | "PDF";
  scale?: number;
  /**
   * When true, export the node using its absolute bounds (the same behavior
   * exposed by Figma REST image export via `use_absolute_bounds`). This clips
   * raster exports such as PNG to the node's logical bounds instead of the
   * rendered/tight bounds including overflow/effects.
   */
  clip?: boolean;
  depth?: number;
};

type ServerRequest = {
  type: RequestType;
  requestId: string;
  nodeIds?: string[];
  params?: ServerRequestParams;
};

type PluginResponse = {
  type: RequestType;
  requestId: string;
  data?: unknown;
  error?: string;
};

let cachedFallbackFileKey: string | null = null;

const FILEKEY_NS = "figmaLimitlessMcp";

// figma.fileKey is only exposed to private plugins with enablePrivatePluginApi
// (absent from this manifest), so in practice EVERY file — drafts and team
// files alike — uses the fallback. The fallback must be BOTH stable across
// plugin restarts (server state — journal, checkpoints, code mappings — is
// bucketed by fileKey) AND unique per file (two drafts named "Untitled" must
// not collide). We persist a random key in the document itself: written once
// on first run, read thereafter. Survives renames and restarts; distinct per
// file. Deriving from the file name (the old approach) collided for
// same-named drafts — surfaced by a real cross-file replication test.
const getFileKey = (): string => {
  let realFileKey: string | null = null;
  try {
    if (typeof figma.fileKey === "string" && figma.fileKey) {
      realFileKey = figma.fileKey;
    }
  } catch {
    // fileKey may not be available in all contexts
  }

  let persisted = "";
  let readFailed = false;
  try {
    persisted = figma.root.getSharedPluginData(FILEKEY_NS, "fileKey");
  } catch {
    // "could not read the key" must never be treated as "no key exists" —
    // minting + writing here would clobber a document's existing key.
    readFailed = true;
  }

  if (realFileKey) {
    if (persisted) {
      // A real fileKey appearing on a document that already has a persisted
      // local key re-buckets its server state. Make the flip visible so the
      // old bucket can be found and migrated.
      console.warn(
        `[figma-limitless-mcp] "${figma.root.name}" now exposes figma.fileKey ` +
          `"${realFileKey}"; earlier state may live under persisted key "${persisted}".`
      );
    }
    return realFileKey;
  }

  if (cachedFallbackFileKey) {
    // Self-heal: if the persisted key was cleared behind our back (a script
    // via execute_code, or the one-time write undone by the user), re-persist
    // the session key so the next run keeps the same bucket.
    if (!readFailed && !persisted) {
      try {
        figma.root.setSharedPluginData(FILEKEY_NS, "fileKey", cachedFallbackFileKey);
      } catch {
        // Best effort — the session key still works.
      }
    } else if (persisted && persisted !== cachedFallbackFileKey) {
      console.warn(
        `[figma-limitless-mcp] Persisted file key changed mid-session ` +
          `("${persisted}" vs "${cachedFallbackFileKey}"); keeping the session key.`
      );
    }
    return cachedFallbackFileKey;
  }

  if (persisted) {
    cachedFallbackFileKey = persisted;
    return persisted;
  }

  const rand =
    Math.floor(Math.random() * 0xffffffff).toString(36) +
    Date.now().toString(36);
  const key = `local-${rand}`;
  let persistedOk = false;
  if (!readFailed) {
    try {
      // One-time, invisible write (shared plugin data is not document content).
      figma.root.setSharedPluginData(FILEKEY_NS, "fileKey", key);
      // Read back: some contexts (e.g. Dev Mode) may silently reject writes.
      persistedOk = figma.root.getSharedPluginData(FILEKEY_NS, "fileKey") === key;
    } catch {
      // If persistence fails, the key still works for this session.
    }
  }
  cachedFallbackFileKey = key;
  console.warn(
    `[figma-limitless-mcp] figma.fileKey unavailable for "${figma.root.name}". ` +
      (persistedOk
        ? `Using persisted per-file key "${key}".`
        : `Using SESSION-ONLY key "${key}" (persistence unavailable — ` +
          `journal/checkpoints will re-bucket on the next run).`)
  );
  return key;
};

const sendStatus = () => {
  figma.ui.postMessage({
    type: "plugin-status",
    payload: {
      fileName: figma.root.name,
      fileKey: getFileKey(),
      selectionCount: figma.currentPage.selection.length,
    },
  });
};

const serializeVariableValue = (value: VariableValue): unknown => {
  if (typeof value === "object" && value !== null) {
    if ("type" in value && value.type === "VARIABLE_ALIAS") {
      return { type: "VARIABLE_ALIAS", id: value.id };
    }
    if ("r" in value && "g" in value && "b" in value) {
      // It's an RGB or RGBA color
      const color = value as RGBA;
      return {
        type: "COLOR",
        r: color.r,
        g: color.g,
        b: color.b,
        a: "a" in color ? color.a : 1,
      };
    }
  }
  return value;
};

const isSceneNode = (node: BaseNode | null): node is SceneNode =>
  node !== null && node.type !== "DOCUMENT" && node.type !== "PAGE";

const isTextNode = (node: BaseNode | null): node is TextNode =>
  node !== null && node.type === "TEXT";

const getSceneNodeById = async (nodeId: string): Promise<SceneNode> => {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!isSceneNode(node)) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  return node;
};

const getTextNodeById = async (nodeId: string): Promise<TextNode> => {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!isTextNode(node)) {
    throw new Error(`Text node not found: ${nodeId}`);
  }
  return node;
};

const supportsChildren = (node: BaseNode): node is BaseNode & ChildrenMixin =>
  "appendChild" in node;

const getParentNodeById = async (
  parentId: string
): Promise<BaseNode & ChildrenMixin> => {
  const parent = await figma.getNodeByIdAsync(parentId);
  if (!parent || parent.type === "DOCUMENT" || !supportsChildren(parent)) {
    throw new Error(`Parent does not support children: ${parentId}`);
  }
  return parent;
};

const parseHexColor = (hex: string): RGB => {
  const normalized = hex.trim().replace(/^#/, "");
  if (normalized.length !== 3 && normalized.length !== 6) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16) / 255,
    g: parseInt(expanded.slice(2, 4), 16) / 255,
    b: parseInt(expanded.slice(4, 6), 16) / 255,
  };
};

const setSolidFill = (
  node: SceneNode,
  fillHex: string,
  fillOpacity?: number,
  target: "fill" | "stroke" = "fill"
): void => {
  const paint: SolidPaint = {
    type: "SOLID",
    color: parseHexColor(fillHex),
    opacity: fillOpacity ?? 1,
  };

  if (target === "stroke") {
    if (!("strokes" in node)) {
      throw new Error(`Node does not support strokes: ${node.id}`);
    }
    (node as GeometryMixin & { strokes: ReadonlyArray<Paint> }).strokes = [paint];
    return;
  }

  if (!("fills" in node)) {
    throw new Error(`Node does not support fills: ${node.id}`);
  }
  (node as GeometryMixin & { fills: ReadonlyArray<Paint> }).fills = [paint];
};

type GradientStopInput = { position: number; hex: string; opacity?: number };
type GradientPaintType =
  | "GRADIENT_LINEAR"
  | "GRADIENT_RADIAL"
  | "GRADIENT_ANGULAR"
  | "GRADIENT_DIAMOND";

const buildGradientPaint = (
  paintType: GradientPaintType,
  stops: GradientStopInput[],
  transform: Transform | undefined,
  opacity: number | undefined
): GradientPaint => {
  const colorStops = stops.map((stop) => {
    const rgb = parseHexColor(stop.hex);
    return {
      position: stop.position,
      color: { r: rgb.r, g: rgb.g, b: rgb.b, a: stop.opacity ?? 1 },
    };
  });
  // Identity transform: [[1,0,0],[0,1,0]] (Figma-default, horizontal L→R).
  const gradientTransform: Transform = transform ?? [
    [1, 0, 0],
    [0, 1, 0],
  ];
  const paint: GradientPaint = {
    type: paintType,
    gradientStops: colorStops,
    gradientTransform,
    opacity: opacity ?? 1,
  };
  return paint;
};

const loadFontsForTextNode = async (node: TextNode): Promise<void> => {
  const fonts = new Map<string, FontName>();

  if (node.characters.length > 0) {
    for (const font of node.getRangeAllFontNames(0, node.characters.length)) {
      fonts.set(`${font.family}::${font.style}`, font);
    }
  } else if (typeof node.fontName !== "symbol") {
    fonts.set(`${node.fontName.family}::${node.fontName.style}`, node.fontName);
  } else {
    throw new Error(
      `Cannot determine font for empty mixed-font text node: ${node.id}`
    );
  }

  await Promise.all([...fonts.values()].map((font) => figma.loadFontAsync(font)));
};

const ensureFont = async (family: string, style: string): Promise<FontName> => {
  const font: FontName = { family, style };
  await figma.loadFontAsync(font);
  return font;
};

const applyTextFill = (
  node: TextNode,
  fillHex: string,
  fillOpacity?: number
): void => {
  node.fills = [
    {
      type: "SOLID",
      color: parseHexColor(fillHex),
      opacity: fillOpacity ?? 1,
    },
  ];
};

const positionNode = (
  node: SceneNode,
  x: unknown,
  y: unknown
): void => {
  if ("x" in node && typeof x === "number") {
    node.x = x;
  }
  if ("y" in node && typeof y === "number") {
    node.y = y;
  }
};

const resizeNodeIfSupported = (
  node: SceneNode,
  width: unknown,
  height: unknown
): void => {
  if (
    typeof width !== "number" &&
    typeof height !== "number"
  ) {
    return;
  }
  if (!("resize" in node) || typeof node.resize !== "function") {
    throw new Error(`Node does not support resizing: ${node.id}`);
  }
  const nextWidth = typeof width === "number" ? width : node.width;
  const nextHeight = typeof height === "number" ? height : node.height;
  node.resize(nextWidth, nextHeight);
};

const appendToParentIfProvided = async (
  node: SceneNode,
  parentId: unknown
): Promise<void> => {
  if (typeof parentId !== "string") {
    return;
  }
  const parent = await getParentNodeById(parentId);
  parent.appendChild(node);
};

const decodeBase64ToBytes = (base64: string): Uint8Array => {
  try {
    return figma.base64Decode(base64);
  } catch {
    throw new Error("Invalid base64 image payload");
  }
};

const FONT_LOAD_BATCH_SIZE = 5;
const MAX_EXECUTE_RESULT_CHARS = 1_000_000;
// Guardrail: heavy reads on detail-rich files can serialize multi-MB trees,
// stalling the bridge and blowing the caller's context window. Cap and
// redirect to the context-efficient alternatives.
const MAX_READ_RESULT_CHARS = 1_500_000;
const HEAVY_READ_HINTS: { [key: string]: string } = {
  get_document:
    "use get_file_digest for orientation, get_design_context with a small depth, or get_node on a specific subtree",
  get_selection:
    "select fewer nodes, or use get_design_context with a small depth",
  get_node:
    "target a smaller subtree, or use get_design_context with a small depth",
  get_design_context: "reduce depth",
  get_styles:
    "use get_text_styles / get_effect_styles for just the detailed sets you need",
};

/** Yields to Figma's UI thread so long batches never freeze the editor. */
const yieldToUI = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

type FontPairInput = { family: string; style: string };

const loadFontsBatched = async (
  fonts: FontPairInput[]
): Promise<
  Array<{ family: string; style: string; loaded: boolean; error?: string }>
> => {
  const results: Array<{
    family: string;
    style: string;
    loaded: boolean;
    error?: string;
  }> = [];
  for (let i = 0; i < fonts.length; i += FONT_LOAD_BATCH_SIZE) {
    const batch = fonts.slice(i, i + FONT_LOAD_BATCH_SIZE);
    const settled = await Promise.all(
      batch.map(async ({ family, style }) => {
        try {
          await figma.loadFontAsync({ family, style });
          return { family, style, loaded: true };
        } catch (err) {
          return {
            family,
            style,
            loaded: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );
    results.push(...settled);
    if (i + FONT_LOAD_BATCH_SIZE < fonts.length) await yieldToUI();
  }
  return results;
};

const parseLineHeight = (raw: unknown): LineHeight => {
  if (!raw || typeof raw !== "object") {
    throw new Error("lineHeight must be {unit:'AUTO'} or {unit,value}");
  }
  const { unit, value } = raw as { unit?: unknown; value?: unknown };
  if (unit === "AUTO") {
    return { unit: "AUTO" };
  }
  if ((unit === "PIXELS" || unit === "PERCENT") && typeof value === "number") {
    return { unit, value };
  }
  throw new Error(
    "lineHeight must be {unit:'AUTO'} or {unit:'PIXELS'|'PERCENT', value:number}"
  );
};

const parseLetterSpacing = (raw: unknown): LetterSpacing => {
  if (!raw || typeof raw !== "object") {
    throw new Error("letterSpacing must be {unit,value}");
  }
  const { unit, value } = raw as { unit?: unknown; value?: unknown };
  if ((unit === "PIXELS" || unit === "PERCENT") && typeof value === "number") {
    return { unit, value };
  }
  throw new Error(
    "letterSpacing must be {unit:'PIXELS'|'PERCENT', value:number}"
  );
};

const isTextCase = (value: unknown): value is TextCase =>
  value === "ORIGINAL" ||
  value === "UPPER" ||
  value === "LOWER" ||
  value === "TITLE" ||
  value === "SMALL_CAPS" ||
  value === "SMALL_CAPS_FORCED";

const isTextDecoration = (value: unknown): value is TextDecoration =>
  value === "NONE" || value === "UNDERLINE" || value === "STRIKETHROUGH";

const resolveTextStyle = async (
  styleId: unknown,
  styleName: unknown
): Promise<TextStyle> => {
  if (typeof styleId === "string" && styleId) {
    const style = await figma.getStyleByIdAsync(styleId);
    if (!style || style.type !== "TEXT") {
      throw new Error(`Text style not found by id: ${styleId}`);
    }
    return style as TextStyle;
  }
  if (typeof styleName === "string" && styleName) {
    const styles = await figma.getLocalTextStylesAsync();
    const style = styles.find((s) => s.name === styleName);
    if (!style) {
      const names = styles.map((s) => s.name).join(", ");
      throw new Error(
        `Text style not found by name: "${styleName}". Local text styles: ${names || "(none)"}`
      );
    }
    return style;
  }
  throw new Error("Either styleId or styleName is required");
};

const serializeTextStyle = (style: TextStyle) => ({
  id: style.id,
  name: style.name,
  description: style.description,
  fontName: style.fontName,
  fontSize: style.fontSize,
  lineHeight: style.lineHeight,
  letterSpacing: style.letterSpacing,
  paragraphSpacing: style.paragraphSpacing,
  paragraphIndent: style.paragraphIndent,
  textCase: style.textCase,
  textDecoration: style.textDecoration,
  boundVariables: style.boundVariables,
});

/**
 * Applies the shared patchable text-style fields (everything except
 * name/description/fontName, which create/update handle differently).
 * The style's font must already be loaded before calling this.
 */
const applyTextStylePatches = (
  style: TextStyle,
  params: Record<string, unknown>,
  applied: Record<string, unknown>
): void => {
  if (typeof params.fontSize === "number") {
    style.fontSize = params.fontSize;
    applied.fontSize = style.fontSize;
  }
  if (params.lineHeight !== undefined) {
    style.lineHeight = parseLineHeight(params.lineHeight);
    applied.lineHeight = style.lineHeight;
  }
  if (params.letterSpacing !== undefined) {
    style.letterSpacing = parseLetterSpacing(params.letterSpacing);
    applied.letterSpacing = style.letterSpacing;
  }
  if (typeof params.paragraphSpacing === "number") {
    style.paragraphSpacing = params.paragraphSpacing;
    applied.paragraphSpacing = style.paragraphSpacing;
  }
  if (typeof params.paragraphIndent === "number") {
    style.paragraphIndent = params.paragraphIndent;
    applied.paragraphIndent = style.paragraphIndent;
  }
  if (isTextCase(params.textCase)) {
    style.textCase = params.textCase;
    applied.textCase = style.textCase;
  }
  if (isTextDecoration(params.textDecoration)) {
    style.textDecoration = params.textDecoration;
    applied.textDecoration = style.textDecoration;
  }
  if (typeof params.description === "string") {
    style.description = params.description;
    applied.description = style.description;
  }
};

/**
 * Converts an execute_code result into a JSON-safe value. Symbols (e.g.
 * figma.mixed) become string markers; functions and undefined are dropped
 * by JSON semantics. Throws a clear error on cyclic/non-serializable data.
 */
const toSerializableResult = (
  result: unknown,
  context = "execute_code"
): unknown => {
  if (result === undefined) {
    return null;
  }
  let json: string;
  try {
    json = JSON.stringify(result, (_key, value) =>
      typeof value === "symbol" ? "<symbol>" : value
    );
  } catch (err) {
    throw new Error(
      `${context} result is not JSON-serializable (avoid returning nodes or cyclic objects — map to plain data first): ` +
        (err instanceof Error ? err.message : String(err))
    );
  }
  if (json === undefined) {
    return null;
  }
  if (json.length > MAX_EXECUTE_RESULT_CHARS) {
    throw new Error(
      `${context} result too large (${json.length} chars > ${MAX_EXECUTE_RESULT_CHARS}). Return a narrower slice of data.`
    );
  }
  return JSON.parse(json);
};

/** Parses a variable value for the given resolved type (hex strings become RGBA). */
const parseVariableValue = (
  resolvedType: VariableResolvedDataType,
  value: unknown
): VariableValue => {
  if (resolvedType === "COLOR") {
    if (typeof value === "string") {
      const rgb = parseHexColor(value);
      return { r: rgb.r, g: rgb.g, b: rgb.b, a: 1 };
    }
    if (value && typeof value === "object" && "r" in value) {
      const c = value as { r: number; g: number; b: number; a?: number };
      return { r: c.r, g: c.g, b: c.b, a: typeof c.a === "number" ? c.a : 1 };
    }
    throw new Error("COLOR value must be a hex string or {r,g,b,a?}");
  }
  if (resolvedType === "FLOAT" && typeof value === "number") return value;
  if (resolvedType === "STRING" && typeof value === "string") return value;
  if (resolvedType === "BOOLEAN" && typeof value === "boolean") return value;
  throw new Error(
    `Value ${JSON.stringify(value)} does not match resolvedType ${resolvedType}`
  );
};

/** Fields where "$N.field" back-references are resolved. Restricting to id
 * fields keeps legitimate string VALUES (e.g. a STRING variable's value of
 * "$0.spacing") from being hijacked. */
const REF_FIELDS = new Set([
  "collectionId",
  "variableId",
  "modeId",
  "aliasVariableId",
  "nodeId",
]);

const REF_PATTERN = /^\$\d+\.[a-zA-Z]+$/;

const resolveRefString = (
  value: string,
  results: Array<Record<string, unknown>>
): unknown => {
  const dot = value.indexOf(".");
  const index = parseInt(value.slice(1, dot), 10);
  const field = value.slice(dot + 1);
  const source = results[index];
  if (!source || source.error !== undefined) {
    throw new Error(`Reference ${value} points to a missing or failed action result`);
  }
  const referenced = source[field];
  if (referenced === undefined) {
    throw new Error(
      `Reference ${value} not found — action ${index} returned fields: ${Object.keys(source).join(", ")}`
    );
  }
  return referenced;
};

/**
 * Resolves "$N.field" references in a write_variables action against the
 * results of earlier actions in the same batch, so a single call can create
 * a collection, add modes, and create variables inside it. Only id-bearing
 * fields (and valuesByMode KEYS) are resolved.
 */
const resolveActionRefs = (
  action: Record<string, unknown>,
  results: Array<Record<string, unknown>>
): Record<string, unknown> => {
  const resolved: Record<string, unknown> = {};
  for (const key of Object.keys(action)) {
    const value = action[key];
    if (REF_FIELDS.has(key) && typeof value === "string" && REF_PATTERN.test(value)) {
      resolved[key] = resolveRefString(value, results);
    } else if (key === "valuesByMode" && value && typeof value === "object") {
      const mapped: Record<string, unknown> = {};
      for (const [modeKey, modeValue] of Object.entries(
        value as Record<string, unknown>
      )) {
        const resolvedKey = REF_PATTERN.test(modeKey)
          ? String(resolveRefString(modeKey, results))
          : modeKey;
        mapped[resolvedKey] = modeValue;
      }
      resolved[key] = mapped;
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
};

/** Builds a validated Effect[] from raw tool params (shared by set_effects and create_effect_style). */
const buildEffectsFromParams = (rawEffects: unknown): Effect[] => {
  if (!Array.isArray(rawEffects)) {
    throw new Error("effects must be an array (pass [] to clear)");
  }
  return (rawEffects as Array<Record<string, unknown>>).map((raw, i): Effect => {
    const type = raw.type;
    if (type === "DROP_SHADOW" || type === "INNER_SHADOW") {
      if (typeof raw.color !== "string") {
        throw new Error(`effects[${i}].color must be a hex string`);
      }
      const offset = raw.offset as { x?: unknown; y?: unknown } | undefined;
      if (!offset || typeof offset.x !== "number" || typeof offset.y !== "number") {
        throw new Error(`effects[${i}].offset must be {x,y} numbers`);
      }
      if (typeof raw.radius !== "number") {
        throw new Error(`effects[${i}].radius must be a number`);
      }
      const rgb = parseHexColor(raw.color);
      const alpha = typeof raw.opacity === "number" ? raw.opacity : 1;
      return {
        type,
        color: { r: rgb.r, g: rgb.g, b: rgb.b, a: alpha },
        offset: { x: offset.x, y: offset.y },
        radius: raw.radius,
        spread: typeof raw.spread === "number" ? raw.spread : 0,
        visible: raw.visible === undefined ? true : Boolean(raw.visible),
        blendMode:
          typeof raw.blendMode === "string" ? (raw.blendMode as BlendMode) : "NORMAL",
      };
    }
    if (type === "LAYER_BLUR" || type === "BACKGROUND_BLUR") {
      if (typeof raw.radius !== "number") {
        throw new Error(`effects[${i}].radius must be a number`);
      }
      return {
        type,
        radius: raw.radius,
        visible: raw.visible === undefined ? true : Boolean(raw.visible),
      } as Effect;
    }
    throw new Error(`Unsupported effect type at effects[${i}]: ${String(type)}`);
  });
};

/** Finds the page that contains a node (walks up the parent chain). */
const getPageOfNode = (node: BaseNode): PageNode => {
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE") {
    current = current.parent;
  }
  if (!current) throw new Error(`Node is not on any page: ${node.id}`);
  return current as PageNode;
};

/** Resolves a local component (or a set's default variant) for instancing/swapping. */
const resolveComponentForInstance = async (
  componentId: unknown,
  componentKey: unknown
): Promise<ComponentNode> => {
  if (typeof componentKey === "string" && componentKey) {
    try {
      return await figma.importComponentByKeyAsync(componentKey);
    } catch (componentErr) {
      // The key may belong to a component SET — try that before failing,
      // but keep BOTH errors visible when neither import works.
      try {
        const set = await figma.importComponentSetByKeyAsync(componentKey);
        return set.defaultVariant;
      } catch (setErr) {
        throw new Error(
          `Component import failed (${componentErr instanceof Error ? componentErr.message : String(componentErr)}); ` +
            `component-set import failed (${setErr instanceof Error ? setErr.message : String(setErr)}) — ` +
            `check that the key belongs to a PUBLISHED component or component set`
        );
      }
    }
  }
  if (typeof componentId === "string" && componentId) {
    const node = await figma.getNodeByIdAsync(componentId);
    if (!node) throw new Error(`Component not found: ${componentId}`);
    if (node.type === "COMPONENT") return node;
    if (node.type === "COMPONENT_SET") return node.defaultVariant;
    throw new Error(
      `Node ${componentId} is ${node.type}, expected COMPONENT or COMPONENT_SET`
    );
  }
  throw new Error("componentKey or componentId is required");
};

/** Property keys on a component/set, with '#' suffixes — for helpful errors. */
const listComponentPropertyKeys = (main: ComponentNode): string[] => {
  const owner =
    main.parent?.type === "COMPONENT_SET" ? main.parent : main;
  try {
    return Object.keys(
      (owner as ComponentNode | ComponentSetNode).componentPropertyDefinitions
    );
  } catch {
    return [];
  }
};

const requireMotionApi = (): MotionAPI => {
  if (!("motion" in figma)) {
    throw new Error(
      "Motion API unavailable — requires Figma Desktop with the Motion beta (June 2026+). Update Figma or enable the beta."
    );
  }
  return figma.motion;
};

const EDIT_REQUEST_TYPES = new Set<RequestType>([
  "set_node_visibility",
  "set_text_content",
  "set_text_properties",
  "set_node_properties",
  "set_solid_fill",
  "set_gradient_fill",
  "set_effects",
  "set_stroke_properties",
  "set_auto_layout",
  "create_frame",
  "create_text",
  "create_shape",
  "create_image",
  "duplicate_nodes",
  "reparent_nodes",
  "group_nodes",
  "ungroup_node",
  "delete_nodes",
  "create_text_style",
  "update_text_style",
  "apply_text_style",
  "write_variables",
  "set_grid_layout",
  // set_annotation deliberately NOT gated: annotations are Dev Mode's
  // legitimate write surface. dev_resources likewise.
  "apply_animation_style",
  "apply_shader",
  "set_reactions",
  "set_flow_starting_point",
  "create_component_from_node",
  "combine_as_variants",
  "add_component_property",
  "instantiate_component",
  "set_instance_properties",
  "swap_instance",
  "apply_style",
  "create_paint_style",
  "create_effect_style",
  "import_library_asset",
  "create_slot",
  "reset_slot",
  "append_to_slot",
]);

const requireEditorMode = (toolName: RequestType): void => {
  // The plugin runs across multiple editors (figma/figjam/slides/buzz/dev), but
  // design-canvas write tools only apply to the design-style surfaces. Reject up
  // front with a clear, editor-specific hint instead of a confusing runtime error.
  const editor = figma.editorType;
  if (editor === "dev") {
    throw new Error(
      `${toolName} requires an editable surface — Dev Mode is read-only. Switch to the design editor and re-run.`
    );
  }
  if (editor === "figjam") {
    throw new Error(
      `${toolName} is a design-canvas tool and isn't available in FigJam. Use FigJam-native creation (figma.createSticky/createConnector/createSection/…) via execute_code, or run this tool in a Figma design file.`
    );
  }
};

const FIGJAM_REQUEST_TYPES = new Set<RequestType>([
  "create_sticky",
  "create_shape_with_text",
  "create_connector",
  "create_section",
  "create_table",
  "create_code_block",
  "create_gif",
]);

const requireFigJam = (toolName: RequestType): void => {
  if (figma.editorType !== "figjam") {
    throw new Error(
      `${toolName} is a FigJam tool and only runs in a FigJam file (current editor: ${figma.editorType}). Open a FigJam board and re-run.`
    );
  }
};

const SLIDES_REQUEST_TYPES = new Set<RequestType>([
  "create_slide",
  "create_slide_row",
  "set_slide_transition",
  "set_slide_skip",
  "focus_slide",
  "get_slide_grid",
  "set_slide_grid",
]);

const requireSlides = (toolName: RequestType): void => {
  if (figma.editorType !== "slides") {
    throw new Error(
      `${toolName} is a Figma Slides tool and only runs in a Slides file (current editor: ${figma.editorType}). Open a Slides file and re-run.`
    );
  }
};

const BUZZ_REQUEST_TYPES = new Set<RequestType>([
  "create_buzz_frame",
  "set_buzz_asset_type",
  "get_buzz_content",
  "set_buzz_text",
  "buzz_smart_resize",
]);

const requireBuzz = (toolName: RequestType): void => {
  if (figma.editorType !== "buzz") {
    throw new Error(
      `${toolName} is a Figma Buzz tool and only runs in a Buzz file (current editor: ${figma.editorType}). Open a Buzz file and re-run.`
    );
  }
};

const solidPaintFromHex = (hex: string): SolidPaint => ({
  type: "SOLID",
  color: parseHexColor(hex),
});

// FigJam text lives in a TextSublayerNode; setting characters requires the
// sublayer's font loaded first (Inter Medium is the FigJam default).
const setSublayerText = async (
  sublayer: TextSublayerNode,
  text: string
): Promise<void> => {
  const font = sublayer.fontName;
  if (typeof font === "symbol") {
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  } else {
    await figma.loadFontAsync(font);
  }
  sublayer.characters = text;
};

const handleRequest = async (
  request: ServerRequest
): Promise<PluginResponse> => {
  try {
    if (EDIT_REQUEST_TYPES.has(request.type)) {
      requireEditorMode(request.type);
    }
    if (FIGJAM_REQUEST_TYPES.has(request.type)) {
      requireFigJam(request.type);
    }
    if (SLIDES_REQUEST_TYPES.has(request.type)) {
      requireSlides(request.type);
    }
    if (BUZZ_REQUEST_TYPES.has(request.type)) {
      requireBuzz(request.type);
    }
    switch (request.type) {
      case "get_document":
        return {
          type: request.type,
          requestId: request.requestId,
          data: serializeNode(figma.currentPage),
        };
      case "get_selection":
        return {
          type: request.type,
          requestId: request.requestId,
          data: figma.currentPage.selection.map((node) => serializeNode(node)),
        };
      case "get_node": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) {
          throw new Error("nodeIds is required for get_node");
        }
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node || node.type === "DOCUMENT") {
          throw new Error(`Node not found: ${nodeId}`);
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: serializeNode(node as SceneNode),
        };
      }
      case "get_styles": {
        const [paintStyles, textStyles, effectStyles, gridStyles] =
          await Promise.all([
            figma.getLocalPaintStylesAsync(),
            figma.getLocalTextStylesAsync(),
            figma.getLocalEffectStylesAsync(),
            figma.getLocalGridStylesAsync(),
          ]);
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            paints: paintStyles.map((style) => ({
              id: style.id,
              name: style.name,
              paints: style.paints,
            })),
            text: textStyles.map((style) => ({
              id: style.id,
              name: style.name,
              fontSize: style.fontSize,
              fontName: style.fontName,
              textDecoration: style.textDecoration,
              lineHeight: style.lineHeight,
              letterSpacing: style.letterSpacing,
            })),
            effects: effectStyles.map((style) => ({
              id: style.id,
              name: style.name,
              effects: style.effects,
            })),
            grids: gridStyles.map((style) => ({
              id: style.id,
              name: style.name,
              layoutGrids: style.layoutGrids,
            })),
          },
        };
      }
      case "get_metadata": {
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            fileName: figma.root.name,
            currentPageId: figma.currentPage.id,
            currentPageName: figma.currentPage.name,
            pageCount: figma.root.children.length,
            pages: figma.root.children.map((page) => ({
              id: page.id,
              name: page.name,
            })),
          },
        };
      }
      case "get_design_context": {
        const depth =
          typeof request.params?.depth === "number" ? request.params.depth : 2;
        const serializeWithDepth = async (
          node: SerializableNode,
          currentDepth: number
        ): Promise<ReturnType<typeof serializeNode>> => {
          const serialized = serializeNode(node);
          if (currentDepth >= depth && serialized.children) {
            // Truncate children at depth limit, but show count
            return {
              ...serialized,
              children: undefined,
              childCount:
                (node as ChildrenMixin & SceneNode).children?.filter(
                  (c) => c.visible !== false
                ).length ?? 0,
            } as ReturnType<typeof serializeNode> & { childCount: number };
          }
          if (serialized.children) {
            const childNodes = await Promise.all(
              serialized.children.map((child) =>
                figma.getNodeByIdAsync(child.id)
              )
            );
            const serializedChildren = await Promise.all(
              childNodes
                .filter(
                  (n): n is SceneNode =>
                    n !== null &&
                    n.type !== "DOCUMENT" &&
                    "visible" in n &&
                    n.visible !== false
                )
                .map((n) => serializeWithDepth(n, currentDepth + 1))
            );
            return {
              ...serialized,
              children: serializedChildren,
            };
          }
          return serialized;
        };

        const selection = figma.currentPage.selection;
        const contextNodes =
          selection.length > 0
            ? await Promise.all(
                selection.map((node) => serializeWithDepth(node, 0))
              )
            : [
                await serializeWithDepth(figma.currentPage, 0),
              ];

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            fileName: figma.root.name,
            currentPage: {
              id: figma.currentPage.id,
              name: figma.currentPage.name,
            },
            selectionCount: selection.length,
            context: contextNodes,
          },
        };
      }
      case "get_variable_defs": {
        const collections =
          await figma.variables.getLocalVariableCollectionsAsync();
        const variableData = await Promise.all(
          collections.map(async (collection) => {
            const variables = await Promise.all(
              collection.variableIds.map((id) =>
                figma.variables.getVariableByIdAsync(id)
              )
            );
            return {
              id: collection.id,
              name: collection.name,
              modes: collection.modes.map((mode) => ({
                modeId: mode.modeId,
                name: mode.name,
              })),
              variables: variables
                .filter((v): v is Variable => v !== null)
                .map((variable) => ({
                  id: variable.id,
                  name: variable.name,
                  resolvedType: variable.resolvedType,
                  valuesByMode: Object.fromEntries(
                    Object.entries(variable.valuesByMode).map(
                      ([modeId, value]) => [
                        modeId,
                        serializeVariableValue(value),
                      ]
                    )
                  ),
                })),
            };
          })
        );
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            collections: variableData,
          },
        };
      }
      case "get_screenshot": {
        const format =
          request.params?.format === "SVG" ||
          request.params?.format === "PDF" ||
          request.params?.format === "JPG" ||
          request.params?.format === "PNG"
            ? request.params.format
            : "PNG";
        const scale =
          typeof request.params?.scale === "number" ? request.params.scale : 2;
        const clip = request.params?.clip === true;

        // Determine which node(s) to export
        let targetNodes: SceneNode[];
        if (request.nodeIds && request.nodeIds.length > 0) {
          const nodes = await Promise.all(
            request.nodeIds.map((id) => figma.getNodeByIdAsync(id))
          );
          targetNodes = nodes.filter(
            (node): node is SceneNode =>
              node !== null && node.type !== "DOCUMENT" && node.type !== "PAGE"
          );
        } else {
          targetNodes = [...figma.currentPage.selection];
        }

        if (targetNodes.length === 0) {
          throw new Error(
            "No nodes to export. Select nodes or provide nodeIds."
          );
        }

        const exports = await Promise.all(
          targetNodes.map(async (node) => {
            const commonSettings = clip
              ? { contentsOnly: true, useAbsoluteBounds: true }
              : {};
            const settings: ExportSettings =
              format === "SVG"
                ? { format: "SVG", ...commonSettings }
                : format === "PDF"
                  ? { format: "PDF", ...commonSettings }
                  : format === "JPG"
                    ? {
                        format: "JPG",
                        constraint: { type: "SCALE", value: scale },
                        ...commonSettings,
                      }
                    : {
                        format: "PNG",
                        constraint: { type: "SCALE", value: scale },
                        ...commonSettings,
                      };

            const bytes = await node.exportAsync(settings);
            const base64 = figma.base64Encode(bytes);
            return {
              nodeId: node.id,
              nodeName: node.name,
              format,
              base64,
              width: node.width,
              height: node.height,
            };
          })
        );

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            exports,
          },
        };
      }
      case "set_node_visibility": {
        const rawItems = request.params?.items;
        if (!Array.isArray(rawItems) || rawItems.length === 0) {
          throw new Error("items is required for set_node_visibility");
        }
        const items = rawItems as Array<{ nodeId: string; visible: boolean }>;
        const results: Array<
          | { nodeId: string; previousVisible: boolean; visible: boolean }
          | { nodeId: string; error: string }
        > = [];
        for (const { nodeId, visible } of items) {
          const node = await figma.getNodeByIdAsync(nodeId);
          if (!node || node.type === "DOCUMENT" || node.type === "PAGE") {
            results.push({ nodeId, error: `Node not found: ${nodeId}` });
            continue;
          }
          const sceneNode = node as SceneNode;
          const previousVisible = sceneNode.visible;
          sceneNode.visible = visible;
          results.push({ nodeId, previousVisible, visible });
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: { results },
        };
      }
      case "set_text_content": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        const text = request.params?.text;
        if (!nodeId) {
          throw new Error("nodeIds is required for set_text_content");
        }
        if (typeof text !== "string") {
          throw new Error("text is required for set_text_content");
        }

        const node = await getTextNodeById(nodeId);
        await loadFontsForTextNode(node);

        const previousCharacters = node.characters;
        node.characters = text;

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            nodeName: node.name,
            previousCharacters,
            characters: node.characters,
          },
        };
      }
      case "set_text_properties": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) {
          throw new Error("nodeIds is required for set_text_properties");
        }

        const node = await getTextNodeById(nodeId);
        const params = request.params ?? {};
        const applied: Record<string, unknown> = {};

        await loadFontsForTextNode(node);

        if (typeof params.fontFamily === "string" || typeof params.fontStyle === "string") {
          const currentFontName =
            typeof node.fontName === "symbol" ? null : node.fontName;
          const nextFamily =
            typeof params.fontFamily === "string"
              ? params.fontFamily
              : currentFontName?.family;
          const nextStyle =
            typeof params.fontStyle === "string"
              ? params.fontStyle
              : currentFontName?.style;

          if (!nextFamily || !nextStyle) {
            throw new Error(
              "fontFamily and fontStyle must resolve to a concrete font for set_text_properties"
            );
          }

          node.fontName = await ensureFont(nextFamily, nextStyle);
          applied.fontName = node.fontName;
        }

        if (typeof params.fontSize === "number") {
          node.fontSize = params.fontSize;
          applied.fontSize = node.fontSize;
        }

        if (
          params.textAlignHorizontal === "LEFT" ||
          params.textAlignHorizontal === "CENTER" ||
          params.textAlignHorizontal === "RIGHT" ||
          params.textAlignHorizontal === "JUSTIFIED"
        ) {
          node.textAlignHorizontal = params.textAlignHorizontal;
          applied.textAlignHorizontal = node.textAlignHorizontal;
        }

        if (
          params.textAlignVertical === "TOP" ||
          params.textAlignVertical === "CENTER" ||
          params.textAlignVertical === "BOTTOM"
        ) {
          node.textAlignVertical = params.textAlignVertical;
          applied.textAlignVertical = node.textAlignVertical;
        }

        if (
          params.textAutoResize === "NONE" ||
          params.textAutoResize === "WIDTH_AND_HEIGHT" ||
          params.textAutoResize === "HEIGHT" ||
          params.textAutoResize === "TRUNCATE"
        ) {
          node.textAutoResize = params.textAutoResize;
          applied.textAutoResize = node.textAutoResize;
        }

        if (typeof params.lineHeightPx === "number") {
          node.lineHeight = {
            unit: "PIXELS",
            value: params.lineHeightPx,
          };
          applied.lineHeight = node.lineHeight;
        }

        if (typeof params.letterSpacingPx === "number") {
          node.letterSpacing = {
            unit: "PIXELS",
            value: params.letterSpacingPx,
          };
          applied.letterSpacing = node.letterSpacing;
        }

        if (typeof params.fillHex === "string") {
          const fillOpacity =
            typeof params.fillOpacity === "number" ? params.fillOpacity : undefined;
          applyTextFill(node, params.fillHex, fillOpacity);
          applied.fillHex = params.fillHex;
          applied.fillOpacity = fillOpacity ?? 1;
        }

        if (typeof params.x === "number" || typeof params.y === "number") {
          positionNode(node, params.x, params.y);
          applied.x = node.x;
          applied.y = node.y;
        }

        resizeNodeIfSupported(node, params.width, params.height);
        if (typeof params.width === "number" || typeof params.height === "number") {
          applied.width = node.width;
          applied.height = node.height;
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            nodeName: node.name,
            applied,
          },
        };
      }
      case "set_node_properties": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) {
          throw new Error("nodeIds is required for set_node_properties");
        }

        const node = await getSceneNodeById(nodeId);
        const params = request.params ?? {};
        const applied: Record<string, unknown> = {};
        const hasUpdates = Object.keys(params).length > 0;

        if (!hasUpdates) {
          throw new Error("At least one property is required for set_node_properties");
        }

        if (typeof params.name === "string") {
          node.name = params.name;
          applied.name = node.name;
        }

        if (typeof params.visible === "boolean") {
          node.visible = params.visible;
          applied.visible = node.visible;
        }

        if (typeof params.x === "number" || typeof params.y === "number") {
          if (!("x" in node) || !("y" in node)) {
            throw new Error(`Node does not support x/y positioning: ${nodeId}`);
          }
          positionNode(node, params.x, params.y);
          applied.x = node.x;
          applied.y = node.y;
        }

        if (typeof params.width === "number" || typeof params.height === "number") {
          resizeNodeIfSupported(node, params.width, params.height);
          applied.width = node.width;
          applied.height = node.height;
        }

        if (typeof params.rotation === "number") {
          if (!("rotation" in node)) {
            throw new Error(`Node does not support rotation: ${node.id}`);
          }
          node.rotation = params.rotation;
          applied.rotation = node.rotation;
        }

        if (typeof params.opacity === "number") {
          if (!("opacity" in node)) {
            throw new Error(`Node does not support opacity: ${node.id}`);
          }
          node.opacity = params.opacity;
          applied.opacity = node.opacity;
        }

        if (typeof params.cornerRadius === "number") {
          if (!("cornerRadius" in node)) {
            throw new Error(`Node does not support cornerRadius: ${nodeId}`);
          }
          // cornerRadius is writable on CornerMixin nodes (rect/frame/etc.);
          // the narrowed SceneNode union types it readonly, so target the mixin
          // for the write. The read-back below is already allowed.
          (node as CornerMixin).cornerRadius = params.cornerRadius;
          applied.cornerRadius = node.cornerRadius;
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            nodeName: node.name,
            applied,
          },
        };
      }
      case "set_solid_fill": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) {
          throw new Error("nodeIds is required for set_solid_fill");
        }

        const node = await getSceneNodeById(nodeId);
        const params = request.params ?? {};

        if (typeof params.hex !== "string") {
          throw new Error("hex is required");
        }
        const target = params.target === "stroke" ? "stroke" : "fill";
        const opacity =
          typeof params.opacity === "number" ? params.opacity : undefined;

        setSolidFill(node, params.hex, opacity, target);

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            nodeName: node.name,
            applied: {
              target,
              hex: params.hex,
              opacity: opacity ?? 1,
            },
          },
        };
      }
      case "set_gradient_fill": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) {
          throw new Error("nodeIds is required for set_gradient_fill");
        }

        const node = await getSceneNodeById(nodeId);
        const params = request.params ?? {};

        const target = params.target === "stroke" ? "stroke" : "fill";
        if (target === "fill" && !("fills" in node)) {
          throw new Error(`Node does not support fills: ${node.id}`);
        }
        if (target === "stroke" && !("strokes" in node)) {
          throw new Error(`Node does not support strokes: ${node.id}`);
        }

        const gradientType =
          typeof params.gradientType === "string"
            ? (params.gradientType as string)
            : "LINEAR";
        const paintType = `GRADIENT_${gradientType}` as GradientPaintType;
        if (
          paintType !== "GRADIENT_LINEAR" &&
          paintType !== "GRADIENT_RADIAL" &&
          paintType !== "GRADIENT_ANGULAR" &&
          paintType !== "GRADIENT_DIAMOND"
        ) {
          throw new Error(`Unsupported gradient type: ${gradientType}`);
        }

        if (!Array.isArray(params.gradientStops) || params.gradientStops.length < 2) {
          throw new Error("gradientStops must have at least 2 entries");
        }
        const stops = params.gradientStops as GradientStopInput[];

        const transform =
          Array.isArray(params.gradientTransform) && params.gradientTransform.length === 2
            ? (params.gradientTransform as Transform)
            : undefined;

        const opacity =
          typeof params.opacity === "number" ? params.opacity : undefined;

        const paint = buildGradientPaint(paintType, stops, transform, opacity);

        if (target === "fill") {
          (node as GeometryMixin & { fills: ReadonlyArray<Paint> }).fills = [paint];
        } else {
          (node as GeometryMixin & { strokes: ReadonlyArray<Paint> }).strokes = [paint];
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            nodeName: node.name,
            applied: {
              target,
              gradientType: paintType,
              stops: paint.gradientStops.length,
            },
          },
        };
      }
      case "set_effects": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) {
          throw new Error("nodeIds is required for set_effects");
        }

        const node = await getSceneNodeById(nodeId);
        if (!("effects" in node)) {
          throw new Error(`Node does not support effects: ${node.id}`);
        }

        const params = request.params ?? {};
        const built = buildEffectsFromParams(params.effects);

        (node as BlendMixin & { effects: ReadonlyArray<Effect> }).effects = built;

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            nodeName: node.name,
            applied: { count: built.length },
          },
        };
      }
      case "set_stroke_properties": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) {
          throw new Error("nodeIds is required for set_stroke_properties");
        }

        const node = await getSceneNodeById(nodeId);
        const params = request.params ?? {};
        const applied: Record<string, unknown> = {};

        if (typeof params.strokeWeight === "number") {
          if (!("strokeWeight" in node)) {
            throw new Error(`Node does not support strokeWeight: ${node.id}`);
          }
          (node as MinimalStrokesMixin).strokeWeight = params.strokeWeight;
          applied.strokeWeight = params.strokeWeight;
        }

        if (
          params.strokeAlign === "INSIDE" ||
          params.strokeAlign === "OUTSIDE" ||
          params.strokeAlign === "CENTER"
        ) {
          if (!("strokeAlign" in node)) {
            throw new Error(`Node does not support strokeAlign: ${node.id}`);
          }
          (node as MinimalStrokesMixin).strokeAlign = params.strokeAlign;
          applied.strokeAlign = params.strokeAlign;
        }

        if (Array.isArray(params.dashPattern)) {
          if (!("dashPattern" in node)) {
            throw new Error(`Node does not support dashPattern: ${node.id}`);
          }
          const pattern = (params.dashPattern as unknown[]).map((n, i) => {
            if (typeof n !== "number" || n < 0) {
              throw new Error(`dashPattern[${i}] must be a non-negative number`);
            }
            return n;
          });
          (node as MinimalStrokesMixin).dashPattern = pattern;
          applied.dashPattern = pattern;
        }

        if (typeof params.strokeCap === "string") {
          if (!("strokeCap" in node)) {
            throw new Error(`Node does not support strokeCap: ${node.id}`);
          }
          (node as SceneNode & { strokeCap: StrokeCap }).strokeCap =
            params.strokeCap as StrokeCap;
          applied.strokeCap = params.strokeCap;
        }

        if (typeof params.strokeJoin === "string") {
          if (!("strokeJoin" in node)) {
            throw new Error(`Node does not support strokeJoin: ${node.id}`);
          }
          (node as SceneNode & { strokeJoin: StrokeJoin }).strokeJoin =
            params.strokeJoin as StrokeJoin;
          applied.strokeJoin = params.strokeJoin;
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            nodeName: node.name,
            applied,
          },
        };
      }
      case "set_auto_layout": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) {
          throw new Error("nodeIds is required for set_auto_layout");
        }

        const node = await getSceneNodeById(nodeId);
        if (!("layoutMode" in node)) {
          throw new Error(`Node does not support auto-layout: ${node.id}`);
        }
        const frame = node as FrameNode;
        const params = request.params ?? {};
        const applied: Record<string, unknown> = {};

        if (
          params.layoutMode === "NONE" ||
          params.layoutMode === "HORIZONTAL" ||
          params.layoutMode === "VERTICAL"
        ) {
          frame.layoutMode = params.layoutMode;
          applied.layoutMode = params.layoutMode;
        }

        if (typeof params.itemSpacing === "number") {
          frame.itemSpacing = params.itemSpacing;
          applied.itemSpacing = params.itemSpacing;
        }
        if (typeof params.counterAxisSpacing === "number") {
          (frame as FrameNode & { counterAxisSpacing: number }).counterAxisSpacing =
            params.counterAxisSpacing;
          applied.counterAxisSpacing = params.counterAxisSpacing;
        }

        if (typeof params.paddingTop === "number") {
          frame.paddingTop = params.paddingTop;
          applied.paddingTop = params.paddingTop;
        }
        if (typeof params.paddingRight === "number") {
          frame.paddingRight = params.paddingRight;
          applied.paddingRight = params.paddingRight;
        }
        if (typeof params.paddingBottom === "number") {
          frame.paddingBottom = params.paddingBottom;
          applied.paddingBottom = params.paddingBottom;
        }
        if (typeof params.paddingLeft === "number") {
          frame.paddingLeft = params.paddingLeft;
          applied.paddingLeft = params.paddingLeft;
        }

        if (
          params.primaryAxisAlignItems === "MIN" ||
          params.primaryAxisAlignItems === "MAX" ||
          params.primaryAxisAlignItems === "CENTER" ||
          params.primaryAxisAlignItems === "SPACE_BETWEEN"
        ) {
          frame.primaryAxisAlignItems = params.primaryAxisAlignItems;
          applied.primaryAxisAlignItems = params.primaryAxisAlignItems;
        }
        if (
          params.counterAxisAlignItems === "MIN" ||
          params.counterAxisAlignItems === "MAX" ||
          params.counterAxisAlignItems === "CENTER" ||
          params.counterAxisAlignItems === "BASELINE"
        ) {
          frame.counterAxisAlignItems = params.counterAxisAlignItems;
          applied.counterAxisAlignItems = params.counterAxisAlignItems;
        }

        if (
          params.primaryAxisSizingMode === "FIXED" ||
          params.primaryAxisSizingMode === "AUTO"
        ) {
          frame.primaryAxisSizingMode = params.primaryAxisSizingMode;
          applied.primaryAxisSizingMode = params.primaryAxisSizingMode;
        }
        if (
          params.counterAxisSizingMode === "FIXED" ||
          params.counterAxisSizingMode === "AUTO"
        ) {
          frame.counterAxisSizingMode = params.counterAxisSizingMode;
          applied.counterAxisSizingMode = params.counterAxisSizingMode;
        }

        if (params.layoutWrap === "NO_WRAP" || params.layoutWrap === "WRAP") {
          (frame as FrameNode & { layoutWrap: "NO_WRAP" | "WRAP" }).layoutWrap =
            params.layoutWrap;
          applied.layoutWrap = params.layoutWrap;
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            nodeName: node.name,
            applied,
          },
        };
      }
      case "create_frame": {
        const params = request.params ?? {};
        const frame = figma.createFrame();

        if (typeof params.name === "string") {
          frame.name = params.name;
        }

        const width = typeof params.width === "number" ? params.width : 100;
        const height = typeof params.height === "number" ? params.height : 100;
        frame.resize(width, height);

        if (typeof params.fillHex === "string") {
          const fillOpacity =
            typeof params.fillOpacity === "number" ? params.fillOpacity : undefined;
          setSolidFill(frame, params.fillHex, fillOpacity);
        }

        await appendToParentIfProvided(frame, params.parentId);
        positionNode(frame, params.x, params.y);

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: frame.id,
            nodeName: frame.name,
            parentId: frame.parent?.id,
            x: frame.x,
            y: frame.y,
            width: frame.width,
            height: frame.height,
          },
        };
      }
      case "create_text": {
        const params = request.params ?? {};
        const text = figma.createText();

        const fontFamily =
          typeof params.fontFamily === "string" ? params.fontFamily : "Inter";
        const fontStyle =
          typeof params.fontStyle === "string" ? params.fontStyle : "Regular";
        text.fontName = await ensureFont(fontFamily, fontStyle);

        if (typeof params.name === "string") {
          text.name = params.name;
        }
        if (typeof params.characters === "string") {
          text.characters = params.characters;
        }
        if (typeof params.fontSize === "number") {
          text.fontSize = params.fontSize;
        }
        if (typeof params.fillHex === "string") {
          const fillOpacity =
            typeof params.fillOpacity === "number" ? params.fillOpacity : undefined;
          applyTextFill(text, params.fillHex, fillOpacity);
        }

        if (
          params.textAlignHorizontal === "LEFT" ||
          params.textAlignHorizontal === "CENTER" ||
          params.textAlignHorizontal === "RIGHT" ||
          params.textAlignHorizontal === "JUSTIFIED"
        ) {
          text.textAlignHorizontal = params.textAlignHorizontal;
        }

        if (
          params.textAutoResize === "NONE" ||
          params.textAutoResize === "WIDTH_AND_HEIGHT" ||
          params.textAutoResize === "HEIGHT" ||
          params.textAutoResize === "TRUNCATE"
        ) {
          text.textAutoResize = params.textAutoResize;
        }

        resizeNodeIfSupported(text, params.width, params.height);
        await appendToParentIfProvided(text, params.parentId);
        positionNode(text, params.x, params.y);

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: text.id,
            nodeName: text.name,
            parentId: text.parent?.id,
            characters: text.characters,
            x: text.x,
            y: text.y,
            width: text.width,
            height: text.height,
          },
        };
      }
      case "create_shape": {
        const params = request.params ?? {};
        const shapeType = params.shapeType;
        let node: SceneNode;

        if (shapeType === "ELLIPSE") {
          node = figma.createEllipse();
        } else if (shapeType === "LINE") {
          node = figma.createLine();
        } else {
          node = figma.createRectangle();
        }
        // Capture the id up front: the defensive "prop in node" guards below
        // narrow `node` to `never` in their (unreachable) throw branches.
        const nodeId = node.id;

        if (typeof params.name === "string") {
          node.name = params.name;
        }

        resizeNodeIfSupported(node, params.width, params.height);

        if (typeof params.rotation === "number" && "rotation" in node) {
          node.rotation = params.rotation;
        }

        if (shapeType === "LINE" && typeof params.fillHex === "string") {
          throw new Error("LINE shapes do not support fillHex — use strokeHex instead");
        }

        if (typeof params.fillHex === "string") {
          const fillOpacity =
            typeof params.fillOpacity === "number" ? params.fillOpacity : undefined;
          setSolidFill(node, params.fillHex, fillOpacity);
        }

        if (shapeType === "LINE" && typeof params.strokeHex !== "string") {
          throw new Error(
            "LINE shapes require strokeHex (lines have no fill, so without a stroke they are invisible)"
          );
        }

        if (typeof params.strokeHex === "string") {
          if (!("strokes" in node)) {
            throw new Error(`Node does not support strokes: ${nodeId}`);
          }
          const strokeOpacity =
            typeof params.strokeOpacity === "number" ? params.strokeOpacity : undefined;
          setSolidFill(node, params.strokeHex, strokeOpacity, "stroke");
        }

        if (
          "strokeWeight" in node &&
          typeof params.strokeWeight === "number"
        ) {
          node.strokeWeight = params.strokeWeight;
        }

        if (typeof params.cornerRadius === "number" && "cornerRadius" in node) {
          node.cornerRadius = params.cornerRadius;
        }

        await appendToParentIfProvided(node, params.parentId);
        positionNode(node, params.x, params.y);

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            nodeName: node.name,
            shapeType,
            parentId: node.parent?.id,
            x: "x" in node ? node.x : undefined,
            y: "y" in node ? node.y : undefined,
            width: "width" in node ? node.width : undefined,
            height: "height" in node ? node.height : undefined,
          },
        };
      }
      case "create_image": {
        const params = request.params ?? {};
        if (typeof params.imageBase64 !== "string" || params.imageBase64.length === 0) {
          throw new Error("imageBase64 is required for create_image");
        }

        const image = figma.createImage(decodeBase64ToBytes(params.imageBase64));
        const imageSize = await image.getSizeAsync();
        const node = figma.createRectangle();

        if (typeof params.name === "string") {
          node.name = params.name;
        }

        const aspectRatio = imageSize.width / imageSize.height;
        const width =
          typeof params.width === "number"
            ? params.width
            : typeof params.height === "number"
              ? params.height * aspectRatio
              : imageSize.width;
        const height =
          typeof params.height === "number"
            ? params.height
            : typeof params.width === "number"
              ? params.width / aspectRatio
              : imageSize.height;

        node.resize(width, height);
        node.fills = [
          {
            type: "IMAGE",
            imageHash: image.hash,
            scaleMode: params.scaleMode === "FIT" ? "FIT" : "FILL",
          },
        ];

        if (typeof params.cornerRadius === "number") {
          node.cornerRadius = params.cornerRadius;
        }

        await appendToParentIfProvided(node, params.parentId);
        positionNode(node, params.x, params.y);

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            nodeName: node.name,
            parentId: node.parent?.id,
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
            imageHash: image.hash,
          },
        };
      }
      case "duplicate_nodes": {
        if (!request.nodeIds || request.nodeIds.length === 0) {
          throw new Error("nodeIds is required for duplicate_nodes");
        }

        const duplicates = [];
        for (const nodeId of request.nodeIds) {
          const node = await getSceneNodeById(nodeId);
          if (!("clone" in node) || typeof node.clone !== "function") {
            throw new Error(`Node does not support duplication: ${node.id}`);
          }
          const clone = node.clone();
          duplicates.push({
            sourceNodeId: node.id,
            nodeId: clone.id,
            nodeName: clone.name,
            parentId: clone.parent?.id,
          });
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            duplicatedCount: duplicates.length,
            duplicates,
          },
        };
      }
      case "reparent_nodes": {
        if (!request.nodeIds || request.nodeIds.length === 0) {
          throw new Error("nodeIds is required for reparent_nodes");
        }
        const parentId = request.params?.parentId;
        if (typeof parentId !== "string") {
          throw new Error("parentId is required for reparent_nodes");
        }

        const parent = await getParentNodeById(parentId);
        const moved = [];

        for (const nodeId of request.nodeIds) {
          const node = await getSceneNodeById(nodeId);
          parent.appendChild(node);
          moved.push({
            nodeId: node.id,
            nodeName: node.name,
            parentId: node.parent?.id,
          });
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            movedCount: moved.length,
            moved,
          },
        };
      }
      case "group_nodes": {
        if (!request.nodeIds || request.nodeIds.length === 0) {
          throw new Error("nodeIds is required for group_nodes");
        }

        const nodes = await Promise.all(
          request.nodeIds.map((nodeId) => getSceneNodeById(nodeId))
        );

        const explicitParentId = request.params?.parentId;
        let parent: BaseNode & ChildrenMixin;
        if (typeof explicitParentId === "string") {
          parent = await getParentNodeById(explicitParentId);
        } else {
          const parents = new Set(nodes.map((n) => n.parent?.id));
          if (parents.size !== 1 || parents.has(undefined)) {
            throw new Error(
              "group_nodes requires all nodes to share a parent, or pass parentId explicitly"
            );
          }
          const sharedParent = nodes[0].parent;
          if (!sharedParent || !supportsChildren(sharedParent)) {
            throw new Error("Shared parent does not support children");
          }
          parent = sharedParent;
        }

        const group = figma.group(nodes, parent);
        const name = request.params?.name;
        if (typeof name === "string") {
          group.name = name;
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: group.id,
            nodeName: group.name,
            parentId: group.parent?.id,
            childIds: group.children.map((c) => c.id),
          },
        };
      }
      case "ungroup_node": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) {
          throw new Error("nodeIds is required for ungroup_node");
        }

        const node = await getSceneNodeById(nodeId);
        if (node.type !== "GROUP" && node.type !== "FRAME") {
          throw new Error(
            `ungroup_node only works on GROUP or FRAME nodes, got ${node.type}`
          );
        }

        const parentId = node.parent?.id;
        const orphans = figma.ungroup(node as GroupNode | FrameNode);

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            parentId,
            orphanIds: orphans.map((o) => o.id),
          },
        };
      }
      case "set_selection": {
        const ids = request.nodeIds ?? [];
        const nodes: SceneNode[] = [];
        for (const id of ids) {
          nodes.push(await getSceneNodeById(id));
        }
        figma.currentPage.selection = nodes;

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            selectedCount: nodes.length,
            selectedIds: nodes.map((n) => n.id),
          },
        };
      }
      case "scroll_and_zoom_into_view": {
        if (!request.nodeIds || request.nodeIds.length === 0) {
          throw new Error("nodeIds is required for scroll_and_zoom_into_view");
        }

        const nodes = await Promise.all(
          request.nodeIds.map((nodeId) => getSceneNodeById(nodeId))
        );
        figma.viewport.scrollAndZoomIntoView(nodes);

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            framedCount: nodes.length,
            framedIds: nodes.map((n) => n.id),
          },
        };
      }
      case "delete_nodes": {
        if (request.params?.confirm !== true) {
          throw new Error("delete_nodes requires confirm: true");
        }
        if (!request.nodeIds || request.nodeIds.length === 0) {
          throw new Error("nodeIds is required for delete_nodes");
        }

        const nodes = await Promise.all(request.nodeIds.map((nodeId) => getSceneNodeById(nodeId)));
        const deletions = nodes.map((node) => ({
          nodeId: node.id,
          nodeName: node.name,
          parentId: node.parent?.id,
        }));

        for (const node of nodes) {
          node.remove();
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            deletedCount: deletions.length,
            deletions,
          },
        };
      }
      case "list_fonts": {
        const params = request.params ?? {};
        const filter =
          typeof params.filter === "string" && params.filter
            ? params.filter.toLowerCase()
            : undefined;
        const families = Array.isArray(params.families)
          ? (params.families as unknown[])
              .filter((f): f is string => typeof f === "string")
              .map((f) => f.toLowerCase())
          : undefined;

        const fonts = await figma.listAvailableFontsAsync();
        const byFamily = new Map<string, string[]>();
        for (const font of fonts) {
          const { family, style } = font.fontName;
          const familyLower = family.toLowerCase();
          if (filter && !familyLower.includes(filter)) continue;
          if (families && families.indexOf(familyLower) === -1) continue;
          const styles = byFamily.get(family);
          if (styles) {
            styles.push(style);
          } else {
            byFamily.set(family, [style]);
          }
        }

        const matched = [...byFamily.entries()].map(([family, styles]) => ({
          family,
          styles,
        }));
        // Unfiltered catalogs run to 1700+ families; keep the payload sane by
        // dropping per-family style lists past this threshold.
        const includeStyles = matched.length <= 200;
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            totalFamiliesAvailable: new Set(
              fonts.map((f) => f.fontName.family)
            ).size,
            matchedFamilies: matched.length,
            stylesIncluded: includeStyles,
            fonts: includeStyles
              ? matched
              : matched.map((entry) => ({ family: entry.family })),
          },
        };
      }
      case "load_fonts": {
        const rawFonts = request.params?.fonts;
        if (!Array.isArray(rawFonts) || rawFonts.length === 0) {
          throw new Error("fonts is required for load_fonts");
        }
        const fonts = rawFonts as FontPairInput[];
        const results = await loadFontsBatched(fonts);
        const missing = results.filter((r) => !r.loaded);
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            allLoaded: missing.length === 0,
            loadedCount: results.length - missing.length,
            results,
            missing,
          },
        };
      }
      case "get_text_styles": {
        const styles = await figma.getLocalTextStylesAsync();
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            count: styles.length,
            styles: styles.map(serializeTextStyle),
          },
        };
      }
      case "create_text_style": {
        const params = request.params ?? {};
        const { name, fontFamily, fontStyle } = params;
        if (typeof name !== "string" || !name) {
          throw new Error("name is required for create_text_style");
        }
        if (typeof fontFamily !== "string" || typeof fontStyle !== "string") {
          throw new Error(
            "fontFamily and fontStyle are required for create_text_style (discover exact strings via list_fonts first)"
          );
        }

        if (params.skipIfExists === true) {
          const existing = (await figma.getLocalTextStylesAsync()).find(
            (s) => s.name === name
          );
          if (existing) {
            return {
              type: request.type,
              requestId: request.requestId,
              data: {
                existed: true,
                style: serializeTextStyle(existing),
              },
            };
          }
        }

        const font = await ensureFont(fontFamily, fontStyle);
        const style = figma.createTextStyle();
        try {
          style.name = name;
          style.fontName = font;
          const applied: Record<string, unknown> = {};
          applyTextStylePatches(style, params, applied);
        } catch (err) {
          // Don't leave a half-configured style behind on failure.
          style.remove();
          throw err;
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            existed: false,
            style: serializeTextStyle(style),
          },
        };
      }
      case "update_text_style": {
        const params = request.params ?? {};
        const style = await resolveTextStyle(params.styleId, params.styleName);
        const applied: Record<string, unknown> = {};

        const wantsFontChange =
          typeof params.fontFamily === "string" ||
          typeof params.fontStyle === "string";
        const hasFontDependentPatch =
          typeof params.fontSize === "number" ||
          params.lineHeight !== undefined ||
          params.letterSpacing !== undefined ||
          typeof params.paragraphSpacing === "number" ||
          typeof params.paragraphIndent === "number" ||
          isTextCase(params.textCase) ||
          isTextDecoration(params.textDecoration);
        const hasMetadataPatch =
          (typeof params.newName === "string" && params.newName.length > 0) ||
          typeof params.description === "string";

        if (!wantsFontChange && !hasFontDependentPatch && !hasMetadataPatch) {
          throw new Error(
            "At least one property to update is required for update_text_style"
          );
        }

        try {
          // Property patches run under the CURRENT font (which must be loaded
          // for TextStyle setters); the file-wide-visible fontName swap runs
          // LAST so a failed patch never leaves a half-applied font change.
          // Rename/description-only updates skip font loading entirely, so
          // they work even when the style's current font is unavailable.
          if (hasFontDependentPatch) {
            await figma.loadFontAsync(style.fontName);
          }
          applyTextStylePatches(style, params, applied);

          if (wantsFontChange) {
            const current = style.fontName;
            const nextFamily =
              typeof params.fontFamily === "string"
                ? params.fontFamily
                : current.family;
            const nextStyle =
              typeof params.fontStyle === "string"
                ? params.fontStyle
                : current.style;
            style.fontName = await ensureFont(nextFamily, nextStyle);
            applied.fontName = style.fontName;
          }

          if (typeof params.newName === "string" && params.newName) {
            style.name = params.newName;
            applied.name = style.name;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const partialNote =
            Object.keys(applied).length > 0
              ? ` Changes already applied before the failure (NOT rolled back): ${JSON.stringify(applied)}.`
              : "";
          throw new Error(message + partialNote);
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            style: serializeTextStyle(style),
            applied,
          },
        };
      }
      case "apply_text_style": {
        if (!request.nodeIds || request.nodeIds.length === 0) {
          throw new Error("nodeIds is required for apply_text_style");
        }
        const params = request.params ?? {};
        const style = await resolveTextStyle(params.styleId, params.styleName);
        // setTextStyleIdAsync requires fonts to be loaded (plugin-typings
        // 1.123) — load the style's font once, plus each node's current fonts.
        await figma.loadFontAsync(style.fontName);

        const results: Array<
          | { nodeId: string; nodeName: string; applied: true }
          | { nodeId: string; error: string }
        > = [];
        for (const nodeId of request.nodeIds) {
          try {
            const node = await getTextNodeById(nodeId);
            await loadFontsForTextNode(node);
            await node.setTextStyleIdAsync(style.id);
            results.push({ nodeId: node.id, nodeName: node.name, applied: true });
          } catch (err) {
            results.push({
              nodeId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }

        const failed = results.filter((r) => "error" in r).length;
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            styleId: style.id,
            styleName: style.name,
            appliedCount: results.length - failed,
            failedCount: failed,
            results,
          },
        };
      }
      case "get_effect_styles": {
        const styles = await figma.getLocalEffectStylesAsync();
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            count: styles.length,
            styles: styles.map((style) => ({
              id: style.id,
              name: style.name,
              description: style.description,
              effects: style.effects,
              boundVariables: style.boundVariables,
            })),
          },
        };
      }
      case "get_variables_deep": {
        const params = request.params ?? {};
        const collections =
          await figma.variables.getLocalVariableCollectionsAsync();
        let targets = collections;
        if (typeof params.collectionId === "string") {
          targets = collections.filter((c) => c.id === params.collectionId);
        } else if (typeof params.collectionName === "string") {
          targets = collections.filter((c) => c.name === params.collectionName);
        }
        if (
          targets.length === 0 &&
          (params.collectionId !== undefined || params.collectionName !== undefined)
        ) {
          throw new Error(
            `Collection not found. Local collections: ${collections.map((c) => c.name).join(", ")}`
          );
        }

        const resolveAliases = params.resolveAliases !== false;
        const allVariables = await figma.variables.getLocalVariablesAsync();
        const variablesByCollection = new Map<string, Variable[]>();
        const localById = new Map<string, Variable>();
        const collectionNameById = new Map<string, string>(
          collections.map((c) => [c.id, c.name])
        );
        for (const variable of allVariables) {
          localById.set(variable.id, variable);
          const list = variablesByCollection.get(variable.variableCollectionId);
          if (list) list.push(variable);
          else variablesByCollection.set(variable.variableCollectionId, [variable]);
        }

        // Unfiltered dumps of very large token libraries would produce one
        // unbounded JSON blob — require a collection filter instead.
        const isFiltered =
          params.collectionId !== undefined || params.collectionName !== undefined;
        const totalVariables = allVariables.length;
        if (!isFiltered && totalVariables > 4000) {
          throw new Error(
            `File has ${totalVariables} variables — too large for one dump. Filter with collectionId/collectionName. Collections: ${collections
              .map((c) => `${c.name} (${c.variableIds.length})`)
              .join(", ")}`
          );
        }

        const lookupCollectionName = async (
          collectionId: string
        ): Promise<{ name: string; remote: boolean }> => {
          const local = collectionNameById.get(collectionId);
          if (local !== undefined) return { name: local, remote: false };
          try {
            const remoteCollection =
              await figma.variables.getVariableCollectionByIdAsync(collectionId);
            if (remoteCollection) {
              // Memoize so each library collection resolves once per request.
              collectionNameById.set(collectionId, remoteCollection.name);
              return { name: remoteCollection.name, remote: true };
            }
          } catch {
            /* unresolvable — fall through */
          }
          return { name: collectionId, remote: true };
        };

        const serializeValue = async (value: VariableValue): Promise<unknown> => {
          if (
            typeof value === "object" &&
            value !== null &&
            "type" in value &&
            value.type === "VARIABLE_ALIAS"
          ) {
            const alias: Record<string, unknown> = {
              type: "VARIABLE_ALIAS",
              id: value.id,
            };
            if (resolveAliases) {
              let target: Variable | null = localById.get(value.id) ?? null;
              if (!target) {
                try {
                  target = await figma.variables.getVariableByIdAsync(value.id);
                } catch {
                  target = null;
                }
              }
              if (target) {
                alias.name = target.name;
                const collectionInfo = await lookupCollectionName(
                  target.variableCollectionId
                );
                alias.collection = collectionInfo.name;
                if (collectionInfo.remote) alias.remote = true;
              }
            }
            return alias;
          }
          return serializeVariableValue(value);
        };

        const data = [];
        for (const collection of targets) {
          const variables = variablesByCollection.get(collection.id) ?? [];
          const serialized = [];
          for (const variable of variables) {
            const valuesByMode: Record<string, unknown> = {};
            for (const modeId of Object.keys(variable.valuesByMode)) {
              valuesByMode[modeId] = await serializeValue(
                variable.valuesByMode[modeId]
              );
            }
            serialized.push({
              id: variable.id,
              name: variable.name,
              resolvedType: variable.resolvedType,
              description: variable.description,
              scopes: variable.scopes,
              codeSyntax: variable.codeSyntax,
              valuesByMode,
            });
          }
          data.push({
            id: collection.id,
            name: collection.name,
            defaultModeId: collection.defaultModeId,
            modes: collection.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
            variableCount: serialized.length,
            variables: serialized,
          });
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: { collections: data },
        };
      }
      case "write_variables": {
        const rawActions = request.params?.actions;
        if (!Array.isArray(rawActions) || rawActions.length === 0) {
          throw new Error("actions is required for write_variables");
        }
        const stopOnError = request.params?.stopOnError !== false;
        const results: Array<Record<string, unknown>> = [];

        const applyAction = async (
          a: Record<string, unknown>
        ): Promise<Record<string, unknown>> => {
          switch (a.action) {
            case "create_collection": {
              if (typeof a.name !== "string") throw new Error("create_collection needs name");
              const collection = figma.variables.createVariableCollection(a.name);
              if (typeof a.initialModeName === "string") {
                collection.renameMode(collection.modes[0].modeId, a.initialModeName);
              }
              return {
                action: a.action,
                collectionId: collection.id,
                defaultModeId: collection.defaultModeId,
              };
            }
            case "add_mode": {
              if (typeof a.collectionId !== "string" || typeof a.name !== "string") {
                throw new Error("add_mode needs collectionId and name");
              }
              const collection =
                await figma.variables.getVariableCollectionByIdAsync(a.collectionId);
              if (!collection) throw new Error(`Collection not found: ${a.collectionId}`);
              const modeId = collection.addMode(a.name);
              return { action: a.action, modeId };
            }
            case "create_variable": {
              if (
                typeof a.collectionId !== "string" ||
                typeof a.name !== "string" ||
                typeof a.resolvedType !== "string"
              ) {
                throw new Error("create_variable needs collectionId, name, resolvedType");
              }
              const collection =
                await figma.variables.getVariableCollectionByIdAsync(a.collectionId);
              if (!collection) throw new Error(`Collection not found: ${a.collectionId}`);
              const variable = figma.variables.createVariable(
                a.name,
                collection,
                a.resolvedType as VariableResolvedDataType
              );
              try {
                if (Array.isArray(a.scopes)) {
                  variable.scopes = a.scopes as VariableScope[];
                }
                if (typeof a.description === "string") {
                  variable.description = a.description;
                }
                if (a.valuesByMode && typeof a.valuesByMode === "object") {
                  for (const [modeId, value] of Object.entries(
                    a.valuesByMode as Record<string, unknown>
                  )) {
                    variable.setValueForMode(
                      modeId,
                      parseVariableValue(variable.resolvedType, value)
                    );
                  }
                }
              } catch (err) {
                // Atomic: don't leave a half-configured variable behind.
                variable.remove();
                throw err;
              }
              return { action: a.action, variableId: variable.id, name: variable.name };
            }
            case "set_value": {
              if (typeof a.variableId !== "string" || typeof a.modeId !== "string") {
                throw new Error("set_value needs variableId and modeId");
              }
              const variable = await figma.variables.getVariableByIdAsync(a.variableId);
              if (!variable) throw new Error(`Variable not found: ${a.variableId}`);
              variable.setValueForMode(
                a.modeId,
                parseVariableValue(variable.resolvedType, a.value)
              );
              return { action: a.action, variableId: variable.id };
            }
            case "set_alias": {
              if (
                typeof a.variableId !== "string" ||
                typeof a.modeId !== "string" ||
                typeof a.aliasVariableId !== "string"
              ) {
                throw new Error("set_alias needs variableId, modeId, aliasVariableId");
              }
              const variable = await figma.variables.getVariableByIdAsync(a.variableId);
              if (!variable) throw new Error(`Variable not found: ${a.variableId}`);
              const alias = await figma.variables.createVariableAliasByIdAsync(
                a.aliasVariableId
              );
              variable.setValueForMode(a.modeId, alias);
              return { action: a.action, variableId: variable.id };
            }
            case "bind_to_node": {
              if (typeof a.nodeId !== "string" || typeof a.variableId !== "string" || typeof a.field !== "string") {
                throw new Error("bind_to_node needs nodeId, field, variableId");
              }
              const node = await getSceneNodeById(a.nodeId);
              const variable = await figma.variables.getVariableByIdAsync(a.variableId);
              if (!variable) throw new Error(`Variable not found: ${a.variableId}`);
              if (a.field === "fills" || a.field === "strokes") {
                const target = a.field;
                if (!(target in node)) throw new Error(`Node has no ${target}: ${node.id}`);
                const paints = (node as GeometryMixin)[target as "fills"];
                if (paints === figma.mixed || !Array.isArray(paints) || paints.length === 0) {
                  throw new Error(`Node ${node.id} needs at least one non-mixed paint in ${target}`);
                }
                const index = typeof a.paintIndex === "number" ? a.paintIndex : 0;
                const paint = paints[index];
                if (!paint || paint.type !== "SOLID") {
                  throw new Error(`bind_to_node ${target} requires a SOLID paint at index ${index}`);
                }
                const bound = figma.variables.setBoundVariableForPaint(
                  paint,
                  "color",
                  variable
                );
                const next = paints.slice();
                next[index] = bound;
                (node as GeometryMixin & { fills: ReadonlyArray<Paint> })[
                  target as "fills"
                ] = next;
              } else {
                (node as SceneNode).setBoundVariable(
                  a.field as VariableBindableNodeField,
                  variable
                );
              }
              return { action: a.action, nodeId: node.id, field: a.field };
            }
            case "delete_variable": {
              if (typeof a.variableId !== "string") throw new Error("delete_variable needs variableId");
              const variable = await figma.variables.getVariableByIdAsync(a.variableId);
              if (!variable) throw new Error(`Variable not found: ${a.variableId}`);
              const name = variable.name;
              variable.remove();
              return { action: a.action, deleted: name };
            }
            case "rename_variable": {
              if (typeof a.variableId !== "string" || typeof a.name !== "string") {
                throw new Error("rename_variable needs variableId and name");
              }
              const variable = await figma.variables.getVariableByIdAsync(a.variableId);
              if (!variable) throw new Error(`Variable not found: ${a.variableId}`);
              variable.name = a.name;
              return { action: a.action, variableId: variable.id, name: variable.name };
            }
            case "update_variable": {
              if (typeof a.variableId !== "string") {
                throw new Error("update_variable needs variableId");
              }
              const variable = await figma.variables.getVariableByIdAsync(a.variableId);
              if (!variable) throw new Error(`Variable not found: ${a.variableId}`);
              if (Array.isArray(a.scopes)) {
                variable.scopes = a.scopes as VariableScope[];
              }
              if (typeof a.description === "string") {
                variable.description = a.description;
              }
              if (typeof a.hiddenFromPublishing === "boolean") {
                variable.hiddenFromPublishing = a.hiddenFromPublishing;
              }
              if (a.codeSyntax && typeof a.codeSyntax === "object") {
                for (const [platform, value] of Object.entries(
                  a.codeSyntax as Record<string, unknown>
                )) {
                  if (typeof value === "string") {
                    variable.setVariableCodeSyntax(
                      platform as CodeSyntaxPlatform,
                      value
                    );
                  }
                }
              }
              return { action: a.action, variableId: variable.id };
            }
            case "rename_collection": {
              if (typeof a.collectionId !== "string" || typeof a.name !== "string") {
                throw new Error("rename_collection needs collectionId and name");
              }
              const collection =
                await figma.variables.getVariableCollectionByIdAsync(a.collectionId);
              if (!collection) throw new Error(`Collection not found: ${a.collectionId}`);
              collection.name = a.name;
              return { action: a.action, collectionId: collection.id, name: collection.name };
            }
            case "delete_collection": {
              if (typeof a.collectionId !== "string") {
                throw new Error("delete_collection needs collectionId");
              }
              const collection =
                await figma.variables.getVariableCollectionByIdAsync(a.collectionId);
              if (!collection) throw new Error(`Collection not found: ${a.collectionId}`);
              const name = collection.name;
              collection.remove();
              return { action: a.action, deleted: name };
            }
            case "rename_mode": {
              if (
                typeof a.collectionId !== "string" ||
                typeof a.modeId !== "string" ||
                typeof a.name !== "string"
              ) {
                throw new Error("rename_mode needs collectionId, modeId, and name");
              }
              const collection =
                await figma.variables.getVariableCollectionByIdAsync(a.collectionId);
              if (!collection) throw new Error(`Collection not found: ${a.collectionId}`);
              collection.renameMode(a.modeId, a.name);
              return { action: a.action, modeId: a.modeId, name: a.name };
            }
            case "remove_mode": {
              if (typeof a.collectionId !== "string" || typeof a.modeId !== "string") {
                throw new Error("remove_mode needs collectionId and modeId");
              }
              const collection =
                await figma.variables.getVariableCollectionByIdAsync(a.collectionId);
              if (!collection) throw new Error(`Collection not found: ${a.collectionId}`);
              collection.removeMode(a.modeId);
              return { action: a.action, removedModeId: a.modeId };
            }
            default:
              throw new Error(`Unknown write_variables action: ${String(a.action)}`);
          }
        };

        for (let i = 0; i < rawActions.length; i++) {
          try {
            const action = resolveActionRefs(
              rawActions[i] as Record<string, unknown>,
              results
            );
            results.push(await applyAction(action));
          } catch (err) {
            results.push({
              action: (rawActions[i] as Record<string, unknown>).action,
              error: err instanceof Error ? err.message : String(err),
            });
            if (stopOnError) break;
          }
          // Keep the editor responsive during large token batches.
          if (i > 0 && i % 10 === 0) await yieldToUI();
        }

        const failed = results.filter((r) => r.error !== undefined).length;
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            total: rawActions.length,
            executed: results.length,
            failed,
            results,
          },
        };
      }
      case "get_file_digest": {
        const scope =
          request.params?.scope === "all-pages" ? "all-pages" : "current-page";
        if (scope === "all-pages") {
          await figma.loadAllPagesAsync();
        }

        figma.skipInvisibleInstanceChildren = true;
        const searchRoot =
          scope === "all-pages" ? figma.root : figma.currentPage;
        const componentNodes = searchRoot.findAllWithCriteria({
          types: ["COMPONENT_SET", "COMPONENT"],
        });
        const sets: Array<{ id: string; name: string; variants: number }> = [];
        const standalone: Array<{ id: string; name: string }> = [];
        for (const node of componentNodes) {
          if (node.type === "COMPONENT_SET") {
            sets.push({
              id: node.id,
              name: node.name,
              variants: node.children.length,
            });
          } else if (node.parent?.type !== "COMPONENT_SET") {
            standalone.push({ id: node.id, name: node.name });
          }
        }

        const [textStyles, paintStyles, effectStyles, gridStyles, collections] =
          await Promise.all([
            figma.getLocalTextStylesAsync(),
            figma.getLocalPaintStylesAsync(),
            figma.getLocalEffectStylesAsync(),
            figma.getLocalGridStylesAsync(),
            figma.variables.getLocalVariableCollectionsAsync(),
          ]);

        const pages = figma.root.children.map((page) => {
          let childCount: number | null = null;
          try {
            childCount = page.children.length;
          } catch {
            // Unloaded page under dynamic-page access — count unavailable.
          }
          return { id: page.id, name: page.name, childCount };
        });

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            fileName: figma.root.name,
            scope,
            currentPage: {
              id: figma.currentPage.id,
              name: figma.currentPage.name,
            },
            pages,
            components: {
              setCount: sets.length,
              sets: sets.slice(0, 100),
              standaloneCount: standalone.length,
              standalone: standalone.slice(0, 100),
            },
            styles: {
              text: {
                count: textStyles.length,
                names: textStyles.slice(0, 50).map((s) => s.name),
              },
              paint: { count: paintStyles.length },
              effect: {
                count: effectStyles.length,
                names: effectStyles.slice(0, 50).map((s) => s.name),
              },
              grid: { count: gridStyles.length },
            },
            variables: {
              collections: collections.map((c) => ({
                id: c.id,
                name: c.name,
                modes: c.modes.length,
                variableCount: c.variableIds.length,
              })),
            },
            // Selection is deliberately omitted — it changes without firing
            // cache invalidation; use get_selection for live selection.
          },
        };
      }
      case "set_grid_layout": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for set_grid_layout");
        const node = await getSceneNodeById(nodeId);
        if (!("layoutMode" in node)) {
          throw new Error(`Node does not support auto-layout: ${node.id}`);
        }
        const frame = node as FrameNode;
        const params = request.params ?? {};
        const applied: Record<string, unknown> = {};

        frame.layoutMode = "GRID";
        applied.layoutMode = "GRID";

        if (params.autoTracks === "NONE" || params.autoTracks === "ROWS") {
          frame.gridAutoTracks = params.autoTracks;
          applied.gridAutoTracks = params.autoTracks;
        }
        if (
          params.itemsPositioning === "MANUAL" ||
          params.itemsPositioning === "ROW_AUTO_FLOW"
        ) {
          frame.gridItemsPositioning = params.itemsPositioning;
          applied.gridItemsPositioning = params.itemsPositioning;
        }
        // Counts throw while gridAutoTracks === 'ROWS' — set after positioning.
        if (typeof params.rowCount === "number" && frame.gridAutoTracks !== "ROWS") {
          frame.gridRowCount = params.rowCount;
          applied.gridRowCount = params.rowCount;
        }
        if (typeof params.columnCount === "number") {
          frame.gridColumnCount = params.columnCount;
          applied.gridColumnCount = params.columnCount;
        }
        if (typeof params.rowGap === "number") {
          frame.gridRowGap = params.rowGap;
          applied.gridRowGap = params.rowGap;
        }
        if (typeof params.columnGap === "number") {
          frame.gridColumnGap = params.columnGap;
          applied.gridColumnGap = params.columnGap;
        }

        const placementResults: Array<Record<string, unknown>> = [];
        if (Array.isArray(params.placements)) {
          for (const raw of params.placements as Array<Record<string, unknown>>) {
            try {
              if (
                typeof raw.nodeId !== "string" ||
                typeof raw.row !== "number" ||
                typeof raw.column !== "number"
              ) {
                throw new Error("placement needs nodeId, row, column");
              }
              const child = await getSceneNodeById(raw.nodeId);
              if (child.parent?.id !== frame.id) {
                frame.appendChildAt(child, raw.row, raw.column);
              } else {
                (child as SceneNode & GridChildrenMixin).setGridChildPosition(
                  raw.row,
                  raw.column
                );
              }
              placementResults.push({ nodeId: child.id, row: raw.row, column: raw.column });
            } catch (err) {
              placementResults.push({
                nodeId: raw.nodeId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: frame.id, applied, placements: placementResults },
        };
      }
      case "get_annotations": {
        if (!request.nodeIds || request.nodeIds.length === 0) {
          throw new Error("nodeIds is required for get_annotations");
        }
        const categories = await figma.annotations.getAnnotationCategoriesAsync();
        const nodes: Array<Record<string, unknown>> = [];
        for (const nodeId of request.nodeIds) {
          try {
            const node = await getSceneNodeById(nodeId);
            if (!("annotations" in node)) {
              nodes.push({ nodeId, error: "Node type does not support annotations" });
              continue;
            }
            nodes.push({
              nodeId: node.id,
              nodeName: node.name,
              annotations: toSerializableResult(node.annotations, "get_annotations"),
            });
          } catch (err) {
            nodes.push({
              nodeId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            categories: categories.map((c) => ({
              id: c.id,
              label: c.label,
              color: c.color,
              isPreset: c.isPreset,
            })),
            nodes,
          },
        };
      }
      case "set_annotation": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for set_annotation");
        const node = await getSceneNodeById(nodeId);
        if (!("annotations" in node)) {
          throw new Error(`Node type does not support annotations: ${node.type}`);
        }
        const params = request.params ?? {};
        const annotatable = node as SceneNode & {
          annotations: ReadonlyArray<Annotation>;
        };
        if (params.clear === true) {
          annotatable.annotations = [];
          return {
            type: request.type,
            requestId: request.requestId,
            data: { nodeId: node.id, cleared: true },
          };
        }
        const annotation: Record<string, unknown> = {};
        if (typeof params.label === "string") annotation.label = params.label;
        if (typeof params.labelMarkdown === "string") {
          annotation.labelMarkdown = params.labelMarkdown;
        }
        if (typeof params.categoryId === "string") {
          annotation.categoryId = params.categoryId;
        }
        if (Object.keys(annotation).length === 0) {
          throw new Error(
            "set_annotation needs label, labelMarkdown, or categoryId (or clear: true)"
          );
        }
        annotatable.annotations = [
          ...annotatable.annotations,
          annotation as Annotation,
        ];
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            annotationCount: annotatable.annotations.length,
          },
        };
      }
      case "get_reactions": {
        if (!request.nodeIds || request.nodeIds.length === 0) {
          throw new Error("nodeIds is required for get_reactions");
        }
        const nodes: Array<Record<string, unknown>> = [];
        for (const nodeId of request.nodeIds) {
          try {
            const node = await getSceneNodeById(nodeId);
            nodes.push({
              nodeId: node.id,
              nodeName: node.name,
              reactions:
                "reactions" in node
                  ? toSerializableResult(node.reactions, "get_reactions")
                  : [],
            });
          } catch (err) {
            nodes.push({
              nodeId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodes },
        };
      }
      case "get_motion": {
        const motion = requireMotionApi();
        const styles = toSerializableResult(motion.figmaAnimationStyles(), "get_motion");
        const nodes: Array<Record<string, unknown>> = [];
        if (request.nodeIds) {
          for (const nodeId of request.nodeIds) {
            try {
              const node = await getSceneNodeById(nodeId);
              nodes.push({
                nodeId: node.id,
                nodeName: node.name,
                animationStyles: toSerializableResult(node.animationStyles, "get_motion"),
                manualKeyframeTracks: toSerializableResult(
                  node.manualKeyframeTracks,
                  "get_motion"
                ),
                timelines: toSerializableResult(node.timelines, "get_motion"),
              });
            } catch (err) {
              nodes.push({
                nodeId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: { availableAnimationStyles: styles, nodes },
        };
      }
      case "apply_animation_style": {
        requireMotionApi();
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for apply_animation_style");
        const node = await getSceneNodeById(nodeId);
        const params = request.params ?? {};

        if (params.remove === true) {
          let removeId =
            typeof params.appliedStyleInstanceId === "string"
              ? params.appliedStyleInstanceId
              : "";
          if (!removeId && typeof params.styleId === "string") {
            // styleId is the TEMPLATE id; removal needs the applied INSTANCE
            // id — resolve it from the node's applied styles.
            const instance = node.animationStyles.find(
              (s) => s.styleId === params.styleId
            );
            if (!instance) {
              const applied = node.animationStyles
                .map((s) => `${s.styleId} (instance ${s.id})`)
                .join(", ");
              throw new Error(
                `No applied animation style matches styleId "${params.styleId}" on ${node.id}. Applied: ${applied || "(none)"}`
              );
            }
            removeId = instance.id;
          }
          if (!removeId) {
            throw new Error("remove needs appliedStyleInstanceId (or styleId)");
          }
          node.removeAnimationStyle(removeId);
          return {
            type: request.type,
            requestId: request.requestId,
            data: { nodeId: node.id, removed: removeId },
          };
        }

        if (typeof params.styleId !== "string") {
          throw new Error("styleId is required (discover via get_motion)");
        }
        const config: Record<string, unknown> = {};
        if (typeof params.duration === "number") config.duration = params.duration;
        if (typeof params.timelineOffset === "number") {
          config.timelineOffset = params.timelineOffset;
        }
        const appliedStyleInstanceId = node.applyAnimationStyle(
          params.styleId,
          Object.keys(config).length > 0
            ? (config as AnimationStyleConfiguration)
            : undefined
        );
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: node.id, appliedStyleInstanceId },
        };
      }
      case "list_shaders": {
        if (!("listAvailableShaders" in figma)) {
          throw new Error(
            "Shader API unavailable — requires Figma Desktop with the Shaders beta (June 2026+, paid plans)."
          );
        }
        const shaders = await figma.listAvailableShaders();
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            count: shaders.length,
            shaders: toSerializableResult(
              shaders.map((s) => ({
                id: s.id,
                name: s.name,
                type: s.type,
                imported: s.imported,
                propertyDefinitions: s.propertyDefinitions,
              })),
              "list_shaders"
            ),
          },
        };
      }
      case "apply_shader": {
        if (!("importShaderById" in figma)) {
          throw new Error(
            "Shader API unavailable — requires Figma Desktop with the Shaders beta (June 2026+, paid plans)."
          );
        }
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for apply_shader");
        const params = request.params ?? {};
        if (typeof params.shaderId !== "string") {
          throw new Error("shaderId is required (discover via list_shaders)");
        }
        const node = await getSceneNodeById(nodeId);
        const shader = await figma.importShaderById(params.shaderId);
        // Route by the shader's declared type: 'effect' shaders cannot be
        // paints and vice versa. Omitted target derives from the shader.
        const requested =
          params.target === "stroke" || params.target === "effect" || params.target === "fill"
            ? params.target
            : undefined;
        const target =
          requested ?? (shader.type === "effect" ? "effect" : "fill");
        if (shader.type === "effect" && target !== "effect") {
          throw new Error(
            `Shader "${shader.name}" is an effect shader — use target: "effect"`
          );
        }
        if (shader.type === "fill" && target === "effect") {
          throw new Error(
            `Shader "${shader.name}" is a fill shader — use target: "fill" or "stroke"`
          );
        }
        const properties =
          params.properties && typeof params.properties === "object"
            ? (params.properties as Record<string, ShaderPropertyValue>)
            : undefined;
        let replacedPaints = 0;

        if (target === "effect") {
          if (!("effects" in node)) {
            throw new Error(`Node does not support effects: ${node.id}`);
          }
          const effect = {
            type: "SHADER",
            id: shader.id,
            visible: true,
            ...(properties ? { properties } : {}),
          } as unknown as Effect;
          (node as BlendMixin & { effects: ReadonlyArray<Effect> }).effects = [
            ...(node as BlendMixin).effects,
            effect,
          ];
        } else {
          const field = target === "stroke" ? "strokes" : "fills";
          if (!(field in node)) {
            throw new Error(`Node does not support ${field}: ${node.id}`);
          }
          const existing = (node as GeometryMixin)[field as "fills"];
          replacedPaints =
            existing === figma.mixed ? -1 : (existing as ReadonlyArray<Paint>).length;
          const paint = {
            type: "SHADER",
            id: shader.id,
            ...(properties ? { properties } : {}),
          } as unknown as Paint;
          (node as GeometryMixin & { fills: ReadonlyArray<Paint> })[
            field as "fills"
          ] = [paint];
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            shaderId: shader.id,
            shaderName: shader.name,
            target,
            // -1 = previous paints were mixed; otherwise the count replaced.
            replacedPaints,
          },
        };
      }
      case "set_reactions": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for set_reactions");
        const node = await getSceneNodeById(nodeId);
        if (!("setReactionsAsync" in node)) {
          throw new Error(`Node type does not support reactions: ${node.type}`);
        }
        const reactions = request.params?.reactions;
        if (!Array.isArray(reactions)) {
          throw new Error("reactions must be an array (pass [] to clear)");
        }
        // Figma's runtime validates the Reaction union deeply — surface its
        // errors as-is; they name the offending field.
        await (node as SceneNode & ReactionMixin).setReactionsAsync(
          reactions as unknown as Reaction[]
        );
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            reactionCount: reactions.length,
          },
        };
      }
      case "set_flow_starting_point": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for set_flow_starting_point");
        const node = await getSceneNodeById(nodeId);
        const page = getPageOfNode(node);
        const params = request.params ?? {};
        const existing = page.flowStartingPoints.filter(
          (f) => f.nodeId !== node.id
        );
        if (params.remove === true) {
          page.flowStartingPoints = existing;
        } else {
          const name =
            typeof params.name === "string" && params.name
              ? params.name
              : node.name;
          page.flowStartingPoints = [...existing, { nodeId: node.id, name }];
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            pageId: page.id,
            flows: page.flowStartingPoints.map((f) => ({ ...f })),
          },
        };
      }
      case "create_component_from_node": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for create_component_from_node");
        const node = await getSceneNodeById(nodeId);
        const component = figma.createComponentFromNode(node);
        if (typeof request.params?.name === "string") {
          component.name = request.params.name;
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            componentId: component.id,
            name: component.name,
            key: component.key,
          },
        };
      }
      case "combine_as_variants": {
        if (!request.nodeIds || request.nodeIds.length < 2) {
          throw new Error("combine_as_variants needs at least 2 component nodeIds");
        }
        const params = request.params ?? {};
        const components: ComponentNode[] = [];
        for (const id of request.nodeIds) {
          const node = await figma.getNodeByIdAsync(id);
          if (!node || node.type !== "COMPONENT") {
            throw new Error(
              `combine_as_variants requires COMPONENT nodes; ${id} is ${node?.type ?? "missing"}. Variant names must be 'Prop=Value' (e.g. 'State=Hover').`
            );
          }
          components.push(node);
        }
        const parent =
          typeof params.parentId === "string"
            ? await getParentNodeById(params.parentId)
            : getPageOfNode(components[0]);
        const set = figma.combineAsVariants(components, parent);
        if (typeof params.name === "string") set.name = params.name;
        // Variants stack at 0,0 after combining — lay them out unless told not
        // to. The set frame does NOT auto-resize when children move via the
        // API, so resize it to fit or the variants overflow its bounds.
        if (params.arrange !== false) {
          const PAD = 16;
          let y = PAD;
          let maxWidth = 0;
          for (const variant of set.children) {
            variant.x = PAD;
            variant.y = y;
            y += variant.height + 24;
            if (variant.width > maxWidth) maxWidth = variant.width;
          }
          set.resizeWithoutConstraints(maxWidth + PAD * 2, y - 24 + PAD);
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            componentSetId: set.id,
            name: set.name,
            key: set.key,
            variants: set.children.map((c) => ({ id: c.id, name: c.name })),
          },
        };
      }
      case "add_component_property": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for add_component_property");
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node || (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET")) {
          throw new Error(`add_component_property needs a COMPONENT or COMPONENT_SET, got ${node?.type ?? "missing"}`);
        }
        const params = request.params ?? {};
        const { name, propertyType } = params;
        if (typeof name !== "string" || typeof propertyType !== "string") {
          throw new Error("name and propertyType are required");
        }
        const options: Record<string, unknown> = {};
        if (Array.isArray(params.preferredValues)) {
          options.preferredValues = params.preferredValues;
        }
        if (typeof params.description === "string") {
          options.description = params.description;
        }
        if (params.slotSettings && typeof params.slotSettings === "object") {
          options.slotSettings = params.slotSettings;
        }
        // INSTANCE_SWAP requires a main-component node id — Figma's own error
        // for '' is opaque, so validate up front. SLOT takes '' (its
        // defaultValue is positional-mandatory but not user-suppliable).
        if (
          propertyType === "INSTANCE_SWAP" &&
          (typeof params.defaultValue !== "string" || !params.defaultValue)
        ) {
          throw new Error(
            "defaultValue (a main component node id, e.g. '2:22') is required for INSTANCE_SWAP properties"
          );
        }
        const defaultValue =
          typeof params.defaultValue === "string" || typeof params.defaultValue === "boolean"
            ? params.defaultValue
            : propertyType === "BOOLEAN"
              ? false
              : "";
        const propertyKey = (node as ComponentNode).addComponentProperty(
          name,
          propertyType as ComponentPropertyType,
          defaultValue,
          Object.keys(options).length > 0
            ? (options as ComponentPropertyOptions)
            : undefined
        );
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            // Includes the '#' suffix — use THIS exact key in setProperties.
            propertyKey,
          },
        };
      }
      case "instantiate_component": {
        const params = request.params ?? {};
        const component = await resolveComponentForInstance(
          params.componentId,
          params.componentKey
        );
        const instance = component.createInstance();
        try {
          if (typeof params.name === "string") instance.name = params.name;
          await appendToParentIfProvided(instance, params.parentId);
          positionNode(instance, params.x, params.y);

          if (params.properties && typeof params.properties === "object") {
            try {
              instance.setProperties(
                params.properties as Record<string, string | boolean>
              );
            } catch (err) {
              const keys = listComponentPropertyKeys(component);
              throw new Error(
                `${err instanceof Error ? err.message : String(err)} — available property keys (use EXACT strings incl. '#' suffixes): ${keys.join(", ") || "(none)"}`
              );
            }
          }

          const overrides: Array<Record<string, unknown>> = [];
          if (Array.isArray(params.textOverrides)) {
            for (const raw of params.textOverrides as Array<Record<string, unknown>>) {
              if (typeof raw.childName !== "string" || typeof raw.text !== "string") {
                throw new Error("textOverrides entries need childName and text");
              }
              const match = instance
                .findAllWithCriteria({ types: ["TEXT"] })
                .find((t) => t.name === raw.childName);
              if (!match) {
                overrides.push({ childName: raw.childName, error: "text child not found" });
                continue;
              }
              await loadFontsForTextNode(match);
              match.characters = raw.text;
              overrides.push({ childName: raw.childName, applied: true });
            }
          }

          return {
            type: request.type,
            requestId: request.requestId,
            data: {
              instanceId: instance.id,
              name: instance.name,
              componentId: component.id,
              parentId: instance.parent?.id,
              textOverrides: overrides,
            },
          };
        } catch (err) {
          instance.remove();
          throw err;
        }
      }
      case "set_instance_properties": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for set_instance_properties");
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node || node.type !== "INSTANCE") {
          throw new Error(`set_instance_properties needs an INSTANCE, got ${node?.type ?? "missing"}`);
        }
        const properties = request.params?.properties;
        if (!properties || typeof properties !== "object") {
          throw new Error("properties is required");
        }
        try {
          node.setProperties(properties as Record<string, string | boolean>);
        } catch (err) {
          const main = await node.getMainComponentAsync();
          const keys = main ? listComponentPropertyKeys(main) : [];
          throw new Error(
            `${err instanceof Error ? err.message : String(err)} — available property keys: ${keys.join(", ") || "(none)"}`
          );
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            componentProperties: toSerializableResult(
              node.componentProperties,
              "set_instance_properties"
            ),
          },
        };
      }
      case "swap_instance": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for swap_instance");
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node || node.type !== "INSTANCE") {
          throw new Error(`swap_instance needs an INSTANCE, got ${node?.type ?? "missing"}`);
        }
        const params = request.params ?? {};
        const component = await resolveComponentForInstance(
          params.componentId,
          params.componentKey
        );
        node.swapComponent(component);
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: node.id, swappedTo: component.name, componentId: component.id },
        };
      }
      case "apply_style": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for apply_style");
        const node = await getSceneNodeById(nodeId);
        const params = request.params ?? {};
        const styleType = params.styleType;
        if (
          styleType !== "fill" &&
          styleType !== "stroke" &&
          styleType !== "effect" &&
          styleType !== "grid"
        ) {
          throw new Error("styleType must be fill | stroke | effect | grid");
        }

        let styleId = typeof params.styleId === "string" ? params.styleId : "";
        if (!styleId) {
          const styleName =
            typeof params.styleName === "string" ? params.styleName : "";
          if (!styleName) throw new Error("styleId or styleName is required");
          const pool =
            styleType === "effect"
              ? await figma.getLocalEffectStylesAsync()
              : styleType === "grid"
                ? await figma.getLocalGridStylesAsync()
                : await figma.getLocalPaintStylesAsync();
          const match = pool.find((s) => s.name === styleName);
          if (!match) {
            throw new Error(
              `Style not found by name: "${styleName}". Local ${styleType} styles: ${pool.map((s) => s.name).join(", ") || "(none)"}`
            );
          }
          styleId = match.id;
        }

        if (styleType === "fill") {
          if (!("setFillStyleIdAsync" in node)) {
            throw new Error(`Node does not support fill styles: ${node.id}`);
          }
          await node.setFillStyleIdAsync(styleId);
        } else if (styleType === "stroke") {
          if (!("setStrokeStyleIdAsync" in node)) {
            throw new Error(`Node does not support stroke styles: ${node.id}`);
          }
          await node.setStrokeStyleIdAsync(styleId);
        } else if (styleType === "effect") {
          if (!("setEffectStyleIdAsync" in node)) {
            throw new Error(`Node does not support effect styles: ${node.id}`);
          }
          await node.setEffectStyleIdAsync(styleId);
        } else {
          if (!("setGridStyleIdAsync" in node)) {
            throw new Error(`Node does not support grid styles: ${node.id}`);
          }
          await node.setGridStyleIdAsync(styleId);
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: node.id, styleType, styleId },
        };
      }
      case "create_paint_style": {
        const params = request.params ?? {};
        const { name } = params;
        if (typeof name !== "string" || !name) {
          throw new Error("name is required for create_paint_style");
        }
        if (params.skipIfExists === true) {
          const existing = (await figma.getLocalPaintStylesAsync()).find(
            (s) => s.name === name
          );
          if (existing) {
            return {
              type: request.type,
              requestId: request.requestId,
              data: { existed: true, styleId: existing.id, name: existing.name },
            };
          }
        }
        let paint: Paint;
        if (Array.isArray(params.gradientStops)) {
          const gradientType =
            typeof params.gradientType === "string" ? params.gradientType : "LINEAR";
          paint = buildGradientPaint(
            `GRADIENT_${gradientType}` as GradientPaintType,
            params.gradientStops as GradientStopInput[],
            undefined,
            typeof params.opacity === "number" ? params.opacity : undefined
          );
        } else if (typeof params.hex === "string") {
          paint = {
            type: "SOLID",
            color: parseHexColor(params.hex),
            opacity: typeof params.opacity === "number" ? params.opacity : 1,
          };
        } else {
          throw new Error("create_paint_style needs hex or gradientStops");
        }
        const style = figma.createPaintStyle();
        try {
          style.name = name;
          style.paints = [paint];
          if (typeof params.description === "string") {
            style.description = params.description;
          }
        } catch (err) {
          style.remove();
          throw err;
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: { existed: false, styleId: style.id, name: style.name },
        };
      }
      case "create_effect_style": {
        const params = request.params ?? {};
        const { name } = params;
        if (typeof name !== "string" || !name) {
          throw new Error("name is required for create_effect_style");
        }
        if (params.skipIfExists === true) {
          const existing = (await figma.getLocalEffectStylesAsync()).find(
            (s) => s.name === name
          );
          if (existing) {
            return {
              type: request.type,
              requestId: request.requestId,
              data: { existed: true, styleId: existing.id, name: existing.name },
            };
          }
        }
        const effects = buildEffectsFromParams(params.effects);
        const style = figma.createEffectStyle();
        try {
          style.name = name;
          style.effects = effects;
          if (typeof params.description === "string") {
            style.description = params.description;
          }
        } catch (err) {
          style.remove();
          throw err;
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: { existed: false, styleId: style.id, name: style.name, effectCount: effects.length },
        };
      }
      case "import_library_asset": {
        const params = request.params ?? {};
        const { kind, key } = params;
        if (typeof key !== "string" || !key) throw new Error("key is required");
        if (kind === "component") {
          const component = await figma.importComponentByKeyAsync(key);
          return {
            type: request.type,
            requestId: request.requestId,
            data: { kind, id: component.id, name: component.name },
          };
        }
        if (kind === "component_set") {
          const set = await figma.importComponentSetByKeyAsync(key);
          return {
            type: request.type,
            requestId: request.requestId,
            data: {
              kind,
              id: set.id,
              name: set.name,
              defaultVariantId: set.defaultVariant.id,
            },
          };
        }
        if (kind === "style") {
          const style = await figma.importStyleByKeyAsync(key);
          return {
            type: request.type,
            requestId: request.requestId,
            data: { kind, id: style.id, name: style.name, styleType: style.type },
          };
        }
        if (kind === "variable") {
          const variable = await figma.variables.importVariableByKeyAsync(key);
          return {
            type: request.type,
            requestId: request.requestId,
            data: {
              kind,
              id: variable.id,
              name: variable.name,
              resolvedType: variable.resolvedType,
            },
          };
        }
        throw new Error("kind must be component | component_set | style | variable");
      }
      case "list_library_variables": {
        const collectionKey =
          typeof request.params?.collectionKey === "string"
            ? request.params.collectionKey
            : "";
        if (!collectionKey) {
          const collections =
            await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
          return {
            type: request.type,
            requestId: request.requestId,
            data: {
              collections: collections.map((c) => ({
                key: c.key,
                name: c.name,
                libraryName: c.libraryName,
              })),
            },
          };
        }
        const variables =
          await figma.teamLibrary.getVariablesInLibraryCollectionAsync(collectionKey);
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            collectionKey,
            variables: variables.map((v) => ({
              key: v.key,
              name: v.name,
              resolvedType: v.resolvedType,
            })),
          },
        };
      }
      case "create_slot": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for create_slot");
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node || node.type !== "COMPONENT") {
          throw new Error(`create_slot needs a COMPONENT, got ${node?.type ?? "missing"}`);
        }
        // createSlot AUTO-creates the SLOT component property — capture its
        // key by diffing property definitions, so callers don't create a
        // duplicate via add_component_property.
        const keysBefore = new Set(listComponentPropertyKeys(node));
        const slot = node.createSlot();
        const newKey = listComponentPropertyKeys(node).find(
          (k) => !keysBefore.has(k)
        );
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            componentId: node.id,
            slotId: slot.id,
            slotPropertyKey: newKey ?? null,
            hint: "The SLOT component property was created automatically — do NOT add another via add_component_property; adjust it with editComponentProperty (execute_code) if slotSettings need changing.",
          },
        };
      }
      case "get_slots": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for get_slots");
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node) throw new Error(`Node not found: ${nodeId}`);
        const slots: SlotNode[] = [];
        if (node.type === "SLOT") slots.push(node);
        if ("findAll" in node) {
          for (const found of (node as ChildrenMixin).findAll(
            (n) => n.type === "SLOT"
          )) {
            slots.push(found as SlotNode);
          }
        }
        const slotData = slots.map((s) => ({
          slotId: s.id,
          name: s.name,
          childCount: s.children.length,
          limitViolations: s.limitViolations,
        }));
        let slotProperties:
          | Array<{
              key: string;
              description?: string;
              slotSettings?: SlotSettings;
            }>
          | undefined;
        if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
          slotProperties = Object.entries(node.componentPropertyDefinitions)
            .filter(([, def]) => def.type === "SLOT")
            .map(([key, def]) => ({
              key,
              description: def.description,
              slotSettings: def.slotSettings,
            }));
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: node.id, slots: slotData, slotProperties },
        };
      }
      case "reset_slot": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for reset_slot");
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node || node.type !== "SLOT") {
          throw new Error(
            `reset_slot needs a SLOT node, got ${node?.type ?? "missing"}`
          );
        }
        node.resetSlot();
        return {
          type: request.type,
          requestId: request.requestId,
          data: { slotId: node.id, reset: true },
        };
      }
      case "append_to_slot": {
        const params = request.params ?? {};
        const slotId = params.slotId;
        const childId = params.nodeId;
        if (typeof slotId !== "string" || typeof childId !== "string") {
          throw new Error("append_to_slot needs slotId and nodeId");
        }
        const slot = await figma.getNodeByIdAsync(slotId);
        if (!slot || slot.type !== "SLOT") {
          throw new Error(
            `append_to_slot slotId must be a SLOT, got ${slot?.type ?? "missing"}`
          );
        }
        const child = await getSceneNodeById(childId);
        if (typeof params.index === "number") {
          slot.insertChild(params.index, child);
        } else {
          slot.appendChild(child);
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            slotId: slot.id,
            appended: child.id,
            childCount: slot.children.length,
            limitViolations: slot.limitViolations,
          },
        };
      }
      case "create_sticky": {
        const params = request.params ?? {};
        const sticky = figma.createSticky();
        if (params.wide === true) sticky.isWideWidth = true;
        if (typeof params.fillHex === "string") {
          sticky.fills = [solidPaintFromHex(params.fillHex)];
        }
        if (typeof params.text === "string") {
          await setSublayerText(sticky.text, params.text);
        }
        positionNode(sticky, params.x, params.y);
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: sticky.id, nodeName: sticky.name },
        };
      }
      case "create_shape_with_text": {
        const params = request.params ?? {};
        const shape = figma.createShapeWithText();
        if (typeof params.shapeType === "string") {
          shape.shapeType = params.shapeType as ShapeWithTextNode["shapeType"];
        }
        if (typeof params.fillHex === "string") {
          shape.fills = [solidPaintFromHex(params.fillHex)];
        }
        if (typeof params.text === "string") {
          await setSublayerText(shape.text, params.text);
        }
        if (typeof params.width === "number" && typeof params.height === "number") {
          shape.resize(params.width, params.height);
        }
        positionNode(shape, params.x, params.y);
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: shape.id, shapeType: shape.shapeType },
        };
      }
      case "create_connector": {
        const params = request.params ?? {};
        const connector = figma.createConnector();
        const makeEndpoint = (
          nodeId: unknown,
          x: unknown,
          y: unknown,
          magnet: unknown
        ): ConnectorEndpoint => {
          if (typeof nodeId === "string") {
            return {
              endpointNodeId: nodeId,
              magnet: (typeof magnet === "string" ? magnet : "AUTO") as
                | "NONE"
                | "AUTO"
                | "TOP"
                | "LEFT"
                | "BOTTOM"
                | "RIGHT"
                | "CENTER",
            };
          }
          return {
            position: {
              x: typeof x === "number" ? x : 0,
              y: typeof y === "number" ? y : 0,
            },
          };
        };
        connector.connectorStart = makeEndpoint(
          params.startNodeId,
          params.startX,
          params.startY,
          params.startMagnet
        );
        connector.connectorEnd = makeEndpoint(
          params.endNodeId,
          params.endX,
          params.endY,
          params.endMagnet
        );
        if (typeof params.lineType === "string") {
          connector.connectorLineType = params.lineType as
            | "ELBOWED"
            | "STRAIGHT"
            | "CURVED";
        }
        if (typeof params.startCap === "string") {
          connector.connectorStartStrokeCap = params.startCap as ConnectorStrokeCap;
        }
        if (typeof params.endCap === "string") {
          connector.connectorEndStrokeCap = params.endCap as ConnectorStrokeCap;
        }
        if (typeof params.text === "string") {
          await setSublayerText(connector.text, params.text);
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: connector.id },
        };
      }
      case "create_section": {
        const params = request.params ?? {};
        const section = figma.createSection();
        if (typeof params.name === "string") section.name = params.name;
        if (typeof params.width === "number" && typeof params.height === "number") {
          section.resizeWithoutConstraints(params.width, params.height);
        }
        positionNode(section, params.x, params.y);
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: section.id, nodeName: section.name },
        };
      }
      case "create_table": {
        const params = request.params ?? {};
        const rows = typeof params.rows === "number" ? params.rows : 2;
        const columns = typeof params.columns === "number" ? params.columns : 2;
        const table = figma.createTable(rows, columns);
        if (Array.isArray(params.cells)) {
          const cellRows = params.cells as unknown[];
          for (let r = 0; r < cellRows.length && r < table.numRows; r++) {
            const row = cellRows[r];
            if (!Array.isArray(row)) continue;
            for (let c = 0; c < row.length && c < table.numColumns; c++) {
              const value = row[c];
              if (typeof value === "string" && value.length > 0) {
                await setSublayerText(table.cellAt(r, c).text, value);
              }
            }
          }
        }
        positionNode(table, params.x, params.y);
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: table.id,
            numRows: table.numRows,
            numColumns: table.numColumns,
          },
        };
      }
      case "create_code_block": {
        const params = request.params ?? {};
        if (typeof params.code !== "string") {
          throw new Error("create_code_block needs code");
        }
        const block = figma.createCodeBlock();
        block.code = params.code;
        if (typeof params.language === "string") {
          block.codeLanguage = params.language as CodeBlockNode["codeLanguage"];
        }
        positionNode(block, params.x, params.y);
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: block.id, codeLanguage: block.codeLanguage },
        };
      }
      case "create_gif": {
        const params = request.params ?? {};
        if (typeof params.hash !== "string") {
          throw new Error("create_gif needs a media hash");
        }
        const gif = figma.createGif(params.hash);
        positionNode(gif, params.x, params.y);
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: gif.id },
        };
      }
      case "create_slide": {
        const params = request.params ?? {};
        const row = typeof params.row === "number" ? params.row : undefined;
        const col = typeof params.col === "number" ? params.col : undefined;
        const slide =
          row !== undefined && col !== undefined
            ? figma.createSlide(row, col)
            : row !== undefined
              ? figma.createSlide(row)
              : figma.createSlide();
        if (typeof params.backgroundHex === "string") {
          slide.fills = [solidPaintFromHex(params.backgroundHex)];
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: slide.id, nodeName: slide.name },
        };
      }
      case "create_slide_row": {
        const params = request.params ?? {};
        const row = typeof params.row === "number" ? params.row : undefined;
        const slideRow =
          row !== undefined ? figma.createSlideRow(row) : figma.createSlideRow();
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: slideRow.id },
        };
      }
      case "set_slide_transition": {
        const params = request.params ?? {};
        if (typeof params.nodeId !== "string") {
          throw new Error("set_slide_transition needs a slide nodeId");
        }
        const node = await figma.getNodeByIdAsync(params.nodeId);
        if (!node || node.type !== "SLIDE") {
          throw new Error(
            `set_slide_transition needs a SLIDE node, got ${node?.type ?? "missing"}`
          );
        }
        const current = node.getSlideTransition();
        const transition: SlideTransition = {
          style: (typeof params.style === "string"
            ? params.style
            : current.style) as SlideTransition["style"],
          duration:
            typeof params.duration === "number" ? params.duration : current.duration,
          curve: (typeof params.curve === "string"
            ? params.curve
            : current.curve) as SlideTransition["curve"],
          timing: {
            type: (typeof params.timingType === "string"
              ? params.timingType
              : current.timing.type) as "ON_CLICK" | "AFTER_DELAY",
            delay:
              typeof params.delay === "number" ? params.delay : current.timing.delay,
          },
        };
        node.setSlideTransition(transition);
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: node.id, transition },
        };
      }
      case "set_slide_skip": {
        const params = request.params ?? {};
        if (typeof params.nodeId !== "string") {
          throw new Error("set_slide_skip needs a slide nodeId");
        }
        const node = await figma.getNodeByIdAsync(params.nodeId);
        if (!node || node.type !== "SLIDE") {
          throw new Error(
            `set_slide_skip needs a SLIDE node, got ${node?.type ?? "missing"}`
          );
        }
        node.isSkippedSlide = params.skip === true;
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: node.id, isSkippedSlide: node.isSkippedSlide },
        };
      }
      case "focus_slide": {
        const params = request.params ?? {};
        if (typeof params.nodeId !== "string") {
          throw new Error("focus_slide needs a slide nodeId");
        }
        const node = await figma.getNodeByIdAsync(params.nodeId);
        if (!node || node.type !== "SLIDE") {
          throw new Error(
            `focus_slide needs a SLIDE node, got ${node?.type ?? "missing"}`
          );
        }
        figma.currentPage.focusedSlide = node;
        return {
          type: request.type,
          requestId: request.requestId,
          data: { focusedSlideId: node.id },
        };
      }
      case "get_slide_grid": {
        const grid = figma.getSlideGrid();
        const idGrid = grid.map((rowArr) =>
          rowArr.map((s) => ({ id: s.id, name: s.name }))
        );
        return {
          type: request.type,
          requestId: request.requestId,
          data: { grid: idGrid, rows: idGrid.length },
        };
      }
      case "set_slide_grid": {
        const params = request.params ?? {};
        if (!Array.isArray(params.grid)) {
          throw new Error("set_slide_grid needs grid (a 2D array of slide ids)");
        }
        const inputRows = params.grid as unknown[];
        const slideGrid: SlideNode[][] = [];
        for (const row of inputRows) {
          if (!Array.isArray(row)) {
            throw new Error("set_slide_grid: grid must be a 2D array");
          }
          const slideRow: SlideNode[] = [];
          for (const id of row) {
            if (typeof id !== "string") {
              throw new Error("set_slide_grid: each cell must be a slide id string");
            }
            const n = await figma.getNodeByIdAsync(id);
            if (!n || n.type !== "SLIDE") {
              throw new Error(`set_slide_grid: not a SLIDE node: ${id}`);
            }
            slideRow.push(n);
          }
          slideGrid.push(slideRow);
        }
        figma.setSlideGrid(slideGrid);
        return {
          type: request.type,
          requestId: request.requestId,
          data: { rows: slideGrid.length },
        };
      }
      case "create_buzz_frame": {
        const params = request.params ?? {};
        const row = typeof params.row === "number" ? params.row : undefined;
        const col = typeof params.col === "number" ? params.col : undefined;
        const frame =
          row !== undefined && col !== undefined
            ? figma.buzz.createFrame(row, col)
            : row !== undefined
              ? figma.buzz.createFrame(row)
              : figma.buzz.createFrame();
        if (typeof params.assetType === "string") {
          figma.buzz.setBuzzAssetTypeForNode(frame, params.assetType as BuzzAssetType);
        }
        if (typeof params.backgroundHex === "string") {
          frame.fills = [solidPaintFromHex(params.backgroundHex)];
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: frame.id,
            nodeName: frame.name,
            assetType: figma.buzz.getBuzzAssetTypeForNode(frame),
          },
        };
      }
      case "set_buzz_asset_type": {
        const params = request.params ?? {};
        if (typeof params.nodeId !== "string" || typeof params.assetType !== "string") {
          throw new Error("set_buzz_asset_type needs nodeId and assetType");
        }
        const node = await getSceneNodeById(params.nodeId);
        figma.buzz.setBuzzAssetTypeForNode(node, params.assetType as BuzzAssetType);
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: node.id, assetType: params.assetType },
        };
      }
      case "get_buzz_content": {
        const params = request.params ?? {};
        if (typeof params.nodeId !== "string") {
          throw new Error("get_buzz_content needs nodeId");
        }
        const node = await getSceneNodeById(params.nodeId);
        const textFields = figma.buzz.getTextContent(node).map((f, i) => ({
          index: i,
          value: f.value,
          nodeId: f.node ? f.node.id : null,
        }));
        const mediaFields = figma.buzz.getMediaContent(node).map((f, i) => ({
          index: i,
          type: f.type,
          hash: f.hash,
          nodeId: f.node ? f.node.id : null,
        }));
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            nodeId: node.id,
            assetType: figma.buzz.getBuzzAssetTypeForNode(node),
            textFields,
            mediaFields,
          },
        };
      }
      case "set_buzz_text": {
        const params = request.params ?? {};
        if (typeof params.nodeId !== "string") {
          throw new Error("set_buzz_text needs nodeId");
        }
        if (!Array.isArray(params.values)) {
          throw new Error(
            "set_buzz_text needs values (array of strings applied positionally to the asset's text fields)"
          );
        }
        const node = await getSceneNodeById(params.nodeId);
        const fields = figma.buzz.getTextContent(node);
        const values = params.values as unknown[];
        let updated = 0;
        for (let i = 0; i < values.length && i < fields.length; i++) {
          const value = values[i];
          if (typeof value === "string") {
            await fields[i].setValueAsync(value);
            updated++;
          }
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: node.id, updated, totalFields: fields.length },
        };
      }
      case "buzz_smart_resize": {
        const params = request.params ?? {};
        if (
          typeof params.nodeId !== "string" ||
          typeof params.width !== "number" ||
          typeof params.height !== "number"
        ) {
          throw new Error("buzz_smart_resize needs nodeId, width, and height");
        }
        const node = await getSceneNodeById(params.nodeId);
        figma.buzz.smartResize(node, params.width, params.height);
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: node.id, width: params.width, height: params.height },
        };
      }
      case "lint_run": {
        // Gather a serializable snapshot of the design system for the server-side
        // linter. loadAllPagesAsync() first: the manifest is dynamic-page, so a
        // whole-file component scan otherwise sees only the current page.
        await figma.loadAllPagesAsync();
        const [collections, variables, paintStyles, textStyles, effectStyles] =
          await Promise.all([
            figma.variables.getLocalVariableCollectionsAsync(),
            figma.variables.getLocalVariablesAsync(),
            figma.getLocalPaintStylesAsync(),
            figma.getLocalTextStylesAsync(),
            figma.getLocalEffectStylesAsync(),
          ]);

        const serializeValue = (val: unknown): unknown => {
          if (
            val &&
            typeof val === "object" &&
            (val as { type?: string }).type === "VARIABLE_ALIAS"
          ) {
            return { alias: (val as { id: string }).id };
          }
          return val;
        };

        const snapVariables = variables.map((vr) => ({
          id: vr.id,
          name: vr.name,
          collectionId: vr.variableCollectionId,
          resolvedType: vr.resolvedType,
          scopes: vr.scopes,
          hiddenFromPublishing: vr.hiddenFromPublishing,
          codeSyntax: vr.codeSyntax,
          description: vr.description,
          valuesByMode: Object.fromEntries(
            Object.entries(vr.valuesByMode).map(([modeId, val]) => [
              modeId,
              serializeValue(val),
            ])
          ),
        }));

        const snapCollections = collections.map((c) => ({
          id: c.id,
          name: c.name,
          defaultModeId: c.defaultModeId,
          modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
        }));

        const snapStyles = [
          ...paintStyles.map((s) => ({ id: s.id, name: s.name, styleType: "PAINT" })),
          ...textStyles.map((s) => ({
            id: s.id,
            name: s.name,
            styleType: "TEXT",
            fontSize: typeof s.fontSize === "number" ? s.fontSize : undefined,
            fontFamily: s.fontName && typeof s.fontName === "object" ? s.fontName.family : undefined,
          })),
          ...effectStyles.map((s) => ({ id: s.id, name: s.name, styleType: "EFFECT" })),
        ];

        const componentNodes = figma.root.findAllWithCriteria({
          types: ["COMPONENT", "COMPONENT_SET"],
        });

        // Component-subtree enrichment (Wave 10b). One bounded DFS per non-variant
        // root (sets + standalone components; variant children are covered by their
        // set's walk). We emit AGGREGATES (booleans/counts/min/key-union), never raw
        // node trees, so the payload stays small. A shared node budget caps total
        // work; a component only gets `enriched:true` if its walk finished within
        // budget — server detectors treat enriched!==true as "no data".
        const COMPONENT_NODE_BUDGET = 20000;
        const MAX_VARIANT_TUPLES = 400;
        const RAW_PAINT_TYPES = new Set([
          "FRAME", "RECTANGLE", "ELLIPSE", "COMPONENT", "INSTANCE", "COMPONENT_SET",
        ]);
        let componentBudget = COMPONENT_NODE_BUDGET;
        let componentScanTruncated = false;

        const isRawPaintArray = (paints: unknown, styleId: unknown, bound: unknown): boolean => {
          if (styleId || bound) return false; // styled or bound -> not raw
          if (!Array.isArray(paints)) return false; // undefined / figma.mixed
          return paints.some(
            (p) =>
              p &&
              (p as { visible?: boolean }).visible !== false &&
              typeof (p as { type?: string }).type === "string" &&
              ((p as { type: string }).type === "SOLID" ||
                (p as { type: string }).type.startsWith("GRADIENT"))
          );
        };

        interface Enrichment {
          enriched: boolean;
          hasRawPaintLayer: boolean;
          rawPaintSample?: string;
          textLayersMissingType: number;
          textLayerSample?: string;
          minTextFontSize?: number;
          referencedPropKeys: string[];
        }

        const walkComponent = (root: SceneNode): Enrichment => {
          const refKeys = new Set<string>();
          let hasRaw = false;
          let rawSample: string | undefined;
          let textMissing = 0;
          let textSample: string | undefined;
          let minFont: number | undefined;
          let truncated = false;
          const stack: SceneNode[] = [root];
          while (stack.length > 0) {
            if (componentBudget <= 0) {
              truncated = true;
              componentScanTruncated = true;
              break;
            }
            componentBudget--;
            const node = stack.pop() as SceneNode & Record<string, unknown>;
            try {
              // Raw (unbound + unstyled) paint on a container-ish layer.
              if (!hasRaw && RAW_PAINT_TYPES.has(node.type)) {
                const bv = (node.boundVariables ?? {}) as Record<string, unknown>;
                if (
                  isRawPaintArray(node.fills, node.fillStyleId, bv.fills) ||
                  isRawPaintArray(node.strokes, node.strokeStyleId, bv.strokes)
                ) {
                  hasRaw = true;
                  rawSample = node.name;
                }
              }
              // Untyped TEXT (no text style, no bound type) + min font size.
              if (node.type === "TEXT") {
                const bv = (node.boundVariables ?? {}) as Record<string, unknown>;
                const styled = !!node.textStyleId; // "" -> false, mixed(symbol) -> true
                const boundType = !!bv.fontSize || !!bv.lineHeight;
                if (!styled && !boundType) {
                  textMissing++;
                  if (!textSample) textSample = node.name;
                }
                const fs = node.fontSize;
                if (typeof fs === "number") minFont = minFont === undefined ? fs : Math.min(minFont, fs);
              }
              // Property references this layer wires (for dead-property detection).
              const refs = node.componentPropertyReferences as Record<string, unknown> | null;
              if (refs) {
                for (const v of Object.values(refs)) if (typeof v === "string") refKeys.add(v);
              }
              const kids = (node as { children?: readonly SceneNode[] }).children;
              if (kids) for (const ch of kids) stack.push(ch);
            } catch {
              // A single unreadable node must not abort the walk.
            }
          }
          return {
            enriched: !truncated,
            hasRawPaintLayer: hasRaw,
            rawPaintSample: rawSample,
            textLayersMissingType: textMissing,
            textLayerSample: textSample,
            minTextFontSize: minFont,
            referencedPropKeys: [...refKeys],
          };
        };

        const snapComponents = componentNodes.map((n) => {
          // A variant COMPONENT (child of a COMPONENT_SET) throws on
          // componentPropertyDefinitions — only sets and standalone components
          // expose it. Guard so the whole scan doesn't abort on one variant.
          const isVariant =
            n.type === "COMPONENT" && n.parent?.type === "COMPONENT_SET";
          const out: Record<string, unknown> = {
            id: n.id,
            name: n.name,
            type: n.type,
            isVariant,
            propertyDefinitions: isVariant ? undefined : n.componentPropertyDefinitions,
          };
          if (isVariant) return out; // covered by its set's walk
          try {
            const e = walkComponent(n);
            Object.assign(out, e);
          } catch {
            /* leave un-enriched */
          }
          // COMPONENT_SET: realized variant tuples + default variant tuple.
          if (n.type === "COMPONENT_SET") {
            try {
              const set = n as ComponentSetNode;
              const tuples: Array<Record<string, string>> = [];
              let tuplesTruncated = false;
              for (const child of set.children) {
                if (child.type !== "COMPONENT") continue;
                if (tuples.length >= MAX_VARIANT_TUPLES) {
                  tuplesTruncated = true;
                  break;
                }
                tuples.push({ ...(child.variantProperties ?? {}) });
              }
              out.variantTuples = tuples;
              out.variantTuplesTruncated = tuplesTruncated;
              const dv = set.defaultVariant;
              out.defaultVariantTuple = dv ? { ...(dv.variantProperties ?? {}) } : undefined;
            } catch {
              /* no variant data */
            }
          }
          return out;
        });

        // Node -> variable bindings (for no-node-binds-primitive etc.). Recurse
        // into each field's binding value to pull VARIABLE_ALIAS ids wherever
        // they sit (scalar fields, fills[] arrays, nested paint boundVariables).
        // Bounded so a huge file can't produce an unbounded payload.
        figma.skipInvisibleInstanceChildren = true;
        const collectAliasIds = (binding: unknown, into: string[]): void => {
          if (!binding || typeof binding !== "object") return;
          if (Array.isArray(binding)) {
            for (const b of binding) collectAliasIds(b, into);
            return;
          }
          const o = binding as Record<string, unknown>;
          if (o.type === "VARIABLE_ALIAS" && typeof o.id === "string") {
            into.push(o.id);
            return;
          }
          for (const val of Object.values(o)) collectAliasIds(val, into);
        };
        const MAX_BINDINGS = 10000;
        const nodeBindings: Array<{
          nodeId: string;
          nodeName: string;
          nodeType: string;
          field: string;
          variableId: string;
        }> = [];
        let bindingsTruncated = false;
        const boundNodes = figma.root.findAll((n) => {
          const bv = (n as { boundVariables?: unknown }).boundVariables;
          return (
            !!bv && typeof bv === "object" && Object.keys(bv as object).length > 0
          );
        });
        scan: for (const n of boundNodes) {
          const bv = (n as unknown as { boundVariables: Record<string, unknown> })
            .boundVariables;
          for (const [field, binding] of Object.entries(bv)) {
            const ids: string[] = [];
            collectAliasIds(binding, ids);
            for (const variableId of ids) {
              nodeBindings.push({
                nodeId: n.id,
                nodeName: n.name,
                nodeType: n.type,
                field,
                variableId,
              });
              if (nodeBindings.length >= MAX_BINDINGS) {
                bindingsTruncated = true;
                break scan;
              }
            }
          }
        }

        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            collections: snapCollections,
            variables: snapVariables,
            styles: snapStyles,
            components: snapComponents,
            nodeBindings,
            bindingsTruncated,
            componentScanTruncated,
            meta: {
              pageCount: figma.root.children.length,
              scannedAllPages: true,
            },
          },
        };
      }
      case "dev_resources": {
        const nodeId = request.nodeIds && request.nodeIds[0];
        if (!nodeId) throw new Error("nodeIds is required for dev_resources");
        const node = await getSceneNodeById(nodeId);
        const params = request.params ?? {};
        const action = params.action;
        if (action === "get") {
          const resources = await node.getDevResourcesAsync({
            includeChildren: params.includeChildren === true,
          });
          return {
            type: request.type,
            requestId: request.requestId,
            data: { nodeId: node.id, resources: toSerializableResult(resources, "dev_resources") },
          };
        }
        const url = typeof params.url === "string" ? params.url : "";
        if (!url) throw new Error(`dev_resources ${String(action)} needs url`);
        if (action === "add") {
          await node.addDevResourceAsync(
            url,
            typeof params.name === "string" ? params.name : undefined
          );
        } else if (action === "edit") {
          await node.editDevResourceAsync(url, {
            ...(typeof params.newName === "string" ? { name: params.newName } : {}),
            ...(typeof params.newUrl === "string" ? { url: params.newUrl } : {}),
          });
        } else if (action === "delete") {
          await node.deleteDevResourceAsync(url);
        } else {
          throw new Error("action must be get | add | edit | delete");
        }
        return {
          type: request.type,
          requestId: request.requestId,
          data: { nodeId: node.id, action, url },
        };
      }
      case "execute_code": {
        const code = request.params?.code;
        if (typeof code !== "string" || !code.trim()) {
          throw new Error("code is required for execute_code");
        }
        // Wrap the supplied code in an async IIFE built as a STRING so the
        // sandbox parser (ES2017-capable) handles the async syntax at runtime.
        // The build transpiles this file to es2015, so an AsyncFunction
        // constructor obtained from a (transpiled) async literal would be a
        // plain Function and reject `await` in the body.
        const fn = new Function(
          "figma",
          '"use strict"; return (async function () {\n' + code + "\n})();"
        ) as (figmaArg: typeof figma) => Promise<unknown>;
        const result = await fn(figma);
        return {
          type: request.type,
          requestId: request.requestId,
          data: {
            result: toSerializableResult(result),
          },
        };
      }
      default:
        throw new Error(`Unknown request type: ${request.type}`);
    }
  } catch (error) {
    return {
      type: request.type,
      requestId: request.requestId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

figma.showUI(__html__, { width: 320, height: 180 });
sendStatus();

figma.on("selectionchange", () => {
  sendStatus();
});

// ---- change tracking: feeds the server's digest cache invalidation --------
// Batched + throttled so heavy edits don't flood the WebSocket.
let pendingChangeCount = 0;
let pendingChangeKinds: Record<string, number> = {};
let docEventTimer: number | null = null;

const flushDocEvents = (): void => {
  docEventTimer = null;
  if (pendingChangeCount === 0) return;
  const payload = { changes: pendingChangeCount, kinds: pendingChangeKinds };
  pendingChangeCount = 0;
  pendingChangeKinds = {};
  figma.ui.postMessage({ type: "doc-event", payload });
};

const queueDocEvent = (count: number, kind: string): void => {
  pendingChangeCount += count;
  pendingChangeKinds[kind] = (pendingChangeKinds[kind] ?? 0) + count;
  if (docEventTimer === null) {
    docEventTimer = setTimeout(flushDocEvents, 1000);
  }
};

// Page-scoped node changes work without loading all pages (dynamic-page safe).
// Track subscribed pages: page.on handlers persist per page, so re-subscribing
// on every page revisit would double-count changes.
const subscribedPageIds = new Set<string>();
const subscribeToPageChanges = (): void => {
  if (subscribedPageIds.has(figma.currentPage.id)) return;
  try {
    figma.currentPage.on("nodechange", (event) => {
      for (const change of event.nodeChanges) {
        queueDocEvent(1, change.type);
      }
    });
    subscribedPageIds.add(figma.currentPage.id);
  } catch (err) {
    console.warn(
      "[figma-limitless-mcp] nodechange subscription failed:",
      err instanceof Error ? err.message : String(err)
    );
  }
};

subscribeToPageChanges();

// Style create/rename/delete never fires nodechange — subscribe separately so
// manual style edits invalidate the digest cache too.
try {
  figma.on("stylechange", (event) => {
    queueDocEvent(event.styleChanges.length || 1, "STYLE_CHANGE");
  });
} catch (err) {
  console.warn(
    "[figma-limitless-mcp] stylechange subscription failed:",
    err instanceof Error ? err.message : String(err)
  );
}
figma.on("currentpagechange", () => {
  subscribeToPageChanges();
  queueDocEvent(1, "PAGE_SWITCH");
  sendStatus();
});

/**
 * Guardrail: applies the heavy-read size cap to a response before it crosses
 * the bridge. Screenshots are exempt (intentionally large, base64).
 */
const applyReadCap = (
  request: ServerRequest,
  response: PluginResponse
): PluginResponse => {
  const hint = HEAVY_READ_HINTS[request.type];
  if (!hint || response.error) return response;
  try {
    const size = JSON.stringify(response.data).length;
    if (size > MAX_READ_RESULT_CHARS) {
      return {
        type: response.type,
        requestId: response.requestId,
        error: `Response too large (${size} chars > ${MAX_READ_RESULT_CHARS}). Guardrail: ${hint}.`,
      };
    }
  } catch {
    /* size check is best-effort */
  }
  return response;
};

// Guardrail: mutations must never interleave — two agents patching the same
// subtree mid-flight produce corrupt intermediate states. Writes (including
// execute_code, which can mutate) run strictly one-at-a-time; reads stay
// fully parallel.
let mutationChain: Promise<void> = Promise.resolve();

figma.ui.onmessage = async (message) => {
  if (message.type === "ui-ready") {
    sendStatus();
    return;
  }

  if (message.type === "server-request") {
    const request = message.payload as ServerRequest;
    const run = async (): Promise<void> => {
      const response = applyReadCap(request, await handleRequest(request));
      try {
        figma.ui.postMessage(response);
      } catch (err) {
        figma.ui.postMessage({
          type: response.type,
          requestId: response.requestId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };

    if (
      EDIT_REQUEST_TYPES.has(request.type) ||
      FIGJAM_REQUEST_TYPES.has(request.type) ||
      SLIDES_REQUEST_TYPES.has(request.type) ||
      BUZZ_REQUEST_TYPES.has(request.type) ||
      request.type === "execute_code"
    ) {
      mutationChain = mutationChain.then(run, run);
    } else {
      void run();
    }
  }
};

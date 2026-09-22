// Local stand-ins for Figma Plugin API Update 139: composed color variable
// values (VariableComposedColor) and the COLOR_OPACITY scope. Both are
// documented but missing from every published @figma/plugin-typings (1.138.0
// is the latest). VariableValue and VariableScope are global type ALIASES, so
// they can't be declaration-merged; the names here are distinct on purpose and
// shadow nothing once the real types land.
//
// Delete this file (and switch its imports to the real types) when
// @figma/plugin-typings >= 1.139 ships these types.

/** A COLOR variable value made of a color plus a separate opacity PERCENTAGE
 *  (60 = 60%). Figma requires the color and/or the opacity to be an alias. */
export interface ComposedColorValue {
  color: RGB | RGBA | VariableAlias;
  opacity: number | VariableAlias;
}

export const isVariableAlias = (v: unknown): v is VariableAlias =>
  typeof v === "object" &&
  v !== null &&
  (v as { type?: unknown }).type === "VARIABLE_ALIAS" &&
  typeof (v as { id?: unknown }).id === "string";

/** Read side: is a live valuesByMode entry a composed color? The typings
 *  can't narrow it, so detect the shape at runtime. */
export const isComposedColorValue = (v: unknown): v is ComposedColorValue => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (!("color" in o) || !("opacity" in o) || "r" in o) return false;
  const c = o.color;
  const colorOk =
    isVariableAlias(c) ||
    (typeof c === "object" && c !== null && typeof (c as { r?: unknown }).r === "number");
  return colorOk && (typeof o.opacity === "number" || isVariableAlias(o.opacity));
};

/** Write side: a write_variables value shaped like a composed color. The
 *  sides are validated when the value is built. `type: 'COMPOSED_COLOR'` is
 *  tolerated so get_variables_deep output can be written back as-is. */
export interface ComposedColorInput {
  type?: "COMPOSED_COLOR";
  color: unknown;
  opacity: unknown;
}

export const isComposedColorInput = (v: unknown): v is ComposedColorInput => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return "color" in o && "opacity" in o && (o.type === undefined || o.type === "COMPOSED_COLOR");
};

/** The variable id of one alias side of a composed-color input: `{alias: id}`,
 *  or the read-side `{type: 'VARIABLE_ALIAS', id}`. Null when it isn't an alias. */
export const aliasInputId = (v: unknown): string | null => {
  if (typeof v !== "object" || v === null) return null;
  const o = v as { alias?: unknown; type?: unknown; id?: unknown };
  if (typeof o.alias === "string") return o.alias;
  if (o.type === "VARIABLE_ALIAS" && typeof o.id === "string") return o.id;
  return null;
};

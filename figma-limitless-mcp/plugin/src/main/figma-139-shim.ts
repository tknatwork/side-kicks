// Figma Plugin API Update 139 composed color variable values
// (VariableComposedColor), which no published @figma/plugin-typings declares
// yet (1.138.0 is the latest). VariableValue is a global type ALIAS, so it
// can't be declaration-merged; the names here are distinct on purpose and
// shadow nothing once the real types land.
//
// Only ComposedColorValue is a typings stand-in: when @figma/plugin-typings
// >= 1.139 ships VariableComposedColor, replace it with the real type (and
// drop the VariableValue cast in code.ts's parseVariableValueAsync). The
// runtime guards and write_variables input helpers below are this plugin's
// own code and stay.
// The COLOR_OPACITY scope needs no stand-in: code.ts casts scope strings to
// VariableScope, which carries the new value through until the typings list it.

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

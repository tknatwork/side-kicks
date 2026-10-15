// Figma Plugin API Update 139 composed color variable values: a COLOR value
// made of a color plus a separate opacity PERCENTAGE (60 = 60%), where the
// color and/or the opacity is a variable alias. The type, VariableComposedColor,
// comes from @figma/plugin-typings (>= 1.139). This file holds the plugin's own
// runtime guards for reading those values and the write_variables input helpers
// for building them.

export const isVariableAlias = (v: unknown): v is VariableAlias =>
  typeof v === "object" &&
  v !== null &&
  (v as { type?: unknown }).type === "VARIABLE_ALIAS" &&
  typeof (v as { id?: unknown }).id === "string";

/** Read side: is a live valuesByMode entry a composed color? VariableValue has
 *  no tag field to narrow on, so detect the shape at runtime. The check accepts
 *  exactly VariableComposedColor's two shapes: an aliased color with a number or
 *  aliased opacity, or a raw color with an aliased opacity. */
export const isComposedColorValue = (v: unknown): v is VariableComposedColor => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (!("color" in o) || !("opacity" in o) || "r" in o) return false;
  const c = o.color;
  if (isVariableAlias(c)) return typeof o.opacity === "number" || isVariableAlias(o.opacity);
  const rawColor =
    typeof c === "object" && c !== null && typeof (c as { r?: unknown }).r === "number";
  return rawColor && isVariableAlias(o.opacity);
};

/** Read side: the variable ids a live valuesByMode entry references — a plain
 *  VARIABLE_ALIAS, or the aliased sides of a composed color. */
export const referencedVariableIds = (v: unknown): string[] => {
  if (isVariableAlias(v)) return [v.id];
  if (!isComposedColorValue(v)) return [];
  const ids: string[] = [];
  if (isVariableAlias(v.color)) ids.push(v.color.id);
  if (isVariableAlias(v.opacity)) ids.push(v.opacity.id);
  return ids;
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

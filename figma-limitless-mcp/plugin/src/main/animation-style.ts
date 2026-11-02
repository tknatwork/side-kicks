// Custom animation styles (Plugin API Update 140): the configuration an applied
// style takes, the entries a custom style holds, and how a style reads back.
// Pure (no `figma`), so the plugin tests run it on the sources.

export type AnimationKind = "FIGMA" | "CUSTOM";

export interface AnimationEntryInput {
  styleId: string;
  props?: { [key: string]: AnimationStylePropValue };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The configuration `applyAnimationStyle` takes for a style of `kind`. A custom
 * style carries no duration or props of its own (CustomAnimationStyleConfiguration
 * is `type` + `timelineOffset`): those live on its entries. A Figma style's
 * config is omitted when nothing is overridden, as before Update 140.
 */
export function animationConfig(
  kind: AnimationKind,
  params: Readonly<Record<string, unknown>>
): AnimationStyleConfiguration | undefined {
  const offset = typeof params.timelineOffset === "number" ? params.timelineOffset : undefined;
  if (kind === "CUSTOM") {
    if (params.duration !== undefined || params.props !== undefined) {
      throw new Error(
        "A custom animation style takes only timelineOffset: duration and props belong to its entries (an entry's duration is its `duration` prop, set when it is added). To change an entry, remove it and add it again with update_animation_style; the re-added entry goes last."
      );
    }
    return offset === undefined ? { type: "CUSTOM" } : { type: "CUSTOM", timelineOffset: offset };
  }
  const config: {
    duration?: number;
    timelineOffset?: number;
    props?: { [key: string]: AnimationStylePropValue };
  } = {};
  if (typeof params.duration === "number") config.duration = params.duration;
  if (offset !== undefined) config.timelineOffset = offset;
  if (isPlainObject(params.props)) {
    config.props = params.props as { [key: string]: AnimationStylePropValue };
  }
  return Object.keys(config).length > 0 ? config : undefined;
}

/** `entries` / `addEntries` as sent: each a Figma animation style id plus optional props. */
export function animationEntries(raw: unknown, field = "entries"): AnimationEntryInput[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${field} must be an array of { styleId, props? }`);
  return raw.map((entry, i) => {
    if (!isPlainObject(entry) || typeof entry.styleId !== "string" || !entry.styleId) {
      throw new Error(`${field}[${i}] needs a styleId (a Figma animation style, from get_motion)`);
    }
    if (entry.props !== undefined && !isPlainObject(entry.props)) {
      throw new Error(`${field}[${i}].props must be an object`);
    }
    return entry.props === undefined
      ? { styleId: entry.styleId }
      : { styleId: entry.styleId, props: entry.props as AnimationEntryInput["props"] };
  });
}

/**
 * The applied instance that a removal by `styleId` means.
 *
 * A Figma animation style reads back from a node with an internal styleId
 * ("CodeComponentId:1:8"), not the id `figmaAnimationStyles()` lists ("Position");
 * both carry the same name ("motion.preset_name.position"). Checked live
 * 2026-11-02. So an exact styleId wins (a custom style's id, or an internal id
 * read back), and a listed id is matched to Figma styles by name. More than one
 * match is refused rather than guessed.
 */
export function appliedInstanceFor(
  applied: ReadonlyArray<{ id: string; styleId: string; name: string; type?: string }>,
  styleId: string,
  listed: ReadonlyArray<{ styleId: string; name: string }>,
  nodeId: string
): string {
  let matches = applied.filter((s) => s.styleId === styleId);
  const template = listed.find((s) => s.styleId === styleId);
  if (matches.length === 0 && template) {
    matches = applied.filter((s) => s.type !== "CUSTOM" && s.name === template.name);
  }
  if (matches.length === 1) return matches[0].id;
  if (matches.length > 1) {
    throw new Error(
      `styleId "${styleId}" is applied ${matches.length} times on ${nodeId}; pass appliedStyleInstanceId, one of: ${matches.map((s) => s.id).join(", ")}`
    );
  }
  const all = applied.map((s) => `${s.styleId} (instance ${s.id})`).join(", ");
  throw new Error(
    `No applied animation style matches styleId "${styleId}" on ${nodeId}. Applied: ${all || "(none)"}`
  );
}

/** A custom animation style as the tools report it. */
export function describeCustomAnimationStyle(
  style: Pick<CustomAnimationStyle, "id" | "key" | "name" | "description" | "remote" | "animationEntries">
) {
  return {
    styleId: style.id,
    key: style.key,
    name: style.name,
    description: style.description || undefined,
    remote: style.remote,
    entries: style.animationEntries.map((entry) => ({
      id: entry.id,
      styleId: entry.styleId,
      name: entry.name,
      duration: entry.duration,
      timelineOffset: entry.timelineOffset,
      props: entry.props,
    })),
  };
}

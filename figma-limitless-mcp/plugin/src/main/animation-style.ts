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

# Community Release Notes

> Copy-paste source for the Figma Community publish dialog ("What's new in
> this version") and the plugin listing. User-facing language only — the
> engineering changelog lives in [CHANGELOG.md](CHANGELOG.md).

---

## v2.2.0 — "What's new" (compact, for the publish dialog)

**Safer imports, new style types, and motion tokens.**

🛡️ Importing is now always safe by default. Simple-mode imports only add and
update — they never remove anything. Replacing a file's contents (Clean
Import) is now an explicit Advanced-mode choice with a confirmation that
spells out exactly what will be deleted. (Previously, importing all-new
collections could silently clear existing variables and styles — if that ever
happened to you, a single Undo or Figma's version history restores the file.)

🌫️ New effect styles: Noise (monotone, duotone, multitone), Texture, and
Glass now export and import with full fidelity.

🧱 Pattern fills round-trip within a file, and video/shader paints no longer
vanish silently from exports.

🔤 Text styles are now complete: leading trim, paragraph spacing & indent,
list spacing, hanging punctuation and hanging lists all round-trip.

🎛️ All 22 variable scopes are supported (text content, opacity, stroke
width, effect values, font family/style/weight and more) — and one
unrecognized scope no longer drops the rest.

⏱️ Motion tokens are first-class in the preview: duration and easing tokens
(cubic-bezier, spring, steps) are counted as Timing and Easing — and the
plugin is already future-proofed for Figma's native timing/easing variable
types the day they ship.

💪 Sturdier imports: an unsupported effect, paint, or style is skipped with a
note instead of stopping the whole import.

---

## v2.2.0 — one-liner (for space-constrained fields)

Safer merge-first imports with confirmation-gated replace, full-fidelity
Noise/Texture/Glass effects, pattern fills, complete text styles, all 22
variable scopes, and Timing/Easing motion-token counts in the preview.

---

## Listing description refresh (optional, "What it does" section)

Move your design system anywhere. Variables & Styles Extractor exports and
imports Figma variables and styles — every collection, mode, alias, scope,
and style — as clean, re-importable JSON, entirely on your machine (no
network access).

- **Merge-first imports**: adding tokens to a file never removes what's
  already there; replacing content is an explicit, confirmed choice.
- **Everything round-trips**: color/number/string/boolean variables with all
  22 scopes and cross-collection aliases; paint styles including gradients,
  images, and pattern fills; text styles down to leading trim and hanging
  punctuation; effect styles including Noise, Texture, and Glass; layout
  guides.
- **Motion-ready**: duration and easing tokens are recognized and counted as
  Timing and Easing, and future native timing/easing variable types are
  supported ahead of time.
- **Three export formats**: Figma JSON (perfect round-trips), W3C Design
  Tokens, and Tokens Studio.
- **Built for big systems**: batched processing with live progress and
  cancel, pre-import diff review, plan-limit checks, automatic pre-import
  snapshot with one-click undo.
- **Private by design**: zero network access — your file never leaves Figma.

---

*Maintainer note: keep this file in sync with the CHANGELOG entry for each
release; write for designers, not maintainers. The safety-fix framing above
was chosen to be honest but calm — affected users get a recovery path
(Undo / version history) in the same sentence that discloses the issue.*

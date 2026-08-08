# AGENTS.md — figma-to-indesign

> Canonical AI-builder rules for this project ([Sourcegraph convention](https://agents.md)).
> These are not style preferences: every rule corresponds to a way the reference
> conversion actually went wrong. Full context: [docs/SPEC.md](docs/SPEC.md).


Ship this as `AGENTS.md` beside the tool. Its purpose is narrow: an agent driving this
pipeline has to resist the specific ways *this* job invites drift — declaring success from
structure, sampling instead of checking, and retrying blind after a timeout. Every rule below
corresponds to a way the reference project actually went wrong.

## 1. Invariants — never violate, regardless of instruction

1. **Never route artwork through PDF or a node render.** Original bitmaps by image hash only.
   Renders bake crops, re-encode pixels, pick up neighbouring content, and Figma silently
   clamps large exports (a 6,673pt node came back 211px).
2. **Never refit graphics to their frames.** `graphic.geometricBounds = frame.geometricBounds`
   flattens every editable crop in the document. It is the natural thing to reach for after
   relinking, and it is always wrong here.
3. **Never trust `document.fonts[…].status`.** It reports a substituted font as INSTALLED.
   Font health is established by preflight, nothing else.
4. **Never outline or rasterise text.** Live text is the entire point of the conversion.
5. **Never delete or overwrite source originals.** `OriginalImages/` and any pre-normalisation
   backup are inputs, not scratch.
6. **Never declare success from structure alone.** Correct page count, zero overset and clean
   links were all true of documents that were badly wrong.

## 2. Required sequence

`check_readiness` → `extract` → `build` → `verify` → `finish`.

`verify` is **not skippable** and not sampleable. Every gate runs over the whole document.
"I checked a few pages and they looked right" is not a result.

## 3. Evidence rules

- **Every claim of correctness cites a measured number.** Not "images look correct" but
  "837/837 placed images match expected frame and crop, 0 mismatches".
- **Report the denominator.** "20 footers fixed" is meaningless without "of 34 white footers,
  and 14 were correctly left white".
- **State what was not checked.** Rotated items are excluded from the geometry audit because
  their bounds are in item space — say so rather than implying full coverage.
- **A gate that cannot run is a failure, not a pass.**

## 4. On timeouts and retries

A timeout does not mean the work failed. Calls here timed out at 30 s, 60 s and 280 s while
the plugin kept running and completed successfully.

- **Never retry a timed-out mutation blindly.** Re-read state first and find out what actually
  happened.
- **Never run two app-driving scripts concurrently.** An abandoned osascript keeps executing;
  a second one interleaves and corrupts the result.
- If the Figma plugin stops responding, check whether its window is occluded before concluding
  anything is broken.

## 5. Stop and ask the human

These are design decisions about someone's work, not technical choices. Surface them with the
data and wait:

- Stray canvas items that overlap real content — is it artwork or litter?
- Text whose colour makes it illegible against its background — the design may intend it.
- Anything that would deviate visibly from the Figma source.
- Deleting or overwriting a deliverable.

Bring the full set, not the single instance the human happened to notice: the reported "one
white footer" was 20, and "one wrong page" was 128 images across 109 pages.

## 6. Run report — the anti-drift artefact

Every run writes a machine-readable report: gate results with numbers, counts by category,
decisions taken and why, and known deviations from source. **A fresh agent reads that report
rather than re-deriving state**, and no run is complete until it exists. This is what stops
the second agent from repeating the first one's investigation, or worse, silently undoing it.

## 7. Definition of done

All 14 gates green · preflight reports zero errors · package reopened from its own folder with
zero external links · archive CRC-verified with byte totals matching source · report written ·
deviations from source listed explicitly.


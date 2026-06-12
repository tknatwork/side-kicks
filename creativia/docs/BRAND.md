# CREATIVIA — Brand System

The visual system from the Designathon submission, captured as reusable tokens for the
planned demo. A high‑energy palette on a calm, dark canvas: the bright colours carry
meaning, the neutrals let the eyes rest.

> Source: Team 6's A4 process document (the "Branding" page) — see
> [`../assets/screens/06-branding-system.jpg`](../assets/screens/06-branding-system.jpg).
> Hex values are the team's documented swatch labels; the gradient stops were sampled
> from the rendered swatch.

## Colour

| Role | Token | Hex | Rationale |
|------|-------|-----|-----------|
| **Primary** | AI Soundwave (gradient) | `#FE1E72` → `#F89030` | Pink for passion, orange for optimism — "the spark that kicks things off and keeps the momentum going." |
| **Secondary** | Soundwave Blue | `#2662D9` | Keeps things clear and steady. |
| **Secondary** | Accent Magenta | `#E32678` | Adds a little playfulness — without stealing the show. |
| **Neutral** | Almost Black | `#121212` | The calm canvas; lets the bright colours shine. |
| **Neutral** | White | `#FFFFFF` | Room for the eyes to rest. |

### Swatches

```
Primary gradient   ▮ #FE1E72  →  ▮ #F89030     (AI Soundwave)
Soundwave Blue     ▮ #2662D9
Accent Magenta     ▮ #E32678
Almost Black       ▮ #121212
White              ▯ #FFFFFF
```

### Suggested CSS custom properties (for the demo)

```css
:root {
  /* Primary — AI Soundwave gradient */
  --c-spark-pink:   #FE1E72;
  --c-spark-orange: #F89030;
  --grad-soundwave: linear-gradient(90deg, var(--c-spark-pink), var(--c-spark-orange));

  /* Secondary */
  --c-soundwave-blue:  #2662D9;
  --c-accent-magenta:  #E32678;

  /* Neutrals */
  --c-almost-black: #121212;
  --c-white:        #FFFFFF;
}
```

## Type

| Use | Family | Weights seen |
|-----|--------|--------------|
| **Titles** | **Outfit** | Black, Bold |
| **Body** | **Inter** | Bold, Regular, Bold Italic, Italic |

> *"Outfit for titles, Inter for text — one keeps personality, the other keeps things easy
> to read. Together, they make the screens feel clear, friendly, and not tiring on the
> eyes."*

Both are open‑source Google Fonts (SIL OFL), so they're safe to use in the demo.

```css
--font-display: "Outfit", system-ui, sans-serif;
--font-body:    "Inter", system-ui, sans-serif;
```

## Usage notes

- Reserve the **AI Soundwave gradient** for primary actions and "AI is doing something"
  moments (capture, analysis, the soundwave visual). It's the brand's signature.
- Keep large surfaces **Almost Black**; use **White** for primary text and breathing room.
- **Soundwave Blue** and **Accent Magenta** are accents — for charts, tags, and secondary
  emphasis — not large fills.

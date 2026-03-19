# 🍯 Nectar Core Design System

A neo-brutalist design system for Tushar Kant's portfolio platform (tusharkantnaik.com). Built with a 3-tier token architecture, zero npm dependencies in the browser, and Vercel deployment.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Foundations](#foundations)
3. [Components](#components)
4. [Figma Structure](#figma-structure)
5. [Token Architecture](#token-architecture)

---

## Overview

### What is Nectar Core?

Nectar Core is a neo-brutalist design system that powers a multi-project portfolio platform. It uses thick borders, hard shadows (no blur), geometric sans-serif body text (Switzer) paired with a serif display face (Libre Baskerville), and a warm cream/honey/pastel color palette.

### Design Principles

1. **Neo-Brutalist** — 3px borders, 0 border-radius (default), hard offset shadows
2. **Warm & Approachable** — Cream backgrounds, honey gold primary, sky blue accent
3. **Typography-Driven** — Serif headings (Libre Baskerville), sans body (Switzer)
4. **Dark Mode First-Class** — Every token has light AND dark values, no afterthought
5. **Per-Project Isolation** — Each portfolio project can override mapped-tier tokens via CSS scoping

### Key Facts

- **293 CSS custom properties** generated from 3-tier JSON tokens
- **37 pastel colors** + 11 neutrals as seed primitives
- **4 font families**: Libre Baskerville (display), Switzer (sans), Roboto Mono (code), Merriweather (caption)
- **Zero npm dependencies** in the browser (vanilla HTML/CSS/JS)
- **CSS layers**: `@layer tokens, base, shell, project, showcase;`

---

## Foundations

### 🎨 Colors

#### Seed Tier (Primitives — raw values, no meaning)

**Pastels (37 colors):**

| Token | Hex | Description |
|-------|-----|-------------|
| `pastel/lavender` | #E8D5F5 | Soft purple |
| `pastel/mint` | #D5F5E3 | Soft green |
| `pastel/peach` | #FADADD | Soft pink-orange |
| `pastel/coral` | #F5B7B1 | Warm pink — primary brand origin |
| `pastel/coralLight` | #FBE0DC | Light coral tint |
| `pastel/coralDeep` | #E8948C | Deep coral for dark-mode accents |
| `pastel/rose` | #D4654F | Warm terracotta — dark mode destructive |
| `pastel/ember` | #C0503E | Deep terracotta — light mode destructive |
| `pastel/sage` | #D5E1D5 | Muted green |
| `pastel/spring` | #A3D9B8 | Spring green |
| `pastel/meadow` | #7BC89A | Bright soft green — dark mode success |
| `pastel/forest` | #3D7A5E | Deep muted green |
| `pastel/lichen` | #E8E6C8 | Pale olive |
| `pastel/olive` | #8B9A6B | Classic muted yellow-green |
| `pastel/moss` | #6B7F4E | Moss — deep earthy green |
| `pastel/pine` | #4A5E35 | Pine — darkest olive |
| `pastel/blush` | #F5D5E0 | Light rose |
| `pastel/wisteria` | #C3A6D4 | Medium purple — warm lilac |
| `pastel/plum` | #7B5C8E | Deep purple — rich plum |
| `pastel/sky` | #D5E8F5 | Soft blue |
| `pastel/skyLight` | #EAF4FB | Lightest blue tint |
| `pastel/skyMid` | #B3D4F0 | Medium blue |
| `pastel/azure` | #A8C8E8 | Steel blue — muted |
| `pastel/navy` | #3D5A80 | Muted navy — dark accent |
| `pastel/lemon` | #FFF9C4 | Soft yellow |
| `pastel/butter` | #FFF3A3 | Warm butter yellow |
| `pastel/honey` | #FFE082 | Rich golden yellow — PRIMARY |
| `pastel/honeyDeep` | #D4A843 | Deep honey for dark mode primary |
| `pastel/cream` | #FFFDF5 | Off-white warm yellow — light bg |
| `pastel/fog` | #F0EDED | Cool light grey |
| `pastel/ash` | #D9D5D2 | Warm mid grey |
| `pastel/slate` | #8B8589 | Cool dark grey |
| `pastel/graphite` | #3E3A44 | Dark warm grey |
| `pastel/cloud` | #F7F5F3 | Warm off-white |
| `pastel/nearBlack` | #12101A | Near-black |

**Neutrals (11-step scale):**

| Token | Hex |
|-------|-----|
| `neutral/50` | #FAFAF9 |
| `neutral/100` | #F5F5F4 |
| `neutral/200` | #E7E5E4 |
| `neutral/300` | #D6D3D1 |
| `neutral/400` | #A8A29E |
| `neutral/500` | #78716C |
| `neutral/600` | #57534E |
| `neutral/700` | #44403C |
| `neutral/800` | #292524 |
| `neutral/900` | #1C1917 |
| `neutral/950` | #0C0A09 |

**Semantic Seeds:**

| Token | Hex | Description |
|-------|-----|-------------|
| `ink` | #1A1A2E | Deep dark — primary text & borders |
| `danger` | #D96B5C | Terracotta — softer error |
| `success` | #5BAD7A | Muted sage — softer success |
| `warning` | #F39C12 | Warning / caution |

#### Mapped Tier (Theme-specific — these change per mode)

**Light Mode:**

| Token | Hex | Description |
|-------|-----|-------------|
| `bg` | #FFFDF5 | Cream background |
| `fg` | #3E3A44 | Graphite body text |
| `surface` | #FFFFFF | Card/panel white |
| `primary` | #FFE082 | Honey gold |
| `primary-fg` | #2D2A32 | Dark text on honey |
| `accent` | #B3D4F0 | Sky mid blue |
| `accent-fg` | #2D2A32 | Dark text on sky |
| `muted` | #F0EDED | Fog grey |
| `muted-fg` | #8B8589 | Slate text |
| `border` | #C9C5C2 | Warm ash border |
| `shadow-color` | #D9D5D2 | Shadow fill |
| `input` | #FFFFFF | Input bg |
| `ring` | #FFE082 | Focus ring (honey) |
| `destructive` | #C0503E | Deep terracotta |
| `success` | #5BAD7A | Muted sage |
| `warning` | #F39C12 | Warning |
| `button-bg` | #8B8589 | Slate default button |
| `button-fg` | #FFFFFF | White on slate |
| `button-border` | #8B8589 | Slate border |
| `outline-bg` | transparent | Outline variant |
| `outline-fg` | #2D2A32 | Dark outline text |
| `outline-border` | #8B8589 | Slate outline border |
| `card-primary-bg` | #FFF9C4 | Lemon card bg |
| `card-accent-bg` | #EAF4FB | Sky light card bg |
| `card-text` | #5E5965 | Muted card text |
| `th-bg` | #8B8589 | Table header bg |
| `th-fg` | #FFFFFF | Table header text |
| `badge-fg` | #2D2A32 | Badge text |
| `toggle-track` | #FFE082 | Honey track |
| `toggle-thumb` | #8B8589 | Slate thumb |

**Dark Mode:**

| Token | Hex | Description |
|-------|-----|-------------|
| `bg` | #1E1B22 | Warm charcoal |
| `fg` | #F7F5F3 | Cloud off-white |
| `surface` | #2A2630 | Lifted surface |
| `primary` | #D4A843 | Deep honey |
| `primary-fg` | #1E1B22 | Dark text on honey |
| `accent` | #3D5A80 | Navy blue |
| `accent-fg` | #F0EDED | Light text on navy |
| `muted` | #2A2630 | Matches surface |
| `muted-fg` | #8B8589 | Slate muted text |
| `border` | #5E5965 | Lighter border |
| `shadow-color` | #8B8589 | Slate shadow |
| `input` | #2A2630 | Surface input bg |
| `ring` | #D4A843 | Deep honey ring |
| `destructive` | #D4654F | Terracotta |
| `success` | #7BC89A | Meadow green |
| `warning` | #F1C40F | Bright yellow |
| `button-bg` | #FFFDF5 | Cream button |
| `button-fg` | #2D2A32 | Dark on cream |
| `button-border` | #FFFDF5 | Cream border |
| `outline-bg` | transparent | Outline variant |
| `outline-fg` | #F0EDED | Light outline text |
| `outline-border` | #8B8589 | Slate outline border |
| `card-primary-bg` | #4A3F20 | Dark honey card |
| `card-accent-bg` | #1E2D3D | Dark blue card |
| `card-text` | #D9D5D2 | Ash card text |
| `th-bg` | #3E3A44 | Graphite header |
| `th-fg` | #F0EDED | Light header text |
| `badge-fg` | #2D2A32 | Badge text |
| `toggle-track` | #C4983B | Muted honey |
| `toggle-thumb` | #D9D5D2 | Ash thumb |

### ✏️ Typography

#### Font Families

| Role | Font | CSS Variable |
|------|------|-------------|
| Display (all headings) | Libre Baskerville | `--seed-typography-fontFamily-display` |
| Body (default sans) | Switzer | `--seed-typography-fontFamily-sans` |
| Code | Roboto Mono | `--seed-typography-fontFamily-mono` |
| Caption / Pull quotes | Merriweather | `--seed-typography-fontFamily-caption` |

#### Type Scale (Major Third ratio: 1.25)

| Token | Size | Rem | Usage |
|-------|------|-----|-------|
| `xs` | ~10px | 0.64rem | Fine print |
| `sm` | ~13px | 0.8rem | Small / caption |
| `base` | 16px | 1rem | Body text |
| `md` | ~20px | 1.25rem | Title 3 / h6 |
| `lg` | ~25px | 1.563rem | Title 2 / h5 |
| `xl` | ~31px | 1.953rem | Title 1 / h4 |
| `2xl` | ~39px | 2.441rem | h3 |
| `3xl` | ~49px | 3.052rem | h2 |
| `4xl` | ~61px | 3.815rem | h1 |

#### Heading Styles (Libre Baskerville)

| Level | Size | Weight | Line Height |
|-------|------|--------|-------------|
| h1 | 3.815rem (~61px) | 700 (Bold) | 1.25 (tight) |
| h2 | 3.052rem (~49px) | 700 (Bold) | 1.25 (tight) |
| h3 | 2.441rem (~39px) | 600 (Semibold) | 1.25 (tight) |
| h4 | 1.953rem (~31px) | 600 (Semibold) | 1.5 (normal) |
| h5 | 1.563rem (~25px) | 500 (Medium) | 1.5 (normal) |
| h6 | 1.25rem (~20px) | 500 (Medium) | 1.5 (normal) |

#### Title Styles (Switzer — sans)

| Level | Size | Weight | Line Height |
|-------|------|--------|-------------|
| Title 1 | 1.953rem (~31px) | 600 (Semibold) | 1.5 |
| Title 2 | 1.563rem (~25px) | 500 (Medium) | 1.5 |
| Title 3 | 1.25rem (~20px) | 500 (Medium) | 1.5 |

#### Body Styles (Switzer)

| Variant | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Body Base | 1rem (16px) | 400 (Normal) | 1.5 |
| Body Small | 0.8rem (~13px) | 400 | 1.5 |
| Body Large | 1.25rem (~20px) | 400 | 1.75 (relaxed) |

### 📐 Spacing

4px base grid, 13 steps:

| Token | Value |
|-------|-------|
| `0` | 0 |
| `1` | 4px |
| `2` | 8px |
| `3` | 12px |
| `4` | 16px |
| `5` | 20px |
| `6` | 24px |
| `8` | 32px |
| `10` | 40px |
| `12` | 48px |
| `16` | 64px |
| `20` | 80px |
| `24` | 96px |

#### Semantic Spacing Aliases

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight gaps |
| `sm` | 8px | Small gaps |
| `md` | 16px | Default spacing |
| `lg` | 24px | Sections |
| `xl` | 32px | Large gaps |
| `2xl` | 48px | Major gaps |
| `section` | 96px | Between page sections |

### ✨ Effects

#### Hard Shadows (NO blur — neo-brutalist signature)

| Token | Offset | Usage |
|-------|--------|-------|
| `sm` | 2px 2px 0 0 | Subtle elevation |
| `md` | 4px 4px 0 0 | Default (cards, buttons) |
| `lg` | 6px 6px 0 0 | Emphasis |
| `xl` | 8px 8px 0 0 | Maximum elevation |

Shadow color changes per theme:
- Light: `#D9D5D2` (ash)
- Dark: `#8B8589` (slate)

#### Borders

| Property | Default Value | Description |
|----------|--------------|-------------|
| `border-width` | 3px | Thick — neo-brutalist default |
| `border-radius` | 0 (none) | Sharp corners by default |

Available radii: `none` (0), `sm` (4px), `md` (8px), `lg` (12px), `xl` (16px), `full` (9999px)

#### Motion

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `fast` | 0.05s | easeOutCirc | Micro-interactions |
| `base` | 0.2s | easeOut | Standard transitions |
| `bounce` | 0.3s | easeOutBack | Playful overshoot |
| `snap` | 0.12s | easeInOutCirc | Punchy mechanical |

### 📱 Breakpoints

| Token | Value | Description |
|-------|-------|-------------|
| `android` | 360px | Galaxy/Pixel base |
| `ios` | 390px | iPhone 16e |
| `tablet` | 768px | iPad Mini portrait |
| `desktop` | 1024px | Laptops / iPad Pro landscape |
| `wide` | 1440px | QHD+ displays |

### 📊 Grid

| Viewport | Columns | Gutter | Margin | Max Width |
|----------|---------|--------|--------|-----------|
| Android (360) | 4 | 16px | 16px | — |
| iOS (390) | 4 | 16px | 20px | — |
| Tablet (768) | 8 | 24px | 32px | — |
| Desktop (1024) | 12 | 24px | 40px | 1200px |
| Wide (1440) | 12 | 32px | 48px | 1400px |

---

## Components

### Button

**Variants:**
- `Primary` — Honey (#FFE082) bg, dark text, hard shadow
- `Accent` — Sky mid (#B3D4F0) bg, dark text, navy shadow in light mode
- `Outline` — Transparent bg, slate border, dark text
- `Ghost` — No border, transparent, text-only
- `Destructive` — Ember/terracotta bg, white text
- `Success` — Sage green bg, white text

**Sizes:** Small (sm), Medium (md), Large (lg)

**States:** Default, Hover (opacity: 0.85), Focus (honey ring), Disabled (opacity: 0.5)

**Key properties:**
- Border: 3px solid
- Border-radius: 0 (sharp corners)
- Shadow: 4px 4px 0 0 (hard, offset right+down)
- Font: Switzer 600 (semibold)

### Card

**Variants:**
- `Primary Card` — Lemon (#FFF9C4) bg in light, dark honey (#4A3F20) in dark
- `Accent Card` — Sky light (#EAF4FB) bg in light, dark blue (#1E2D3D) in dark

**Properties:**
- Border: 3px solid border color
- Shadow: 4px 4px 0 0
- Border-radius: 0

### Input

- Background: white (light) / surface (dark)
- Border: 3px solid border color
- Focus: 2px honey ring with 2px offset
- Border-radius: 0

### Badge

Pastel-colored labels with dark text. Uses individual pastel colors as backgrounds.

### Toggle

- Track: Honey (light) / muted honey (dark)
- Thumb: Slate (light) / ash (dark)

### Table

- Header: Slate bg with white text (light), graphite bg with light text (dark)
- Rows: Surface bg with border separators

---

## Figma Structure

### Recommended Page Organization

```
📄 Cover Page
🎨 Foundations
   ├── Colors (pastel swatches, neutrals, semantic pairs)
   ├── Typography (heading 1–6, title 1–3, body, caption, code)
   ├── Spacing (4px grid visualization)
   ├── Shadows (4 hard shadow levels)
   ├── Borders (widths + radii)
   └── Motion (easing curve references)
🧩 Components
   ├── Buttons (6 variants × 3 sizes × 4 states)
   ├── Inputs (text, search, textarea)
   ├── Cards (primary, accent)
   ├── Badges (pastel variants)
   ├── Toggle
   ├── Table
   └── Navigation (shell header, side drawer)
📐 Layout
   ├── Grid system (5 breakpoints)
   ├── Shell layout (header + drawer + window)
   └── Project page template
📖 Templates
   ├── Homepage
   ├── Project listing
   ├── Project detail (Behance-style sections)
   └── NDA gate page
```

### Variable Collections in Figma

**Collection 1: Seed** (1 mode: "Default")
- All 37 pastels, 11 neutrals, 4 semantic colors, spacing scale, etc.
- These are raw primitives — no theme switching

**Collection 2: Mapped** (2 modes: "Light", "Dark")
- All 30+ theme-specific tokens (bg, fg, surface, primary, accent, etc.)
- These switch between light and dark mode

**Collection 3: Alias** (1 mode: "Default")
- Semantic spacing (xs through section)
- Typography composites
- Grid values
- Border defaults
- Shadow defaults

---

## Token Architecture

### 3-Tier System

```
┌─────────────────────────────────────────┐
│  Tier 1: SEED (Primitives)              │
│  Raw values. No meaning.                │
│  pastel/honey → #FFE082                 │
│  neutral/500 → #78716C                  │
│  spacing/4 → 16px                       │
├─────────────────────────────────────────┤
│  Tier 2: ALIAS (Semantic)               │
│  Purpose-driven. Theme-independent.      │
│  primary → {seed.pastel.honey}          │
│  accent → {seed.pastel.skyMid}          │
│  spacing.md → {seed.spacing.4}          │
├─────────────────────────────────────────┤
│  Tier 3: MAPPED (Theme-specific)        │
│  Changes per mode (light/dark).          │
│  bg: light=#FFFDF5, dark=#1E1B22        │
│  primary: light=#FFE082, dark=#D4A843   │
│  accent: light=#B3D4F0, dark=#3D5A80    │
└─────────────────────────────────────────┘
```

### CSS Output

Seed → `--seed-*` custom properties (always same)
Alias → `--seed-*` references (always same)
Mapped → `:root` (light default) + `[data-theme="dark"]` overrides + `prefers-color-scheme` media query

---

**Built with 🍯 by Tushar Kant Naik**

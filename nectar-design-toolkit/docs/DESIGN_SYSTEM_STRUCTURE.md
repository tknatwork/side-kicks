# Nectar Design System - Token Architecture

**Version**: 2.0.0  
**Last Updated**: 2025-12-04  
**AI Model**: Claude Opus 4.5 (Preview)

---

## Overview

The **Nectar Design System** is a Gumroad-inspired design system featuring:
- Bold pink primary color (#FF90E8)
- Hard shadows (no blur)
- Thick borders (3px default)
- Clean, friendly typography
- High contrast, accessible design

### Current Stats (December 2025)

| Metric | Count |
|--------|-------|
| **Total Variables** | 1,027 |
| **Brand (Primitives)** | 68 |
| **Alias (Semantic)** | 353 |
| **Mapped (Component)** | 366 |
| **Breakpoints (Responsive)** | 240 |
| **Paint Styles** | 136 |
| **Text Styles** | 44 |
| **Effect Styles** | 5 |
| **Grid Styles** | 8 |

---

## Token Tiers

### Why 4 Tiers?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TOKEN HIERARCHY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TIER 1: BRAND (Primitives) - Single mode, HIDDEN                         │
│   └── Raw values: hex colors, pixel sizes, font names                      │
│   └── Example: pink/500 = #FF90E8, spacing/4 = 16px                        │
│   └── RULE: Never use directly in code or components                       │
│                                                                             │
│                         ▼ References                                        │
│                                                                             │
│   TIER 2: ALIAS (Semantic) - Single mode, HIDDEN                           │
│   └── Purpose-based semantic tokens (mobile-first base values)             │
│   └── Example: background/primary = {pink/500}, fg/default = {black/pure}  │
│   └── RULE: Referenced by Mapped layer, not used directly                  │
│                                                                             │
│                         ▼ Applied to                                        │
│                                                                             │
│   TIER 3.1: MAPPED (Color Components) - Light/Dark modes, PUBLISHED        │
│   ├── 141 variables: 136 COLOR tokens + 5 STRING (motion easings)          │
│   ├── Theme-aware component tokens for colors                              │
│   ├── Example: button/primary/fill = {alias/accent} per Light/Dark mode    │
│   └── RULE: Use these for theming - bind to fills, strokes, effects        │
│                                                                             │
│   TIER 3.2: BREAKPOINTS (Responsive) - Desktop/Tablet/Mobile, PUBLISHED    │
│   ├── 385 variables: All FLOAT (typography, spacing, sizing)               │
│   ├── Responsive values that change per breakpoint                         │
│   ├── Example: typescale/display/xl = 72px (Desktop) / 48px (Mobile)       │
│   └── RULE: Use these for responsive design - bind to text, dimensions     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Collection Summary

| Collection | Variables | Modes | Visibility | Purpose |
|------------|-----------|-------|------------|---------|
| **Brand** | 68 | 1 (default) | 🔒 Hidden | Primitive values |
| **Alias** | ~300 | 1 (Mode 1) | 🔒 Hidden | Semantic tokens |
| **Mapped** | 141 | 2 (Light/Dark) | ✅ Published | Color theming |
| **Breakpoints** | 385 | 3 (Desktop/Tablet/Mobile) | ✅ Published | Responsive values |

---

## Color Palette

### Primary Colors (Pink Scale)

| Token | Hex | Usage |
|-------|-----|-------|
| `pink-50` | #FFF5FB | Background highlights |
| `pink-100` | #FFE5F5 | Light backgrounds |
| `pink-200` | #FFD4F0 | Hover states (light) |
| `pink-300` | #FFC0E9 | Borders (light) |
| `pink-400` | #FFA8E0 | Hover states |
| `pink-500` | #FF90E8 | **Primary brand color** |
| `pink-600` | #E57FD0 | Active states |
| `pink-700` | #CC6FB9 | Dark accent |
| `pink-800` | #B25FA1 | Dark backgrounds |
| `pink-900` | #994F8A | Darkest pink |

### Neutral Colors (Black Scale)

| Token | Hex | Usage |
|-------|-----|-------|
| `black-pure` | #000000 | Text, borders, shadows |
| `black-900` | #1A1A1A | Dark mode background |
| `black-800` | #2D2D2D | Dark mode surfaces |
| `black-700` | #404040 | Dark mode cards |
| `black-600` | #525252 | Dark secondary text |
| `black-500` | #666666 | Light secondary text |
| `black-400` | #7A7A7A | Tertiary text |
| `black-300` | #8F8F8F | Disabled states |
| `black-200` | #A3A3A3 | Light borders |
| `black-100` | #B8B8B8 | Lightest gray |

### White Scale

| Token | Hex | Usage |
|-------|-----|-------|
| `white-pure` | #FFFFFF | Pure white |
| `white-cream` | #FEFEFE | Light mode background |
| `white-off` | #FAFAFA | Light mode surfaces |

### Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `yellow` | #FFC900 | Highlights, warnings |
| `cyan` | #23A094 | Links (alt), success |
| `blue` | #36B3FF | Information, links |
| `green` | #4DDE80 | Success states |
| `orange` | #FF6B35 | Attention, CTAs |
| `purple` | #9055FF | Special features |
| `red` | #FF4444 | Errors, destructive |

---

## Semantic Tokens (Alias Layer)

### Background Colors

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| `background-primary` | white-cream | black-900 |
| `background-secondary` | white-off | black-800 |
| `background-tertiary` | white-pure | black-700 |
| `background-accent` | pink-100 | pink-900 |
| `background-inverse` | black-pure | white-pure |

### Text Colors

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| `text-primary` | black-pure | white-pure |
| `text-secondary` | black-500 | black-300 |
| `text-tertiary` | black-400 | black-400 |
| `text-accent` | pink-500 | pink-400 |
| `text-inverse` | white-pure | black-pure |
| `text-link` | pink-600 | pink-400 |
| `text-link-hover` | pink-700 | pink-300 |

### Border Colors

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| `border-primary` | black-pure | white-pure |
| `border-secondary` | black-200 | black-600 |
| `border-accent` | pink-500 | pink-500 |

### Interactive Colors

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| `interactive-primary` | pink-500 | pink-500 |
| `interactive-primary-hover` | pink-400 | pink-400 |
| `interactive-primary-active` | pink-600 | pink-600 |
| `interactive-secondary` | black-pure | white-pure |
| `interactive-secondary-hover` | black-800 | white-off |

### Status Colors (Same for both modes)

| Token | Value |
|-------|-------|
| `status-success` | green (#4DDE80) |
| `status-warning` | yellow (#FFC900) |
| `status-error` | red (#FF4444) |
| `status-info` | blue (#36B3FF) |

---

## Typography

### Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `font-sans` | Switzer | Body text, UI, headings |
| `font-serif` | Merriweather | Quote styles |
| `font-mono` | JetBrains Mono | Code blocks |
| `font-display` | Switzer | Display headings |

### Font Sizes (px)

| Token | Size | Usage |
|-------|------|-------|
| `font-xs` | 12 | Captions, labels |
| `font-sm` | 14 | Small body text |
| `font-base` | 16 | Body text |
| `font-lg` | 18 | Large body |
| `font-xl` | 20 | H6, emphasis |
| `font-2xl` | 24 | H5 |
| `font-3xl` | 30 | H4 |
| `font-4xl` | 36 | H3 |
| `font-5xl` | 48 | H2 |
| `font-6xl` | 60 | H1 |
| `font-7xl` | 72 | Display |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `font-regular` | 400 | Body text |
| `font-medium` | 500 | Emphasis |
| `font-semibold` | 600 | Subheadings |
| `font-bold` | 700 | Headings |
| `font-extrabold` | 800 | Display |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `leading-tight` | 1.1 | Headings |
| `leading-snug` | 1.25 | Subheadings |
| `leading-normal` | 1.5 | Body text |
| `leading-relaxed` | 1.625 | Long form |
| `leading-loose` | 2 | Spacious |

---

## Spacing (4px Base Grid)

| Token | Value (px) | Usage |
|-------|------------|-------|
| `space-0` | 0 | None |
| `space-1` | 4 | Tight |
| `space-2` | 8 | Extra small |
| `space-3` | 12 | Small |
| `space-4` | 16 | Medium |
| `space-5` | 20 | Medium+ |
| `space-6` | 24 | Large |
| `space-8` | 32 | XL |
| `space-10` | 40 | XXL |
| `space-12` | 48 | Section |
| `space-16` | 64 | Large section |
| `space-20` | 80 | XL section |
| `space-24` | 96 | XXL section |
| `space-32` | 128 | Huge |

---

## Border Radius

| Token | Value (px) | Usage |
|-------|------------|-------|
| `radius-none` | 0 | Sharp corners |
| `radius-sm` | 4 | Subtle rounding |
| `radius-md` | 8 | Default |
| `radius-lg` | 12 | Cards |
| `radius-xl` | 16 | Large cards |
| `radius-2xl` | 24 | Modals |
| `radius-full` | 9999 | Pills, avatars |

---

## Border Width

| Token | Value (px) | Usage |
|-------|------------|-------|
| `border-none` | 0 | No border |
| `border-thin` | 1 | Subtle |
| `border-medium` | 2 | Default |
| `border-thick` | 3 | **Primary (Gumroad)** |
| `border-heavy` | 4 | Emphasis |

---

## Shadows (Gumroad Hard Style)

All shadows use `blur: 0` for hard edge effect.

| Token | Offset | Usage |
|-------|--------|-------|
| `shadow-none` | 0, 0 | No shadow |
| `shadow-hard-sm` | 2, 2 | Subtle depth |
| `shadow-hard-md` | 4, 4 | **Default** |
| `shadow-hard-lg` | 6, 6 | Cards |
| `shadow-hard-xl` | 8, 8 | Modals |
| `shadow-hover` | 6, 6 | Hover state |
| `shadow-active` | 2, 2 | Pressed state |

### Shadow Animation Pattern

```css
/* Default state */
.element {
  box-shadow: 4px 4px 0 var(--color-shadow);
  transform: translate(0, 0);
}

/* Hover - shadow grows, element lifts */
.element:hover {
  box-shadow: 6px 6px 0 var(--color-shadow);
  transform: translate(-2px, -2px);
}

/* Active - shadow shrinks, element presses */
.element:active {
  box-shadow: 2px 2px 0 var(--color-shadow);
  transform: translate(2px, 2px);
}
```

---

## Animation

### Durations

| Token | Value | Usage |
|-------|-------|-------|
| `duration-instant` | 0ms | Immediate |
| `duration-fast` | 100ms | Micro-interactions |
| `duration-normal` | 200ms | Default |
| `duration-slow` | 300ms | Larger transitions |
| `duration-slower` | 500ms | Page transitions |

### Easing

| Token | Value | Usage |
|-------|-------|-------|
| `ease-linear` | linear | Constant speed |
| `ease-in` | cubic-bezier(0.4, 0, 1, 1) | Accelerate |
| `ease-out` | cubic-bezier(0, 0, 0.2, 1) | Decelerate |
| `ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | Default |
| `ease-bounce` | cubic-bezier(0.68, -0.55, 0.265, 1.55) | Playful |

---

## Responsive Breakpoints

| Token | Value | Grid Columns |
|-------|-------|--------------|
| `breakpoint-mobile` | 375px | 4 columns |
| `breakpoint-tablet` | 768px | 8 columns |
| `breakpoint-laptop` | 1024px | 12 columns |
| `breakpoint-desktop` | 1440px | 12 columns |

### Container Widths

| Breakpoint | Max Width | Padding |
|------------|-----------|---------|
| Mobile | 100% | 16px |
| Tablet | 720px | 32px |
| Laptop | 960px | 48px |
| Desktop | 1200px | 64px |

---

## Component Library

### Overview

The Nectar component library follows atomic design principles, organized into three levels:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            COMPONENT HIERARCHY                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ATOMS (Foundational)                                                      │
│   └── Basic building blocks: buttons, inputs, badges                        │
│   └── Single responsibility components                                      │
│   └── Styled with alias/mapped variables                                    │
│                                                                             │
│                         ▼ Composed into                                     │
│                                                                             │
│   MOLECULES (Composite)                                                     │
│   └── Combinations of atoms: form fields, alerts, toasts                   │
│   └── Reusable patterns across the system                                  │
│                                                                             │
│                         ▼ Assembled into                                    │
│                                                                             │
│   ORGANISMS (Complex)                                                       │
│   └── Full sections: cards, navigation, modals                             │
│   └── Page-level components                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### ATOMS (~14 components)

| Component | Variants | Properties |
|-----------|----------|------------|
| **Button/Primary** | Default | Pink fill, black border, shadow |
| **Button/Secondary** | Default | White fill, black border, shadow |
| **Button/Outline** | Default | Transparent, pink border |
| **Button/Ghost** | Default | Transparent, text only |
| **Input/Default** | Default | White fill, black border, thick |
| **Input/Focused** | Focused | Pink border highlight |
| **Input/Error** | Error | Red border, error state |
| **Badge/Pink** | Pink | Filled pink pill |
| **Badge/Black** | Black | Filled black pill |
| **Badge/Outline** | Outline | Bordered pill |
| **Toggle** | On/Off | Pill toggle with knob |
| **Checkbox** | Checked/Unchecked | Square with checkmark |
| **Radio** | Selected/Unselected | Circle with dot |
| **Link** | Default/Hover | Pink text link |

#### Button Anatomy
```
┌─────────────────────────────────────┐
│                                     │  ← radius-md (8px)
│          Button Text                │  ← font-medium, 16px
│                                     │  ← padding: 12px 24px
└─────────────────────────────────────┘
     │
     └── shadow-hard-md (4px 4px)
```

---

### MOLECULES (~12 components)

| Component | Description | Contains |
|-----------|-------------|----------|
| **FormField** | Input with label | Label + Input/Default |
| **Alert/Success** | Success message | Icon + text + dismiss |
| **Alert/Warning** | Warning message | Yellow background |
| **Alert/Error** | Error message | Red background |
| **Alert/Info** | Info message | Blue background |
| **Toast** | Notification popup | Icon + message + close |
| **Tab/Active** | Active tab item | Pink underline |
| **Tab/Default** | Inactive tab item | Gray text |
| **TabBar** | Tab container | Multiple Tab items |
| **Dropdown** | Select menu | Input + chevron + options |
| **SearchField** | Search input | Icon + input |
| **ProgressBar** | Progress indicator | Track + fill |

#### FormField Anatomy
```
Label Text                ← font-sm, font-medium
┌─────────────────────────────────────┐
│ Placeholder text...                 │  ← Input component
└─────────────────────────────────────┘
Helper text goes here     ← font-sm, text-secondary
```

---

### ORGANISMS (~14 components)

| Component | Description | Contains |
|-----------|-------------|----------|
| **Card/Product** | Product display | Image + title + price + button |
| **Card/Profile** | User profile | Avatar + name + bio + action |
| **Card/Pricing/Basic** | Pricing tier | Title + price + features + CTA |
| **Card/Pricing/Pro** | Featured tier | Pink highlight, shadow-lg |
| **Card/Pricing/Enterprise** | Custom tier | Contact CTA |
| **Avatar/Small** | 32px avatar | Circle with image/initial |
| **Avatar/Medium** | 48px avatar | Circle with image/initial |
| **Avatar/Large** | 64px avatar | Circle with image/initial |
| **UserRow** | User list item | Avatar + name + action |
| **NavItem** | Navigation link | Icon + text |
| **Navbar** | Top navigation | Logo + NavItems + CTA |
| **Modal** | Dialog overlay | Header + content + actions |
| **Footer** | Page footer | Links + social + copyright |
| **Hero** | Hero section | Heading + subtext + CTAs |

#### Card/Product Anatomy
```
┌─────────────────────────────────────┐
│  ┌─────────────────────────────┐   │
│  │                             │   │  ← Image area (200px)
│  │         PRODUCT             │   │
│  │          IMAGE              │   │
│  └─────────────────────────────┘   │
│                                     │
│  Product Title                      │  ← font-lg, font-bold
│  Brief description here             │  ← font-sm, text-secondary
│                                     │
│  $49.00                             │  ← font-xl, pink-500
│                                     │
│  ┌─────────────────────────────┐   │
│  │       Buy Now               │   │  ← Button/Primary
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
     │
     └── shadow-hard-lg (6px 6px)
```

#### Pricing Card Anatomy
```
┌─────────────────────────────────────┐
│           PLAN NAME                 │  ← font-2xl, font-bold
│                                     │
│            $XX                      │  ← font-5xl, pink-500
│           /month                    │  ← font-sm, text-secondary
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ✓ Feature one                      │
│  ✓ Feature two                      │  ← Checklist items
│  ✓ Feature three                    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │     Get Started             │   │  ← Button/Primary
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

### Component Styling Rules

#### 1. Borders
```css
/* Primary components (buttons, cards, inputs) */
border-width: 3px;      /* border-thick */
border-color: #000000;  /* black-pure */
border-style: solid;
```

#### 2. Shadows
```css
/* Default state */
box-shadow: 4px 4px 0 #000000;   /* shadow-hard-md */

/* Hover state */
box-shadow: 6px 6px 0 #000000;   /* shadow-hard-lg */
transform: translate(-2px, -2px);

/* Active state */
box-shadow: 2px 2px 0 #000000;   /* shadow-hard-sm */
transform: translate(2px, 2px);
```

#### 3. Border Radius
```css
/* Buttons, inputs, cards */
border-radius: 8px;     /* radius-md */

/* Badges, pills, avatars */
border-radius: 9999px;  /* radius-full */
```

#### 4. Typography in Components
```css
/* Button text */
font-family: Switzer;
font-size: 16px;        /* font-base */
font-weight: 500;       /* font-medium */

/* Card title */
font-family: Switzer;
font-size: 18px;        /* font-lg */
font-weight: 700;       /* font-bold */
```

---

### Variable Binding

Components use the mapped variable layer:

| Component Part | Variable Collection | Example |
|----------------|---------------------|---------|
| Button fill | Mapped/Button | button/primary/fill |
| Button text | Mapped/Button | button/primary/text |
| Button border | Mapped/Button | button/border |
| Card background | Mapped/Card | card/background |
| Card border | Mapped/Card | card/border |
| Input fill | Mapped/Input | input/background |
| Input border | Mapped/Input | input/border-default |

---

## Figma Styles

### Color Styles (37 total)

| Category | Styles |
|----------|--------|
| **Primary** | Pink/500 (Primary), Pink/400, Pink/600, Pink/100, Pink/800 |
| **Neutral** | Black/Pure, Black/900, Black/700, Black/500, Black/300 |
| **White** | White/Pure, White/Cream, White/Off |
| **Accent** | Yellow, Cyan, Blue, Green, Orange, Purple, Red |
| **Semantic** | Background/Primary, Background/Secondary, Text/Primary, etc. |
| **Status** | Success, Warning, Error, Info |

### Text Styles (29 total)

| Category | Styles |
|----------|--------|
| **Display** | Display/XL, Display/LG, Display/MD |
| **Heading** | H1, H2, H3, H4, H5, H6 |
| **Body** | Body/LG, Body/MD, Body/SM |
| **UI** | Label/LG, Label/MD, Label/SM |
| **Special** | Button, Link, Code, Caption |

### Effect Styles (18 total)

| Category | Styles |
|----------|--------|
| **Hard Shadows** | Shadow/Hard/SM, Shadow/Hard/MD, Shadow/Hard/LG, Shadow/Hard/XL |
| **Colored Shadows** | Shadow/Pink/MD, Shadow/Pink/LG |
| **Interactive** | Shadow/Hover, Shadow/Active |
| **Soft Shadows** | Shadow/Soft/SM, Shadow/Soft/MD, Shadow/Soft/LG |
| **Inner Shadows** | Shadow/Inner/SM, Shadow/Inner/MD |
| **Glow Effects** | Glow/Pink, Glow/White |

---

## Usage Rules

### DO ✅

- Use Alias tokens in component styles
- Use Component tokens for component-specific values
- Reference Brand tokens only through Alias layer
- Test both Light and Dark modes
- Maintain consistent spacing using the scale
- Use atomic design structure (Atoms → Molecules → Organisms)
- Bind variables to component fills and strokes
- Apply text styles consistently

### DON'T ❌

- Never hardcode hex values in CSS
- Never use Brand tokens directly in components
- Never create one-off spacing values
- Never skip the token system for "quick fixes"
- Never create components without proper variable binding
- Never ignore the established component patterns

---

## Quick Reference

### Component Creation Checklist

1. ☐ Name follows convention: `Category/Name/Variant`
2. ☐ Uses proper spacing tokens
3. ☐ Has 3px thick black border (if applicable)
4. ☐ Has hard shadow (no blur)
5. ☐ Uses Inter font family
6. ☐ Border radius from token scale
7. ☐ Fills bound to mapped variables
8. ☐ Strokes bound to mapped variables
9. ☐ Auto-layout properly configured
10. ☐ Constraints set for responsiveness

---

*Nectar Design System - Created by Claude Opus 4.5 (Preview)*
*Components built following Gumroad's aesthetic principles*

# Design System Master File

> **Authority (Phase E3):** Design brief / export only for workspace `theme/tokens.css`. Build authority is `packages/design-tokens/dtcg/workspaces/denali.tokens.json` → `theme/tokens.css` (`@generated`). Full Denali brand palette remains in skin files until E4 skin DTCG migration.

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Denali Club
**Generated:** 2026-06-30 03:35:19
**Category:** Mountain / outdoor tour club (public marketing)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#059669` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#10B981` | `--color-secondary` |
| Accent/CTA | `#D97706` | `--color-accent` |
| Background | `#ECFDF5` | `--color-background` |
| Foreground | `#0F172A` | `--color-foreground` |
| Muted | `#F0F8F6` | `--color-muted` |
| Border | `#E1F2ED` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#059669` | `--color-ring` |

**Color Notes:** Fresh green + food amber

### Typography

- **Heading Font:** Calistoga
- **Body Font:** Inter
- **Mood:** saas, boutique, electric, warm, editorial, bold, premium, fintech, business, dual font, human warmth
- **Google Fonts:** [Calistoga + Inter](https://fonts.googleapis.com/css2?family=Calistoga:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Calistoga:ital@0;1&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
```

**Marketing implementation:** `apps/marketing` loads Calistoga via `next/font/google` (`--font-heading-en`); Denali catalog headings use `--font-heading` in `packages/workspaces/denali/theme/marketing/`.

**Portal implementation:** `apps/portal` loads Calistoga the same way; registration headings use `--font-heading` in `packages/workspaces/denali/theme/denali-portal.css`.

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `0.25rem` | Tight gaps |
| `--space-sm` | `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `1rem` | Standard padding |
| `--space-lg` | `1.5rem` | Section padding |
| `--space-xl` | `2rem` | Large gaps |
| `--space-2xl` | `3rem` | Section margins |
| `--space-3xl` | `4rem` | Hero padding |

**Unit policy:** spacing, typography, radius, and elevation use **`rem`** (via `@app-tour/design-tokens` `--space-*` or skin `--mkt-*` tokens). Use **`px` only** for `--border-width-default` (1px hairlines) and `--layout-min-tap-target` (44px a11y). Breakpoints stay in `px` (`640`, `1024`).

Denali marketing skin tokens: `--mkt-text-*`, `--mkt-radius-*`, `--mkt-shadow-*`, `--mkt-lift-*` in `packages/workspaces/denali/theme/marketing/tokens.css`.

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 0.0625rem 0.125rem rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 0.25rem 0.375rem rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 0.625rem 0.9375rem rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 1.25rem 1.5625rem rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #D97706;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #059669;
  border: 2px solid #059669;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #ECFDF5;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #059669;
  outline: none;
  box-shadow: 0 0 0 3px #05966920;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Vibrant & Block-based

**Keywords:** Bold, energetic, playful, block layout, geometric shapes, high color contrast, duotone, modern, energetic

**Best For:** Startups, creative agencies, gaming, social media, youth-focused, entertainment, consumer

**Key Effects:** Large sections (48px+ gaps), animated patterns, bold hover (color shift), scroll-snap, large type (32px+), 200-300ms

### Page Pattern

**Pattern Name:** Bento Grid Showcase

- **Conversion Strategy:** Scannable value props. High information density without clutter. Mobile stack.
- **CTA Placement:** Floating Action Button or Bottom of Grid
- **Section Order:** 1. Hero, 2. Bento Grid (Key Features), 3. Detail Cards, 4. Tech Specs, 5. CTA

---

## Anti-Patterns (Do NOT Use)

- ❌ Outdated photos
- ❌ Confusing layout

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

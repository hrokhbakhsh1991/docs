# Design System v1 — Production Guide

Document-ID: MKT-DOC-DESIGN-SYSTEM-V1  
Version: v1.1  
Status: Active (implementation guide)  
Owner: Product / Frontend  
Last-Updated: 2026-05-02  
Language: English  
Canonical references: `docs/10-product/ux_principles.md`, `docs/10-product/screen_state_spec_v2.md`, `docs/runtime-lifecycle.md`, `docs/20-architecture/contracts/error_response_taxonomy_v2.md`, `docs/10-product/form_validation_ux_contract_v2.md`

---

## Table of contents

1. [Introduction](#1-introduction)  
2. [Design principles](#2-design-principles)  
3. [Color system](#3-color-system-full-token-reference)  
4. [Typography](#4-typography-scale-rem)  
5. [Spacing & layout](#5-spacing--layout-4px--8px-grid)  
6. [Radii & shadows](#6-radii--shadows-exact-tokens)  
7. [Web components](#7-web-components-pseudo-code--css)  
8. [Telegram Mini App patterns](#8-telegram-mini-app--functional-mapping)  
9. [Validation & errors](#9-validation--errors-cross-reference)  
10. [Extensibility](#10-extensibility-rules--checklist)  
11. [Example: standard form](#11-example-standard-form-using-tokens)

---

## 1. Introduction

### 1.1 Purpose

This document is the **authoritative visual and interaction specification** for tour-operations UIs. It defines **design tokens** as **CSS custom properties**, component anatomy, and cross-channel rules for:

- **Web:** `apps/web` (Next.js 14 App Router)
- **Telegram Mini App:** `apps/telegram` (React / WebView)

### 1.2 Non-goals

- No Tailwind or utility-first framework is assumed; tokens are **vanilla CSS** (compatible with CSS Modules, SCSS that emits `:root` rules, or a thin typed token layer).
- Custom webfonts are **out of scope for v1**; use the system stack.

### 1.3 How to implement

1. Add a single **`tokens.css`** (or SCSS partial `_tokens.scss` compiled to CSS) imported from the app root layout.
2. Apply **`.theme-dark`** on `<html>` or a root wrapper when dark mode is selected.
3. Build components using **semantic** variables only (e.g. `var(--color-text-primary)`), never raw hex inside feature components.

---

## 2. Design principles

Condensed from `docs/10-product/ux_principles.md` and operational specs:

| Principle | Implementation implication |
|-----------|-----------------------------|
| **Operational clarity** | Every critical mutation shows **loading → outcome**; dashboards use **dense but scannable** typography and status chips. |
| **Status-driven UX** | Registration, payment, and waitlist backend enums are **visible labels**, not inferred from prose alone (`runtime-lifecycle.md`). |
| **Tenant safety** | Tenant/workspace context is visible where ambiguity exists; destructive actions use **danger** tokens + confirmation. |
| **Dual-mode consistency** | Web and Telegram share **semantic roles** (primary CTA, danger, success); layout adapts to channel constraints (`telegram_integration.md`). |
| **Mobile-first** | Touch targets ≥ **44×44px** where platform allows; forms stay single-column on narrow viewports. |

---

## 3. Color system — full token reference

All listed variables MUST exist in the global stylesheet. **Light** values live on `:root`. **Dark** values override the same names under `.theme-dark`.

### 3.1 Naming convention

- `--color-*` — paints (fills, strokes, text)
- `--focus-*` — accessibility focus ring
- `--overlay-*` — scrims for modals / drawers

### 3.2 Light mode (`:root`)

| CSS variable | HEX | Role |
|--------------|-----|------|
| `--color-primary` | `#1e5a8e` | Primary brand / main CTA background |
| `--color-primary-hover` | `#174a73` | Primary hover |
| `--color-primary-active` | `#133d5c` | Primary pressed |
| `--color-primary-fg` | `#ffffff` | Text/icon on primary button |
| `--color-secondary` | `#3d7ea6` | Secondary accents, links on muted bg |
| `--color-secondary-hover` | `#326889` | Secondary hover |
| `--color-secondary-fg` | `#ffffff` | Text on secondary-filled buttons (if used) |
| `--color-bg-page` | `#f6f7f9` | Application page background |
| `--color-bg-surface` | `#ffffff` | Cards, panels, default input background |
| `--color-bg-surface-hover` | `#f1f3f6` | Hover state for selectable rows/cards |
| `--color-bg-muted` | `#eef1f4` | Muted bands, table header, chip neutral bg |
| `--color-bg-disabled` | `#e4e7eb` | Disabled input/button fill |
| `--color-bg-inverse` | `#1a1f26` | Tooltip/popover dark bubble (optional) |
| `--color-text-primary` | `#1a1f26` | Primary body and headings |
| `--color-text-secondary` | `#5c6570` | Secondary descriptions |
| `--color-text-muted` | `#8a939e` | Placeholder, captions, disabled text |
| `--color-text-inverse` | `#ffffff` | Text on inverse surfaces |
| `--color-text-link` | `#1e5a8e` | Inline links |
| `--color-text-link-hover` | `#174a73` | Link hover |
| `--color-border-default` | `#d8dde3` | Input/card default border |
| `--color-border-strong` | `#b8c0ca` | Dividers, table lines |
| `--color-border-subtle` | `#e8ebef` | Hairline separators |
| `--color-success` | `#1f7a4d` | Success icon/text emphasis |
| `--color-success-bg` | `#e6f4ec` | Success alert/chip background |
| `--color-success-border` | `#8fceaa` | Success bordered elements |
| `--color-warning` | `#b35900` | Warning icon/text |
| `--color-warning-bg` | `#fff4e5` | Warning alert/chip background |
| `--color-warning-border` | `#f0c070` | Warning border |
| `--color-danger` | `#c5222d` | Error/destructive emphasis |
| `--color-danger-bg` | `#fcebec` | Danger alert/chip background |
| `--color-danger-border` | `#f09aa1` | Danger border |
| `--color-info` | `#1e5a8e` | Info (aligned with primary) |
| `--color-info-bg` | `#e8f1f8` | Info alert background |
| `--color-info-border` | `#9ebdd9` | Info border |
| `--color-overlay-scrim` | `rgba(15, 18, 22, 0.55)` | Modal/drawer backdrop |
| `--focus-ring-color` | `rgba(30, 90, 142, 0.35)` | Focus ring (keyboard) |
| `--focus-ring-offset` | `#ffffff` | Focus ring contrast cushion |

### 3.3 Dark mode (`.theme-dark`)

Override **every** semantic token below so components need no branching logic.

| CSS variable | HEX | Role |
|--------------|-----|------|
| `--color-primary` | `#5b9fd4` | Primary (lighter for contrast on dark) |
| `--color-primary-hover` | `#7eb3df` | Primary hover |
| `--color-primary-active` | `#4a8fc4` | Primary pressed |
| `--color-primary-fg` | `#0d1117` | Text on primary (dark-friendly) |
| `--color-secondary` | `#7eb3df` | Secondary accent |
| `--color-secondary-hover` | `#9dc6e8` | Secondary hover |
| `--color-secondary-fg` | `#0d1117` | On secondary fill |
| `--color-bg-page` | `#0d1117` | Page |
| `--color-bg-surface` | `#161b22` | Cards/panels |
| `--color-bg-surface-hover` | `#1f2630` | Hover |
| `--color-bg-muted` | `#21262d` | Muted |
| `--color-bg-disabled` | `#30363d` | Disabled |
| `--color-bg-inverse` | `#f6f7f9` | Inverse bubble bg |
| `--color-text-primary` | `#e8eaed` | Primary text |
| `--color-text-secondary` | `#aeb4bd` | Secondary |
| `--color-text-muted` | `#7e8793` | Muted |
| `--color-text-inverse` | `#1a1f26` | Text on inverse |
| `--color-text-link` | `#7eb3df` | Links |
| `--color-text-link-hover` | `#a8cff0` | Link hover |
| `--color-border-default` | `#30363d` | Default border |
| `--color-border-strong` | `#484f58` | Strong |
| `--color-border-subtle` | `#21262d` | Hairline |
| `--color-success` | `#56d364` | Success text/icon |
| `--color-success-bg` | `rgba(46, 160, 67, 0.18)` | Success bg |
| `--color-success-border` | `#388e3c` | Border |
| `--color-warning` | `#e3b341` | Warning |
| `--color-warning-bg` | `rgba(227, 179, 65, 0.15)` | Warning bg |
| `--color-warning-border` | `#c69026` | Border |
| `--color-danger` | `#ff7b72` | Danger |
| `--color-danger-bg` | `rgba(248, 81, 73, 0.15)` | Danger bg |
| `--color-danger-border` | `#da3633` | Border |
| `--color-info` | `#79c0ff` | Info |
| `--color-info-bg` | `rgba(121, 192, 255, 0.12)` | Info bg |
| `--color-info-border` | `#388bfd` | Border |
| `--color-overlay-scrim` | `rgba(1, 4, 9, 0.72)` | Scrim |
| `--focus-ring-color` | `rgba(130, 175, 220, 0.55)` | Focus |
| `--focus-ring-offset` | `#161b22` | Offset matches surface |

### 3.4 Complete `:root` block (light) — copy-paste starter

```css
:root {
  /* Brand */
  --color-primary: #1e5a8e;
  --color-primary-hover: #174a73;
  --color-primary-active: #133d5c;
  --color-primary-fg: #ffffff;
  --color-secondary: #3d7ea6;
  --color-secondary-hover: #326889;
  --color-secondary-fg: #ffffff;

  /* Surfaces */
  --color-bg-page: #f6f7f9;
  --color-bg-surface: #ffffff;
  --color-bg-surface-hover: #f1f3f6;
  --color-bg-muted: #eef1f4;
  --color-bg-disabled: #e4e7eb;
  --color-bg-inverse: #1a1f26;

  /* Text */
  --color-text-primary: #1a1f26;
  --color-text-secondary: #5c6570;
  --color-text-muted: #8a939e;
  --color-text-inverse: #ffffff;
  --color-text-link: #1e5a8e;
  --color-text-link-hover: #174a73;

  /* Borders */
  --color-border-default: #d8dde3;
  --color-border-strong: #b8c0ca;
  --color-border-subtle: #e8ebef;

  /* Semantic */
  --color-success: #1f7a4d;
  --color-success-bg: #e6f4ec;
  --color-success-border: #8fceaa;
  --color-warning: #b35900;
  --color-warning-bg: #fff4e5;
  --color-warning-border: #f0c070;
  --color-danger: #c5222d;
  --color-danger-bg: #fcebec;
  --color-danger-border: #f09aa1;
  --color-info: #1e5a8e;
  --color-info-bg: #e8f1f8;
  --color-info-border: #9ebdd9;

  --color-overlay-scrim: rgba(15, 18, 22, 0.55);
  --focus-ring-color: rgba(30, 90, 142, 0.35);
  --focus-ring-offset: #ffffff;

  color-scheme: light;
}
```

### 3.5 Complete `.theme-dark` block — copy-paste starter

```css
.theme-dark {
  --color-primary: #5b9fd4;
  --color-primary-hover: #7eb3df;
  --color-primary-active: #4a8fc4;
  --color-primary-fg: #0d1117;
  --color-secondary: #7eb3df;
  --color-secondary-hover: #9dc6e8;
  --color-secondary-fg: #0d1117;

  --color-bg-page: #0d1117;
  --color-bg-surface: #161b22;
  --color-bg-surface-hover: #1f2630;
  --color-bg-muted: #21262d;
  --color-bg-disabled: #30363d;
  --color-bg-inverse: #f6f7f9;

  --color-text-primary: #e8eaed;
  --color-text-secondary: #aeb4bd;
  --color-text-muted: #7e8793;
  --color-text-inverse: #1a1f26;
  --color-text-link: #7eb3df;
  --color-text-link-hover: #a8cff0;

  --color-border-default: #30363d;
  --color-border-strong: #484f58;
  --color-border-subtle: #21262d;

  --color-success: #56d364;
  --color-success-bg: rgba(46, 160, 67, 0.18);
  --color-success-border: #388e3c;
  --color-warning: #e3b341;
  --color-warning-bg: rgba(227, 179, 65, 0.15);
  --color-warning-border: #c69026;
  --color-danger: #ff7b72;
  --color-danger-bg: rgba(248, 81, 73, 0.15);
  --color-danger-border: #da3633;
  --color-info: #79c0ff;
  --color-info-bg: rgba(121, 192, 255, 0.12);
  --color-info-border: #388bfd;

  --color-overlay-scrim: rgba(1, 4, 9, 0.72);
  --focus-ring-color: rgba(130, 175, 220, 0.55);
  --focus-ring-offset: #161b22;

  color-scheme: dark;
}
```

---

## 4. Typography scale (rem)

### 4.1 Font stack

```css
:root {
  --font-family-base: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-family-mono: ui-monospace, "SF Mono", Consolas, monospace;
}
```

### 4.2 Type tokens

All sizes use **rem** (root 16px unless changed).

| Token | font-size | font-weight | line-height | Letter-spacing | Usage |
|-------|-----------|-------------|-------------|----------------|--------|
| `--text-display` | `2rem` | 700 | 1.2 | `-0.02em` | Rare marketing hero (avoid in app chrome) |
| `--text-h1` | `1.75rem` | 700 | 1.25 | `-0.01em` | Page title |
| `--text-h2` | `1.375rem` | 600 | 1.3 | `-0.01em` | Section / card header |
| `--text-h3` | `1.125rem` | 600 | 1.35 | `0` | Subsection |
| `--text-h4` | `1rem` | 600 | 1.4 | `0` | Table group labels |
| `--text-body` | `1rem` | 400 | 1.5 | `0` | Default UI copy |
| `--text-body-strong` | `1rem` | 600 | 1.5 | `0` | Emphasis in body |
| `--text-small` | `0.875rem` | 400 | 1.45 | `0` | Helper text, metadata |
| `--text-small-strong` | `0.875rem` | 600 | 1.45 | `0` | Labels in dense tables |
| `--text-micro` | `0.75rem` | 500 | 1.4 | `0.02em` | Chips, badges (uppercase optional) |
| `--text-code` | `0.8125rem` | 400 | 1.45 | `0` | Inline codes / requestId |

### 4.3 Typography CSS variables (`:root`)

Map every row from §4.2 to implementation tokens:

```css
:root {
  --font-family-base: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-family-mono: ui-monospace, "SF Mono", Consolas, monospace;

  --text-display-size: 2rem;
  --text-display-weight: 700;
  --text-display-leading: 1.2;
  --text-display-tracking: -0.02em;

  --text-h1-size: 1.75rem;
  --text-h1-weight: 700;
  --text-h1-leading: 1.25;
  --text-h1-tracking: -0.01em;

  --text-h2-size: 1.375rem;
  --text-h2-weight: 600;
  --text-h2-leading: 1.3;
  --text-h2-tracking: -0.01em;

  --text-h3-size: 1.125rem;
  --text-h3-weight: 600;
  --text-h3-leading: 1.35;
  --text-h3-tracking: 0;

  --text-h4-size: 1rem;
  --text-h4-weight: 600;
  --text-h4-leading: 1.4;
  --text-h4-tracking: 0;

  --text-body-size: 1rem;
  --text-body-weight: 400;
  --text-body-leading: 1.5;

  --text-body-strong-weight: 600;

  --text-small-size: 0.875rem;
  --text-small-weight: 400;
  --text-small-leading: 1.45;

  --text-small-strong-weight: 600;

  --text-micro-size: 0.75rem;
  --text-micro-weight: 500;
  --text-micro-leading: 1.4;
  --text-micro-tracking: 0.02em;

  --text-code-size: 0.8125rem;
  --text-code-weight: 400;
  --text-code-leading: 1.45;
}
```

### 4.4 Base `body` styles

```css
body {
  font-family: var(--font-family-base);
  font-size: var(--text-body-size);
  font-weight: var(--text-body-weight);
  line-height: var(--text-body-leading);
  color: var(--color-text-primary);
}
```

---

## 5. Spacing & layout — 4px / 8px grid

### 5.1 Base unit

- **1 unit = 4px** (`0.25rem` at 16px root).
- All spacing tokens are **multiples of 4px**. Prefer **8px** for vertical rhythm between blocks.

### 5.2 Spacing tokens

| Token | Value (px) | Value (rem) | Typical use |
|-------|------------|-------------|-------------|
| `--space-0` | 0 | 0 | Reset |
| `--space-1` | 4px | 0.25rem | Icon-text gap |
| `--space-2` | 8px | 0.5rem | Tight stack, chip padding Y |
| `--space-3` | 12px | 0.75rem | Input padding Y (compact) |
| `--space-4` | 16px | 1rem | Default field gap, card padding (compact) |
| `--space-5` | 24px | 1.5rem | Card padding default, section gap |
| `--space-6` | 32px | 2rem | Page section separation |
| `--space-7` | 40px | 2.5rem | Large section breaks |
| `--space-8` | 48px | 3rem | Hero / empty-state vertical padding |
| `--space-page-gutter` | 16px | 1rem | Mobile horizontal page margin |
| `--space-page-gutter-lg` | 24px | 1.5rem | Desktop horizontal margin |

```css
:root {
  --space-0: 0;
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 2.5rem;
  --space-8: 3rem;
  --space-page-gutter: 1rem;
  --space-page-gutter-lg: 1.5rem;
}
```

### 5.3 Layout tokens

| Token | Value | Usage |
|-------|-------|--------|
| `--layout-max-form` | `32rem` (512px) | Participant single-column forms |
| `--layout-max-form-wide` | `42rem` (672px) | Leader editors |
| `--layout-max-content` | `75rem` (1200px) | Dashboard shell |
| `--layout-min-tap-target` | `44px` | Buttons/links on touch |

```css
:root {
  --layout-max-form: 32rem;
  --layout-max-form-wide: 42rem;
  --layout-max-content: 75rem;
  --layout-min-tap-target: 44px;
}
```

### 5.4 Grid usage rules

- Stack form fields with **`gap: var(--space-4)`**.
- Inside cards, use **`padding: var(--space-5)`**; nested stacks **`gap: var(--space-4)`**.
- Align icons and text with **`gap: var(--space-2)`** horizontally.

---

## 6. Radii & shadows — exact tokens

### 6.1 Border radius

| Token | Value | Usage |
|-------|-------|--------|
| `--radius-none` | `0` | Tables flush |
| `--radius-sm` | `4px` | Inputs, small chips |
| `--radius-md` | `8px` | Buttons, cards |
| `--radius-lg` | `12px` | Modals, large panels |
| `--radius-full` | `9999px` | Pills / avatars |

### 6.2 Shadows

| Token | Value |
|-------|--------|
| `--shadow-none` | `none` |
| `--shadow-card` | `0 1px 2px rgba(15, 18, 22, 0.06), 0 1px 3px rgba(15, 18, 22, 0.08)` |
| `--shadow-popover` | `0 4px 16px rgba(15, 18, 22, 0.12)` |
| `--shadow-modal` | `0 12px 48px rgba(15, 18, 22, 0.2)` |

Dark mode optional refinement (same tokens, tuned):

```css
.theme-dark {
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.35);
  --shadow-popover: 0 8px 24px rgba(0, 0, 0, 0.45);
  --shadow-modal: 0 16px 56px rgba(0, 0, 0, 0.55);
}
```

### 6.3 Combined radii + shadows (`:root`)

```css
:root {
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  --shadow-none: none;
  --shadow-card: 0 1px 2px rgba(15, 18, 22, 0.06), 0 1px 3px rgba(15, 18, 22, 0.08);
  --shadow-popover: 0 4px 16px rgba(15, 18, 22, 0.12);
  --shadow-modal: 0 12px 48px rgba(15, 18, 22, 0.2);

  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 300;
  --z-toast: 400;
}
```

### 6.4 Z-index scale (reference)

| Token | Value | Usage |
|-------|-------|--------|
| `--z-dropdown` | `100` | Menus |
| `--z-sticky` | `200` | Sticky bars |
| `--z-modal` | `300` | Dialogs |
| `--z-toast` | `400` | Toasts |

---

## 7. Web components — pseudo-code & CSS

Convention: **`ds-`** prefix (design system). All colors reference **§3** variables.

### 7.1 Button

**Anatomy:** `.ds-btn` + modifier `--primary | --secondary | --ghost | --danger` + `--sm | --md | --lg`.

```html
<button type="button" class="ds-btn ds-btn--primary ds-btn--md">
  <span class="ds-btn__label">Continue</span>
</button>
<button type="button" class="ds-btn ds-btn--ghost ds-btn--md">Cancel</button>
<button type="button" class="ds-btn ds-btn--danger ds-btn--md">Reject registration</button>
```

```css
.ds-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-family-base);
  font-weight: 600;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}
.ds-btn:focus-visible {
  outline: 2px solid var(--focus-ring-color);
  outline-offset: 2px;
}
.ds-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ds-btn--sm { min-height: 32px; padding: 0 var(--space-3); font-size: var(--text-small-size); }
.ds-btn--md { min-height: 40px; padding: 0 var(--space-4); font-size: var(--text-body-size); }
.ds-btn--lg { min-height: 48px; padding: 0 var(--space-5); font-size: var(--text-body-size); }

.ds-btn--primary {
  background: var(--color-primary);
  color: var(--color-primary-fg);
}
.ds-btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}
.ds-btn--primary:active:not(:disabled) {
  background: var(--color-primary-active);
}

.ds-btn--secondary {
  background: var(--color-bg-surface);
  color: var(--color-primary);
  border-color: var(--color-primary);
}
.ds-btn--secondary:hover:not(:disabled) {
  background: var(--color-bg-muted);
}

.ds-btn--ghost {
  background: transparent;
  color: var(--color-primary);
}
.ds-btn--ghost:hover:not(:disabled) {
  background: var(--color-bg-muted);
}

.ds-btn--danger {
  background: var(--color-danger);
  color: var(--color-text-inverse);
}
.ds-btn--danger:hover:not(:disabled) {
  filter: brightness(1.08);
}
```

---

### 7.2 Input

```html
<div class="ds-field" data-invalid="false">
  <label class="ds-label" for="phone">Contact phone</label>
  <input id="phone" class="ds-input" type="tel" autocomplete="tel" />
  <p class="ds-field-help">Include country code.</p>
  <p class="ds-field-error" hidden>Invalid format.</p>
</div>
```

```css
.ds-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.ds-label {
  font-size: var(--text-small-size);
  font-weight: 600;
  line-height: var(--text-small-leading);
  color: var(--color-text-primary);
}
.ds-input {
  min-height: 40px;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-body-size);
  line-height: var(--text-body-leading);
  color: var(--color-text-primary);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
}
.ds-input:hover:not(:disabled) {
  border-color: var(--color-border-strong);
}
.ds-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--focus-ring-color);
}
.ds-input:disabled {
  background: var(--color-bg-disabled);
  color: var(--color-text-muted);
}
.ds-field[data-invalid="true"] .ds-input {
  border-color: var(--color-danger);
}
.ds-field-help {
  margin: 0;
  font-size: var(--text-small-size);
  line-height: var(--text-small-leading);
  color: var(--color-text-secondary);
}
.ds-field-error {
  margin: 0;
  font-size: var(--text-small-size);
  color: var(--color-danger);
}
```

---

### 7.3 Card

```html
<section class="ds-card">
  <header class="ds-card__header">
    <h2 class="ds-card__title">Capacity & waitlist</h2>
    <p class="ds-card__subtitle">Tenant-scoped queue</p>
  </header>
  <div class="ds-card__body">
    <!-- content -->
  </div>
  <footer class="ds-card__footer">
    <button type="button" class="ds-btn ds-btn--secondary ds-btn--md">Refresh</button>
    <button type="button" class="ds-btn ds-btn--primary ds-btn--md">Convert next</button>
  </footer>
</section>
```

```css
.ds-card {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}
.ds-card__header {
  padding: var(--space-5) var(--space-5) var(--space-2);
}
.ds-card__title {
  margin: 0;
  font-size: var(--text-h3-size);
  font-weight: var(--text-h3-weight);
  line-height: var(--text-h3-leading);
  color: var(--color-text-primary);
}
.ds-card__subtitle {
  margin: var(--space-1) 0 0;
  font-size: var(--text-small-size);
  color: var(--color-text-secondary);
}
.ds-card__body {
  padding: var(--space-4) var(--space-5);
}
.ds-card__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5) var(--space-5);
  border-top: 1px solid var(--color-border-subtle);
}
```

---

### 7.4 Modal

```html
<div class="ds-modal-root" hidden>
  <div class="ds-modal-scrim" data-close></div>
  <div class="ds-modal" role="dialog" aria-modal="true">
    <header class="ds-modal__header">
      <h2 class="ds-modal__title">Confirm refund</h2>
    </header>
    <div class="ds-modal__body">
      <p class="ds-text-body">This issues a refund and updates registration state.</p>
    </div>
    <footer class="ds-modal__footer">
      <button type="button" class="ds-btn ds-btn--ghost ds-btn--md">Cancel</button>
      <button type="button" class="ds-btn ds-btn--danger ds-btn--md">Refund</button>
    </footer>
  </div>
</div>
```

```css
.ds-modal-root {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: grid;
  place-items: center;
  padding: var(--space-page-gutter);
}
.ds-modal-scrim {
  position: absolute;
  inset: 0;
  background: var(--color-overlay-scrim);
}
.ds-modal {
  position: relative;
  width: min(480px, 100%);
  max-height: min(70vh, 560px);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-modal);
  border: 1px solid var(--color-border-default);
}
.ds-modal__header {
  padding: var(--space-5);
  border-bottom: 1px solid var(--color-border-subtle);
}
.ds-modal__title {
  margin: 0;
  font-size: var(--text-h2-size);
  font-weight: var(--text-h2-weight);
}
.ds-modal__body {
  padding: var(--space-5);
  overflow: auto;
  color: var(--color-text-primary);
}
.ds-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5) var(--space-5);
  border-top: 1px solid var(--color-border-subtle);
}
```

---

### 7.5 Alert / banner

```html
<div class="ds-alert ds-alert--warning" role="status">
  <span class="ds-alert__icon" aria-hidden="true">!</span>
  <div class="ds-alert__content">
    <strong class="ds-alert__title">Confirming payment</strong>
    <p class="ds-alert__text">This may take up to a minute. You can refresh safely.</p>
  </div>
</div>
```

```css
.ds-alert {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
}
.ds-alert__title {
  display: block;
  font-size: var(--text-small-size);
  font-weight: 600;
}
.ds-alert__text {
  margin: var(--space-1) 0 0;
  font-size: var(--text-small-size);
  color: var(--color-text-secondary);
}

.ds-alert--info {
  background: var(--color-info-bg);
  border-color: var(--color-info-border);
  color: var(--color-info);
}
.ds-alert--success {
  background: var(--color-success-bg);
  border-color: var(--color-success-border);
  color: var(--color-success);
}
.ds-alert--warning {
  background: var(--color-warning-bg);
  border-color: var(--color-warning-border);
  color: var(--color-warning);
}
.ds-alert--danger {
  background: var(--color-danger-bg);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}
```

---

## 8. Telegram Mini App — functional mapping

Telegram UI is constrained by **MainButton**, **SecondaryButton**, and **themeParams**. Implement by mapping **semantic roles** to the same tokens conceptually (inject hex from tokens into Mini App theme API where supported).

### 8.1 Functional components → tokens

| Functional component | Token mapping | Notes |
|---------------------|---------------|--------|
| **Primary CTA strip** | `--color-primary`, `--color-primary-fg` | Maps to MainButton default styling |
| **Secondary CTA strip** | `--color-bg-surface`, `--color-primary` border/text | SecondaryButton |
| **Success card** | `--color-success-bg`, `--color-success-border`, `--color-success` | Post-registration / paid confirmation summary |
| **Warning card** | `--color-warning-bg`, `--color-warning-border`, `--color-warning` | Payment pending / async (`WF-PAY-ASYNC-01`) |
| **Danger card** | `--color-danger-bg`, `--color-danger-border`, `--color-danger` | Payment failed / rejected |
| **Info card** | `--color-info-bg`, `--color-info-border`, `--color-info` | Neutral operational notices |
| **Neutral summary** | `--color-bg-muted`, `--color-text-primary` | Status lines mirroring Web chips |
| **Destructive confirm** | `--color-danger` | Refund / reject — confirm step before API call |

### 8.2 Content blocks

- **Title:** equivalent to `--text-h3-size` / weight 600.
- **Body:** `--text-body-size`, color `--color-text-primary` (Mini App theme `text_color` should align).
- **Footnote / requestId:** `--text-micro-size`, `--color-text-muted` — matches Web helper pattern for support (`error.details` / `requestId` per taxonomy doc).

---

## 9. Validation & errors — cross-reference

Normative sources:

- `docs/20-architecture/contracts/error_response_taxonomy_v2.md` — envelope shape, **`error.code`**, **`error.retryability`**, HTTP status table.
- `docs/10-product/form_validation_ux_contract_v2.md` — **inline** vs **banner** vs **blocking**, field mapping, unknown fields.
- `docs/10-product/frontend_error_states.md` — screen-level matrix and recovery UX.

### 9.1 Field-level (inline) errors

**Use when:**

- `error.details.field_errors` identifies one or more fields, AND  
- The screen is a **form** (`S-PART-02`, `S-LEAD-03`, payment fields, etc.)

**Rules from taxonomy + form contract:**

- Branch on **`error.code`** (not parsing `error.message` for logic).
- Display **`error.message`** as secondary summary only if needed; map stable **`validation.*`** / **`error.code.<CODE>`** keys for localization (`form_validation_ux_contract_v2.md`).
- Typical codes: `VALIDATION_REQUIRED_FIELD_MISSING`, `VALIDATION_FIELD_FORMAT_INVALID`, `VALIDATION_ENUM_INVALID`, `VALIDATION_UNKNOWN_FIELD` (treat as blocking banner + inline unknown marker per policy).

**UI:** `.ds-field[data-invalid="true"]` + `.ds-field-error` under each targeted control.

### 9.2 Block-level (banner) errors

**Use when:**

- `form_validation_ux_contract_v2.md` classifies handling as **banner**: non-field operation errors while user stays on screen.
- Examples from taxonomy: `STATE_TRANSITION_INVALID`, `CAPACITY_FULL`, `WAITLIST_CONFLICT_ACTIVE_RECORD`, `PAYMENT_STATUS_TRANSITION_INVALID`, `IDEMPOTENCY_KEY_REPLAY_MISMATCH`, `REGISTRATION_DUPLICATE_ACTIVE`, `EXPORT_SNAPSHOT_INCONSISTENT` (leader context).

**UI:** `.ds-alert--danger` or `.ds-alert--warning` at top of panel/card; include **primary corrective action** derived from `retryability`.

### 9.3 Blocking / full-panel errors

**Use when:**

- **permission_denied** screen state (`screen_state_spec_v2.md`), OR  
- Codes such as `AUTH_UNAUTHENTICATED`, `AUTH_FORBIDDEN_ROLE`, `TENANT_CONTEXT_MISSING`, `TENANT_SCOPE_FORBIDDEN`, `TENANT_SCOPE_CONFLICT`, `TENANT_CONTEXT_INVALID` — user cannot proceed without **RETRY_AFTER_ACTION** (`NO_RETRY` / `RETRY_AFTER_ACTION` per taxonomy).

**UI:** Replace form body with explanatory panel using `--color-danger-bg` / neutral surface + single **sign-in** / **switch workspace** CTA.

### 9.4 Retryability → UI (from taxonomy §5)

| `retryability` | FE behavior |
|----------------|-------------|
| `NO_RETRY` | No auto-retry; user fixes input or permissions |
| `SAFE_RETRY` | One explicit **Retry** button (e.g. `CONCURRENCY_CONFLICT`) |
| `RETRY_WITH_BACKOFF` | Backoff + spinner (`RATE_LIMITED`, `DEPENDENCY_TEMPORARY_UNAVAILABLE`, `INTERNAL_ERROR`) |
| `RETRY_AFTER_ACTION` | Prompt login / Telegram context / tenant refresh (`AUTH_*`, `AUTH_TELEGRAM_CONTEXT_REQUIRED`) |

---

## 10. Extensibility rules & checklist

### 10.1 Rules

1. **New color:** Add to **§3** tables (light + dark) with semantic name; document contrast rationale.
2. **New component:** Add **§7** subsection + Telegram mapping in **§8** if applicable.
3. **New spacing:** Must be **multiple of 4px** unless documented exception.
4. **Implementation ban:** No raw hex in feature CSS—only `var(--token)`.

### 10.2 PR checklist

- [ ] Tokens referenced exist in `:root` and `.theme-dark`
- [ ] Typography uses rem scale from **§4**
- [ ] Spacing uses grid from **§5**
- [ ] Radii/shadows use **§6**
- [ ] Errors follow **§9** + taxonomy codes
- [ ] Touch targets ≥ `--layout-min-tap-target` where applicable
- [ ] This document updated in same PR if tokens/components added

---

## 11. Example: standard form using tokens

**Scenario:** Participant registration (`S-PART-02`) — single column, tenant-safe labels, inline validation ready.

### 11.1 HTML structure

```html
<div class="ds-page">
  <header class="ds-page__header">
    <h1 class="ds-page__title">Register for Spring Camp</h1>
    <p class="ds-page__lead">Complete the form to reserve your spot or join the waitlist.</p>
  </header>

  <div class="ds-alert ds-alert--info" role="status">
    <div class="ds-alert__content">
      <strong class="ds-alert__title">Tenant workspace</strong>
      <p class="ds-alert__text">You are registering under <strong>Acme Tours Co.</strong></p>
    </div>
  </div>

  <form class="ds-form" novalidate>
    <div class="ds-field">
      <label class="ds-label" for="fullName">Full name <span class="ds-req" aria-hidden="true">*</span></label>
      <input id="fullName" class="ds-input" type="text" autocomplete="name" required />
      <p class="ds-field-help">Legal name as on ID.</p>
      <p class="ds-field-error" hidden></p>
    </div>

    <div class="ds-field">
      <label class="ds-label" for="phone">Contact phone <span class="ds-req" aria-hidden="true">*</span></label>
      <input id="phone" class="ds-input" type="tel" autocomplete="tel" required />
      <p class="ds-field-help">Include country code.</p>
      <p class="ds-field-error" hidden></p>
    </div>

    <div class="ds-field">
      <label class="ds-label" for="transport">Transport mode <span class="ds-req" aria-hidden="true">*</span></label>
      <select id="transport" class="ds-input ds-select" required>
        <option value="">Select…</option>
        <option value="self_vehicle">Own vehicle</option>
        <option value="group_vehicle">Group vehicle</option>
        <option value="other">Other</option>
      </select>
      <p class="ds-field-error" hidden></p>
    </div>

    <div class="ds-form__actions">
      <button type="button" class="ds-btn ds-btn--ghost ds-btn--md">Back</button>
      <button type="submit" class="ds-btn ds-btn--primary ds-btn--md">Submit registration</button>
    </div>
  </form>
</div>
```

### 11.2 Layout CSS (uses §§3–6)

```css
.ds-page {
  max-width: var(--layout-max-form);
  margin: 0 auto;
  padding: var(--space-6) var(--space-page-gutter);
}
@media (min-width: 768px) {
  .ds-page {
    padding-left: var(--space-page-gutter-lg);
    padding-right: var(--space-page-gutter-lg);
  }
}

.ds-page__title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-h1-size);
  font-weight: var(--text-h1-weight);
  line-height: var(--text-h1-leading);
  color: var(--color-text-primary);
}
.ds-page__lead {
  margin: 0 0 var(--space-5);
  font-size: var(--text-body-size);
  line-height: var(--text-body-leading);
  color: var(--color-text-secondary);
}

.ds-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-5);
}

.ds-select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--color-text-muted) 50%),
    linear-gradient(135deg, var(--color-text-muted) 50%, transparent 50%);
  background-position: calc(100% - 18px) calc(50% - 2px), calc(100% - 12px) calc(50% - 2px);
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
}

.ds-form__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.ds-req {
  color: var(--color-danger);
}
```

This example composes **§7.2 Input**, **§7.1 Button**, **§7.5 Alert** patterns and respects the **4px/8px grid** (`gap: var(--space-4)`).

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-02 | v1.0 initial |
| 2026-05-02 | v1.1 production expansion: full light/dark tokens, grid, z-index, components, taxonomy cross-reference, form example |

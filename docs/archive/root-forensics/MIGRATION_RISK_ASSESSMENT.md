# Migration Risk Assessment: Denali Workspace Theme Migration

This document evaluates the risks, component dependencies, and schema gaps involved in migrating the **Denali** workspace from legacy CSS skinning (`denali-admin.css` and its imports) to the new JSON-driven `themeJson` engine using `--ws-*` semantic variables.

---

## 1. CSS Custom Properties Missing from themeJson Schema

While the base `themeJson` contract supports basic branding variables (e.g. `--ws-color-accent`, `--ws-color-primary`), several custom variables declared in Denali's style sheets are not mapped or supported by the schema.

### Mapped vs. Unmapped Variables in [admin-semantic-tokens.css](file:///home/hamed/Music/docs/packages/workspaces/denali/theme/admin-semantic-tokens.css)

| Legacy CSS Token | Schema Status | Impact of Removal |
|---|---|---|
| `--sidebar`, `--sidebar-border`, `--sidebar-foreground` | **Missing** | Sidebar loses its background and borders, collapsing to fallback styles. |
| `--sidebar-primary`, `--sidebar-accent` | **Missing** | Active items and hover backgrounds in the navigation lose branding colors. |
| `--shell-sidebar-width` | **Missing** | Layout structure (grid and offsets) will break if layout templates depend on this width variable. |
| `--radius`, `--radius-lg`, `--radius-xl` | **Missing** | Component border-radii revert to default browser or host values, breaking the visual "rounded corner" design language. |
| `--denali-mist-50` to `--denali-forest-700` | **Missing** | Custom color scale (e.g. specialized forest greens and mist grays) used in gradients and hover states will fail to resolve. |
| `--denali-shadow-card`, `--denali-shadow-card-hover` | **Missing** | Cards will appear flat (no elevation/shadows). |

---

## 2. Legacy CSS Styles & Selectors (Layout Hooks)

Denali's layout hooks in [admin-skin.css](file:///home/hamed/Music/docs/packages/workspaces/denali/theme/admin-skin.css) inject complex component layouts and gradients that cannot be represented in a simple key-value `themeJson` variable dictionary.

* **Linear Gradients:** 
  * The sidebar background is defined by `linear-gradient(180deg, color-mix(in oklch, var(--sidebar) 88%, var(--denali-mist-100)) 0%, ...)`
  * Brand mark background uses a diagonal gradient: `linear-gradient(145deg, ...)`
* **Layout and Flex Rules:** Extensive structural styling is declared on custom elements/attributes:
  * `[data-denali-dashboard-widget]` (Flex styling, min-heights, shadows)
  * `[data-denali-dashboard-kpi-grid]` / `[data-denali-dashboard-finance-kpi-grid]` (CSS Grid layouts, column counts, media queries)
  * `[data-denali-empty-state]` (Dashed border styling, icon containment, colors)
  * `[data-denali-welcome-dialog]` / `[data-denali-welcome-brand-row]` (Modals, scroll bars, logo alignments)
* **Animations:** Entrance animations and shimmer skeletons defined in [animations.css](file:///home/hamed/Music/docs/packages/workspaces/denali/theme/animations.css) (e.g., `@keyframes denali-fade-up`, `@keyframes denali-shimmer`) are explicitly applied to custom elements like `[data-denali-animate="fade-up"]` and `[data-denali-skeleton="shimmer"]`.

---

## 3. UI Component Dependencies in the Admin Panel

The following components in the Admin Panel depend directly on these legacy CSS files:

1. **Sidebar Navigation (`[data-operator-sidebar]`)**:
   * Relies on `admin-skin.css` for structural layout, width variable, background gradient, page indicators (`border-inline-start`), and active icons.
2. **Dashboard Widgets & KPIs (`[data-denali-dashboard-widget]`, `[data-denali-dashboard-kpi-grid]`)**:
   * Uses layout rules for grid systems, widget headers, widget footers, chevron rotations, and borders.
3. **Empty States (`[data-denali-empty-state]`)**:
   * Relies on the dashed border, special 4% color-mix transparency background, and icon sizing.
4. **Modals & Dialogs (`[data-denali-confirm-dialog]`, `[data-denali-welcome-dialog]`)**:
   * Layout sizing, borders, logo-mark integration, bullet listings, and background overlays.
5. **Wizard Steps & Fields (`wizard-stepper.css`, `wizard-fields.css`, `wizard-review.css`)**:
   * Deep integration with form input elements, progress tracks, calendar widgets, and summary cards.

---

## 4. Visual Breakage Risks

If the legacy CSS files are removed before a proper migration:

* 💥 **Complete Layout Collapse on Dashboard:** Widgets will lose flex alignment, grids will break, and elements like lists/empty states will stack incorrectly.
* 💥 **Sidebar Visual Degradation:** The sidebar will lose its distinct background gradient, border shadows, and active page markers.
* 💥 **Form Field Unstyling in Wizard:** Multi-step wizard inputs, stepper items, calendars, and review blocks will lose custom margins, padding, and validation states.
* 💥 **Gradients & OKLCH Failures:** Color mixtures (`color-mix`) will fail to resolve because their core color variables (e.g. `--denali-mist-100`) won't be defined.

---

## 5. Proposed Migration Strategy

To safely migrate from legacy CSS to zero-code `themeJson`:

1. **Map Tokens to Manifest:** Map variables that fit the `--ws-*` naming standard directly into the `theme` key in `workspace.manifest.json`.
2. **Create Platform-Core Fallbacks:** Extend the platform-core layout wrapper to handle default styles for `[data-denali-dashboard-widget]` or `[data-operator-sidebar]` using generic layout variables (e.g. `--ws-sidebar-bg`, `--ws-radius`) so that the workspace does not need to declare layout styles.
3. **Refactor Non-Token Styles:** Move animations, layout wrappers, and custom dialog properties into a clean shared wrapper or keep them strictly confined to a single, isolated module stylesheet rather than a monolithic stylesheet bundle.

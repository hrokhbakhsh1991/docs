# Tours Page Overrides

> **PROJECT:** Denali Club
> **Generated:** 2026-06-30 03:35:19
> **Page Type:** Search Results

> **Implementation:** Public catalog UI lives on `apps/marketing` (`/tours`, `/tours/[id]`). Workspace skin: `packages/workspaces/denali/theme/denali-marketing.css` — tokens mapped from this pack's [`MASTER.md`](../MASTER.md). Hooks: [`docs/workspaces/denali/marketing-catalog-ui.md`](../../../docs/workspaces/denali/marketing-catalog-ui.md).

> ⚠️ **IMPORTANT:** Rules in this file **override** the Master file (`design-system/MASTER.md`).
> Only deviations from the Master are documented here. For all other rules, refer to the Master.

---

## Page-Specific Rules

### Layout Overrides

- **Max Width:** 1200px (standard)
- **Layout:** Full-width sections, centered content
- **Sections:** 1. Hero, 2. Bento Grid (Key Features), 3. Detail Cards, 4. Tech Specs, 5. CTA

### Spacing Overrides

- No overrides — use Master spacing

### Typography Overrides

- No overrides — use Master typography

### Color Overrides

- **Strategy:** Card backgrounds: #F5F5F7 or Glass. Icons: Vibrant brand colors. Text: Dark.

### Component Overrides

- Avoid: Default keyboard for all inputs
- Avoid: Desktop-first causing mobile issues
- Avoid: Default mobile tap handling

---

## Page-Specific Components

- No unique components for this page

---

## Recommendations

- Effects: Multi-layer shadow stacks (nested View) to simulate clay depth, LinearGradient #A78BFA→#7C3AED buttons, borderRadius 40–50 outer / 32 cards / 20 buttons, Reanimated spring squish (scale 0.92 on press), BlurView glass-clay hybrid cards, floating blobs with slow ±20px drift, Haptics Light on every press
- Forms: Use inputmode attribute
- Responsive: Start with mobile styles then add breakpoints
- Touch: Use touch-action CSS or fastclick
- CTA Placement: Floating Action Button or Bottom of Grid

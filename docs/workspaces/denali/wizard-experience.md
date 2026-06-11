# Denali tour wizard experience

```yaml
doc_id: DENALI-WIZARD-EXPERIENCE
version: "2026-06-10-v6"
workspace: denali
stack: ui-primitives · design-tokens · denali/theme/wizard-*
authority: DEC-P9-007 · DEC-P9-013
```

## Scope

Tour create wizard at **`/tours/new`** (`apps/web/app/tours/**`) — outside `(app)/` per DEC-P9-007. Controls stay on **`@app-tour/ui-primitives`**; no shadcn in `app/tours/**`.

| Area | Path |
|------|------|
| Route | `apps/web/app/tours/new/` |
| Host | `apps/web/src/wizard/workspace-wizard-host.tsx` |
| Denali composites | `apps/web/src/wizard/denali/*` |
| Theme CSS | `packages/workspaces/denali/theme/wizard-*.css` |
| Bridge chrome | `apps/web/src/shell/wizard-bridge-shell.tsx` |

Operator list/settings use shadcn under `(app)/`; wizard shares **tenant primary** and mist surfaces via `body[data-workspace-plugin="denali"]` + [`admin-experience.md`](admin-experience.md).

## Wizard Bridge chrome

When an **authenticated Denali operator** opens `/tours/new`, `ToursWizardLayout` renders **Wizard Bridge** instead of Phase 3 `AppShell`:

- Sticky header: compact brand, back links (`/tours`, `/dashboard`), **`WizardBridgeThemeToggle`** (`ui-primitives` + `wizard-bridge-shell__theme-toggle`)
- RTL (`html[dir="rtl"]`): `wizard-bridge-shell__back-icon` mirrors via CSS (`scaleX(-1)`) — no Tailwind on bridge chrome
- No sidebar — form-focused layout
- Urban / starter / anonymous → legacy `AppShell` unchanged

`data-testid="wizard-bridge-shell"` on the bridge root.

## CSS selectors

All Denali wizard skin rules scope to:

```css
body[data-workspace-plugin="denali"] [data-new-tour-wizard]
```

Progress + fields inside host:

```css
body[data-workspace-plugin="denali"] [data-new-tour-wizard] [data-workspace-wizard]
```

**Portal exception (calendar):** Radix `Popover` renders on `document.body`, outside `[data-new-tour-wizard]`. Calendar skin uses **body-level** selectors on `data-denali-wizard-calendar` / `data-denali-wizard-calendar-popover` — see `wizard-calendar.css`.

## Data attributes

| Attribute | Use |
|-----------|-----|
| `data-new-tour-wizard` | Page root (`new-tour-wizard-client`) |
| `data-denali-wizard-host` | `WorkspaceWizardHost` when `pluginId=denali` |
| `data-denali-wizard-surface="card\|section"` | KPI-style cards / composite sections |
| `data-denali-wizard-photo-grid` | Photos composite — 2-column layout from `__photos-layout` (sm+) |
| `data-wizard-step-state` | **Sole** progress pill state SoT (`current` / `complete` / `upcoming` — upcoming uses dashed border in Denali stepper) |
| `data-denali-wizard-map-preview` | Map iframe host — skeleton until `load` |
| `data-denali-wizard-gear-list` | Equipment catalog compact list (replaces per-item panels) |
| `data-denali-wizard-file-input` | Styled file upload in photos composite |
| `data-denali-wizard-calendar` | `Calendar` root inside date popover — portal-safe teal `--primary` |
| `data-denali-wizard-calendar-popover` | `PopoverContent` wrapping calendar |
| `data-wizard-date-picker` | Trigger wrapper (`wizard-field` date kind, `denali-datetime-field`) |
| `data-denali-wizard-datetime` | `LocalizedDatetimePicker` with `layout="wizard"` — BEM grid + primitive clock |
| `wizard-bridge-shell__theme-toggle` | Bridge header theme control (`ui-primitives` ghost) |

## Token bridge

| Consumer | Variables |
|----------|-----------|
| `ui-primitives` | `--color-primary`, `--color-bg-page`, `--color-surface`, … |
| Legacy stepper in globals | `--primary`, `--border`, … |

Denali wizard CSS sets **both** under `[data-new-tour-wizard]` so primitives and stepper share teal `#0f766e` (light) / `#5eead4` (dark).

Explicit primitive aliases on page root (phase 2): `--color-surface`, `--color-border`, `--color-focus-ring` re-bound alongside shadcn `--primary` / `--card` bridge.

### Dark mode cascade

Same pattern as admin shell — platform `.theme-dark` in `globals.css` would inject blue `#5b9fd4` without overrides:

1. `html.dark:has(body[data-workspace-plugin="denali"]) [data-new-tour-wizard]`
2. `body[data-workspace-plugin="denali"] .theme-dark [data-new-tour-wizard]`

**Tenant inline override:** `[data-tenant-theme]` ships API `--color-primary` (often `#0f766e`) as an inline style. That value wins over `body` for descendants and would freeze `ui-primitives` primary buttons in dark mode. Denali wizard skin therefore **re-binds** `--color-primary` / `--color-primary-fg` on `[data-new-tour-wizard]` in dark selectors so step nav + primitive CTAs track teal `#5eead4`.

## Theme bundle

Imported via [`denali-admin.css`](../../../packages/workspaces/denali/theme/denali-admin.css):

- `wizard-skin.css` — bridge header, page typography, empty/seed states
- `wizard-stepper.css` — progress rail (mobile scroll / desktop pills)
- `wizard-fields.css` — labels, composites, in-page date trigger borders
- `wizard-calendar.css` — portaled calendar popover (body-level; dual dark cascade)
- `wizard-interactions.css` — card hover, mild step fade (`prefers-reduced-motion: reduce` disables animation)

## Date picker exception

`LocalizedDatePicker` / `LocalizedDatetimePicker` (`src/components/i18n/`) use shadcn for calendar popover — allowed outside `app/tours`.

| Layer | Scoping |
|-------|---------|
| Trigger | `data-wizard-date-picker` on host + `data-denali-date-picker` on shadcn trigger — `wizard-fields.css` under `[data-new-tour-wizard]` |
| Popover + grid | `data-denali-wizard-calendar-popover` + `data-denali-wizard-calendar` — **`wizard-calendar.css` on `body[data-workspace-plugin="denali"]`** (not under page root) |

Selected day uses `aria-pressed="true"` (not `data-selected`). Dark mode re-binds `--denali-wizard-calendar-primary` via the same dual cascade as admin (`html.dark:has(body…)` + `body… .theme-dark`).

**Datetime (phase 2):** `LocalizedDatetimePicker layout="wizard"` renders BEM `denali-wizard-datetime*` and `LocalizedTimeInput variant="primitive"`. Admin/finance paths keep default shadcn layout.

**Composite UX (phase 3):** Photos use single `__photo-card` surface (no nested `__panel`). Gear catalog uses `__list` / `__gear-item`. Section headings use `h3`; day blocks use `__subtitle`. File inputs use `data-denali-wizard-file-input`.

**Maintenance (phase 4):** `data-step-state` removed — platform fallback in `globals.css` and Denali `wizard-stepper.css` both key off `data-wizard-step-state` only. Stepper layout duplication is intentional: `globals.css` = Urban/starter neutral pills; `wizard-stepper.css` = Denali scroll rail + teal states under `[data-new-tour-wizard]`.

**Infrastructure hardening (phase 4b):**

| Concern | Contract |
|---------|----------|
| Photo external URL | `denaliImageFileAssetSchema` + UI — `https:` only (`isDenaliHttpsImageUrl` in `@app-tour/workspace-denali`) |
| Wizard draft upload session | `createDenaliWizardDraftSessionId()` — UUID v4 via `crypto.randomUUID` or `getRandomValues` fallback; upload disabled when not UUID-shaped |
| Denali composite bundle | `next/dynamic` → `denali-composite-field.tsx`; Urban wizard does not eagerly import Denali composite renderers |
| Section headings | All composites use `<h3 class="denali-wizard-composite__title">` (including location zones) |
| Composite load errors | `denali-wizard-composite__error` + `role="alert"` (gear catalog fetch failures) |

## Composites

All `apps/web/src/wizard/denali/*.tsx` fields use BEM classes (`denali-wizard-composite*`) styled in `wizard-fields.css` — no Tailwind utilities in composite renderers.

Platform-neutral wizard fallback remains in `apps/web/app/globals.css`; Denali overrides live only under `[data-new-tour-wizard]`.

## Verification

```bash
pnpm --filter @apps/web exec playwright test tests/smoke/denali-wizard.spec.ts
cd apps/web && NODE_ENV=test node --import tsx --import ./test/register-dom.mjs --test test/denali-wizard-theme.spec.ts
pnpm --filter @apps/web exec playwright test -c playwright.operator.config.ts --grep SMK-P9-WIZARD-THEME
```

Manual: `http://denali.localhost:3000/tours/new` (logged in) — bridge header, teal primary on primitive buttons, Persian step labels.

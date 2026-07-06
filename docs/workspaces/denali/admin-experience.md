# Denali operator admin experience

```yaml
doc_id: DENALI-ADMIN-EXPERIENCE
version: "2026-06-24"
workspace: denali
stack: Tailwind v4 · shadcn/ui · design-tokens · theme-react
```

## Scope

Denali operator chrome (`apps/web` `(app)/` routes) uses a **workspace-owned skin** plus tenant primary color. Urban and starter tenants are unaffected — all Denali rules use `body[data-workspace-plugin="denali"]`.

Tour create wizard (`/tours/new`) uses the same token bundle via **Wizard Bridge** — see [`wizard-experience.md`](wizard-experience.md). Tour flat edit (`(app)/tours/[id]/edit`) shares composite field skin via `data-new-tour-wizard` on `DenaliFlatEditPageShell` (operator shell layout; no bridge).

## Theme files

| File | Role |
|------|------|
| `packages/workspaces/denali/theme/denali-admin.css` | Bundle entry (`@import` skin + motion + wizard) |
| `admin-semantic-tokens.css` | @generated — admin light/dark semantics (`denali.admin.tokens.json`) |
| `admin-skin.css` | Hook — layout/sidebar/bookings; `@import` semantic layer |
| `wizard-semantic-tokens.css` | @generated — tone swatch palette (`denali.wizard.tokens.json`) |
| `wizard-fields.css` | Hook — field composites; `@import` wizard semantic layer |
| `finance-skin.css` / `wizard-skin.css` / `wizard-calendar.css` | Hooks — reference admin semantic vars |
| `interactions.css` | Motion tokens, button press, nav transitions |
| `animations.css` | `denali-fade-up`, skeleton shimmer (`prefers-reduced-motion` safe) |
| `tokens.css` | @generated — workspace brand contract |

## Host wiring

1. `apps/web/app/layout.tsx` — `data-workspace-plugin` on `<body>`; imports `denali-admin.css`
2. `resolveBootstrapWorkspacePlugin` — real Denali plugin in `ThemeProviderChain`
3. `operator-shell` — layout width/padding; no `#denali` globals hack

## Scope selector note

Roadmap draft used `html[data-workspace="denali"]`. Implementation uses **`body[data-workspace-plugin="denali"]`** (set in `layout.tsx` from bootstrap plugin) plus `data-workspace-plugin` on `operator-shell` — same isolation, portal-safe.

## Data attributes for pages

| Attribute | Use |
|-----------|-----|
| `data-denali-surface="card"` | KPI/settings cards — hover lift |
| `data-denali-animate="fade-up"` | Dashboard stagger entrance |
| `data-denali-skeleton="shimmer"` | Loading placeholders (`DenaliSkeleton`) |
| `data-denali-empty-state` | Illustrated empty blocks (`DenaliEmptyState`) |
| `data-denali-quick-actions` | Dashboard shortcut row in `PageHeader` actions |
| `data-operator-dashboard-grid` | Responsive 12-col widget grid — equal-height slots |
| `data-dashboard-widget-footer` | Pinned footer link row inside each widget card |
| `data-density="compact"` | Bookings inbox density |
| `data-denali-bookings-inbox` | Inbox card — sticky header + zebra rows |
| `data-denali-booking-timeline` | Inspection panel activity rail |
| `data-denali-category-badge` | Tour kind chip on list cards (`--denali-bark-600` tint) |
| `data-operator-sidebar` | Desktop aside — viewport-height sticky rail (`--shell-sidebar-width`) |
| `data-operator-sidebar-header` | Brand block (logo + tenant title) |
| `data-operator-sidebar-content` | Scrollable nav group between header and footer |
| `data-operator-sidebar-footer` | Pinned footer rail (new-tour CTA) |
| `data-operator-nav-group-label` | Uppercase section label above primary nav links |
| `data-operator-nav-icon` | Icon tile inside each nav row — filled when active |
| `data-operator-header` | Sticky operator chrome — scroll elevation via `data-denali-header-scrolled` |
| `data-denali-tenant-badge` | Compact workspace pill beside breadcrumb (Denali only) |
| `data-operator-breadcrumb` | Path-derived breadcrumb trail in header |
| `data-denali-finance-tabs` | Finance command center tab strip |
| `data-denali-finance-kpi` | KPI cells — alpine accent border (`--denali-alpine-600`) |
| `data-denali-kpi` | Dashboard widget KPI cells — forest accent (overflow-safe labels) |
| `data-denali-finance-board` | Installments kanban — column tint by `data-board-column` |
| `data-denali-finance-progress` | Installment paid-ratio bar (alpine → forest gradient) |
| `data-denali-date-picker` | Admin + wizard date trigger / calendar popover skin |
| `data-denali-flat-edit-page` | Flat edit page root — pairs with `data-new-tour-wizard` for wizard composite skin under `(app)/` |

## Operator sidebar layout

Follows the shadcn/ui **Header → Content → Footer** split (without importing the full Sidebar provider — operator shell stays workspace-agnostic):

| Region | Element | Scroll |
|--------|---------|--------|
| Header | `data-operator-sidebar-header` · `OperatorBrand` | Fixed |
| Content | `data-operator-sidebar-content` · `[data-operator-nav-link]` list | `overflow-y-auto` on `<ul>` only |
| Footer | `data-operator-sidebar-footer` · `[data-operator-nav-cta]` | Fixed |

Visual language (Denali only): mist gradient surface, forest `--sidebar-primary` active row + filled icon tile, `--shell-sidebar-width: 16.5rem`. Tailwind utilities (`bg-sidebar`, `text-sidebar-foreground`, …) bridge from `@app-tour/design-tokens/shell-bridge.css`.

## Shared patterns (`apps/web/src/admin/patterns/`)

| Component | Role |
|-----------|------|
| `denali-skeleton.tsx` | Shimmer skeleton (Denali CSS only; falls back to shadcn pulse elsewhere) |
| `denali-empty-state.tsx` | Mountain mark + dashed panel + optional CTA |
| `dashboard-kpi-cell.tsx` | KPI tile — `line-clamp-2` label + `data-denali-kpi` / finance variant |
| `dashboard-widget-card.tsx` | Equal-height widget shell (header / body / footer) |
| `page-header.tsx` | Title / description / actions row |

## Primary palette

- Tenant default: `#0f766e` (`workspace-default-tenant-branding.ts`)
- Surfaces: mist `#f4f7f4` page, `#e8efe8` muted
- Dark mode accent: `#5eead4` on forest surfaces `#161b13` / `#1f2620`

### Dark mode cascade

Operator toggle sets `html.dark` **and** flips `ThemeProviderChain`’s inner `div.theme-dark`. `apps/web/app/globals.css` assigns platform blue `#5b9fd4` to `.theme-dark`, which would override body-scoped Denali tokens for all shell children.

Denali dark rules therefore target **both**:

1. `html.dark:has(body[data-workspace-plugin="denali"])` — document root + portals
2. `body[data-workspace-plugin="denali"] .theme-dark` — platform provider subtree inside the shell

Without (2), shadcn `bg-primary` buttons (sidebar CTA) keep platform blue in dark mode even when `body` exposes teal `--primary`.

## Verification

```bash
pnpm --filter @app-tour/workspace-denali test
pnpm --filter @apps/web test -- test/denali-admin-theme.spec.ts
```

Manual: `http://denali.localhost:3000/dashboard` — primary buttons teal-green, not platform blue `#1e5a8e`.

E2E (operator shell):

| ID | Scope |
|----|--------|
| `SMK-P9-DENALI-THEME` | Dashboard CTA — light/dark primary on shadcn buttons |
| `SMK-P9-WIZARD-THEME` | `/tours/new` Wizard Bridge + `ui-primitives` step nav (see [`wizard-experience.md`](wizard-experience.md)) |

Dark branch applies `html.dark` + `.theme-dark` (same DOM writes as the header toggle). Asserts admin `--primary` `#5eead4` and CTA `rgb(94, 234, 212)` — not platform `#5b9fd4`.

```bash
cd apps/web && PW_EXTERNAL_SERVERS=1 PLAYWRIGHT_BASE_URL=http://denali.localhost:3000 \\
  npx playwright test -c playwright.operator.config.ts -g "SMK-P9-DENALI-THEME|SMK-P9-WIZARD-THEME"
```

Unit contracts: `apps/web/test/denali-admin-theme.spec.ts` (bootstrap + CSS bundle), `denali-wizard-theme.spec.ts` (wizard bridge).

Dev DB branding must match `#0f766e` — re-run `pnpm --filter @apps/api run db:seed` if tenant-config still returns legacy `#059669`.

## Closure (phase 7)

| Item | Status |
|------|--------|
| `admin-skin.css` + `interactions.css` + `animations.css` | Shipped in `denali-admin.css` |
| `body[data-workspace-plugin="denali"]` host wiring | `layout.tsx` + `operator-shell` |
| Dark mode dual cascade (html.dark + `.theme-dark`) | `admin-skin.css` |
| Dashboard stagger + card surfaces | `data-denali-animate`, `data-denali-surface` |
| Playwright theme smoke | `SMK-P9-DENALI-THEME`, `SMK-P9-WIZARD-THEME` |
| Urban isolation | `WEB-DENALI-THEME-03`, TH-1 e2e unchanged |
| Dashboard quick actions + skeleton/empty patterns | `DenaliSkeleton`, `DenaliEmptyState`, `data-denali-quick-actions` |
| Modern sidebar rail (Header/Content/Footer + sidebar tokens) | `data-operator-sidebar*`, `data-operator-nav-icon`, `shell-bridge.css` |
| Tours category filter + bark badge | `tour-list-category-logic`, `TourCategoryBadge` — grouped chips (mountain/nature/desert/event) in toolbar; card meta line `data-testid="operator-tours-card-meta"`; cover placeholder when `coverImageUrl` null |
| Bookings inbox zebra + timeline | `data-denali-bookings-inbox`, `BookingActivityTimeline` |

| Header breadcrumb + tenant badge + main scroll shadow | `operator-breadcrumb.tsx`, `data-denali-header-scrolled` on `<main>` scroll |
| `logo-mark.svg` in `packages/workspaces/denali/theme/assets/` | `DenaliLogoMark` fallback when tenant has no uploaded logo — see [`tenant-branding.md`](../tenant-branding.md) |
| Tours category server filter | `GET /tours?category=` ↔ URL `TourListQueryModel.category` |
| Finance alpine KPI + installments board | `finance-skin.css` · overview + dashboard widget + board columns |

Deferred (non-blocking): framer-motion page transitions, Playwright visual snapshot baselines.

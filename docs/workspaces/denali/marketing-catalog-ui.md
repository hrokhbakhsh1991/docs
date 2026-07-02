# Marketing catalog UI — component tree

```yaml
doc_id: DENALI-MARKETING-CATALOG-UI
version: "2026-06-30-v1"
extends: public-catalog.md
apps: [marketing]
phase: P6-1
```

## Scope

Workspace-agnostic **presentation shell** for public tour catalog in `apps/marketing`. Business rules and egress shaping stay in workspace plugins + API; marketing **must not** static-import `@app-tour/workspace-*`.

**Authority:** [public-catalog.md](./public-catalog.md) · P6 theming: [p6-theming-file-tree.md](../../phase-19/p6/p6-theming-file-tree.md)

---

## Route → component tree

```text
app/layout.tsx
  MarketingShell (header, branding, locale switcher)
  └── page routes

app/page.tsx                          → home CTA → /tours
app/tours/page.tsx                    → CatalogTourList
  └── CatalogTourCard (per item)
        └── CatalogTourStats (list)
app/tours/[tourId]/page.tsx           → CatalogTourDetail
  └── CatalogTourStats (detail)
  └── CatalogItinerarySection (when itineraryDays present)
  └── CatalogTourDetailPolicies (when policies/cancellation present)
```

### Pure logic (no JSX)

| Module | Role |
|--------|------|
| `format-catalog-display.ts` | subtitle, description, dates, price formatting |
| `format-catalog-cancellation.ts` | cancellation template helpers (unit tests); detail UI uses `next-intl` ICU in `CatalogTourDetailPolicies` |
| `catalog-itinerary-display-logic.ts` | segment labels, photo list shaping |
| `fetch-catalog-list.ts` / `fetch-catalog-tour.ts` | server upstream fetch |
| `catalog-fetch-options.ts` | Next.js cache + revalidate tags |

### Types

`catalog-types.ts` — `MarketingCatalogCard` extends SDK `PublicCatalogCard` + `UrbanCatalogCardExtensions` (optional `title` for partial API payloads).

Pure meta line: `build-catalog-tour-meta-line.ts` (shared list card + detail).

### SDK resolver registry (ADR-MKT-004)

Marketing calls workspace-sdk resolvers — **no** `if (pluginId === …)` in `apps/marketing`:

| Resolver | Module | Marketing use |
|----------|--------|---------------|
| `resolveCatalogListFeatures` | `resolve-catalog-list-features.ts` | Urban city filter (`data-marketing-city-filter`) |
| `resolveCatalogDetailSections` | `resolve-catalog-detail-sections.ts` | Itinerary / policies visibility |
| `supportsCatalogRegistration` | `resolve-catalog-registration-support.ts` | Register CTA (`data-marketing-register`) — manifest **L2+** (`catalogRegistrationFlow`); no runtime intake registry required in marketing |

Unit tests: `packages/workspace-sdk/test/resolve-catalog-*.spec.ts` (SDK-CAT-*) · registration intake (`catalog-registration-dispatch`, `public-catalog-transport-intake`, `registration-intake.contract`) · enforced in `p6:gate` + `p4:gate` + `guard:public-catalog-m17`.

---

## Layout attributes (P6)

Set in `app/layout.tsx`:

| Attribute | Marketing value |
|-----------|-----------------|
| `data-app-surface` | `marketing` |
| `data-workspace-plugin` | `{bootstrap.pluginId}` |
| `data-tenant-id` | resolved tenant UUID |

Workspace skin CSS scopes on:

```text
body[data-app-surface="marketing"][data-workspace-plugin="denali"]
```

See `packages/workspaces/denali/theme/denali-marketing.css`.

---

## `data-marketing-*` hooks (E2E + smoke)

Stable selectors for Playwright — **do not rename** without updating smoke specs.

### Shell

| Hook | Location |
|------|----------|
| `data-marketing-header` | `marketing-shell.tsx` |
| `data-marketing-brand` | brand link → `/tours` |
| `data-marketing-logo` | tenant logo img |
| `data-marketing-locale-switcher` | header locale toggle |

### Home

| Hook | Location |
|------|----------|
| `data-marketing-home` | `app/page.tsx` main |
| `data-marketing-home-cta` | link → `/tours` |

### List (`/tours`)

| Hook | Location |
|------|----------|
| `data-marketing-catalog` | page main |
| `data-marketing-catalog-header` | list header |
| `data-marketing-catalog-title` | h1 |
| `data-marketing-catalog-grid` | `catalog-tour-list.tsx` ul |
| `data-marketing-catalog-grid-item` | li per tour |
| `data-marketing-catalog-empty` | empty state |
| `data-marketing-catalog-pagination` | load-more nav |
| `data-marketing-city-filter` | Urban city filter form |
| `data-marketing-city-clear` | clear city filter link |

### List card

| Hook | Location |
|------|----------|
| `data-marketing-catalog-card` | `catalog-tour-card.tsx` article |
| `data-marketing-catalog-card-cover` | cover link |
| `data-marketing-catalog-cover` | `catalog-cover-image.tsx` img |
| `data-marketing-catalog-card-title` | h2 |
| `data-marketing-catalog-card-description` | description p |
| `data-marketing-catalog-card-meta` | subtitle + dates line |
| `data-marketing-catalog-card-stats` | stats ul (list) |
| `data-marketing-catalog-card-cta` | view tour link |

### Detail (`/tours/[tourId]`)

| Hook | Location |
|------|----------|
| `data-marketing-catalog-detail-page` | page main wrapper |
| `data-marketing-catalog-tour-detail` | detail article |
| `data-marketing-catalog-detail-back` | back to list |
| `data-marketing-catalog-detail-title` | h1 |
| `data-marketing-catalog-detail-cover` | cover figure |
| `data-marketing-catalog-detail-description` | body description |
| `data-marketing-catalog-detail-meta` | subtitle + dates |
| `data-marketing-catalog-detail-stats` | stats ul (detail) |
| `data-marketing-catalog-itinerary` | itinerary section |
| `data-marketing-catalog-itinerary-day` | per-day article (`={dayNumber}`) |
| `data-marketing-catalog-segment-photos` | segment photo list |
| `data-marketing-catalog-detail-policies` | policies section |
| `data-marketing-catalog-detail-cancellation` | cancellation bullets |
| `data-marketing-register` | registration CTA (**SMK-MKT-03**) → portal [`portal-registration-ui.md`](./portal-registration-ui.md) |

### Errors

| Hook | Location |
|------|----------|
| `data-marketing-error` | `app/error.tsx` |
| `data-marketing-catalog-error` | `app/tours/error.tsx` |
| `data-marketing-not-found` | `app/not-found.tsx` |

---

## Smoke coverage

| ID | Spec | Hooks exercised |
|----|------|-----------------|
| SMK-MKT-01 | `marketing-catalog-smoke.spec.ts` | catalog, header, tour title |
| SMK-MKT-05 | `marketing-urban-catalog-smoke.spec.ts` | urban skin, city filter, no itinerary |
| SMK-MKT-03 | `marketing-catalog-smoke.spec.ts` | tour-detail, register, portal OTP flow |
| Itinerary | same (Denali tour) | itinerary, segment-photos |

Default Playwright base URLs: operator `http://shop.operator.localhost:3002` (`playwright.marketing.config.ts`); urban `http://urban.localhost:3002` (`playwright.marketing-urban.config.ts` · `pnpm run test:smoke:urban`).

---

## Styling rules

| Rule | Detail |
|------|--------|
| No catalog CSS in `app/globals.css` | guest-shell + tailwind import only |
| Workspace skin | `guestThemeStylesheets.marketing` in manifest → generated bootstrap |
| Layout tokens | `--catalog-grid-columns`, `--catalog-detail-max-width` in `denali-marketing.css` |
| Design-system SoT | [`design-system/denali-club/MASTER.md`](../../../design-system/denali-club/MASTER.md) → mapped in `denali-marketing.css` root tokens (`--color-primary`, `--color-accent` CTAs) |
| Primitives | P6: `@app-tour/ui-primitives/input` + `/button` on Urban city filter; nav CTAs stay `Link`/`<a>` + workspace skin |

### CSS duplicate-maintenance policy (Urban + Denali)

`denali-marketing.css` and `urban-marketing.css` intentionally mirror layout selectors (`[data-marketing-catalog-*]`) under `body[data-workspace-plugin="…"]`. **Do not** import workspace skins from `apps/marketing`. When changing catalog layout hooks or grid tokens, update **both** skins in the same PR or document the intentional divergence in this file. A shared `@app-tour/catalog-marketing-layout` partial is deferred until a third workspace lands.

---

## Roadmap status (2026-06-30)

Enterprise hardening **complete** for Denali + Urban. All items below landed:

| Item | Status |
|------|--------|
| Track A presentation fields (SDK resolvers + specs SDK-CAT-*) | Done |
| Urban marketing skin + registry bootstrap | Done |
| Urban exposure on catalog API | Done |
| Denali skin ↔ denali-club MASTER | Done |
| SMK-MKT-05 urban E2E | Done |
| Denali exposure DB-less smoke fallback | Done |
| M17 guard + tracked env templates (dynamic count) | Done |

Deferred (non-blocker): Track B `catalogUi` manifest · shared CSS partial until workspace #3.

---

## Verify

### Local dev (Denali catalog from Postgres)

Guest BFF API base is shared via `@app-tour/guest-surface-host` (`resolveTourOpsApiBaseUrl`). In **`NODE_ENV=development`**, when `TOUR_OPS_API_URL` is unset, marketing defaults to `http://127.0.0.1:3001` (same chain as admin branding fetch). Production still requires explicit `TOUR_OPS_API_URL` (G-ENV-04).

1. Postgres up: `docker compose -f infra/docker-compose.yml up -d postgres`
2. API: `cd apps/api && pnpm run dev` (`.env` + `.env.local` with `DATABASE_URL`)
3. Marketing: `pnpm --filter @apps/marketing run dev` — optional tracked `apps/marketing/.env.local.example` → `.env.local`
4. Browse by **host label** (tenant from `phase-43-host-tenant-ids`, plugin from `resolve-dev-plugin-id`):

| Host | Workspace |
|------|-----------|
| `http://denali.localhost:3002/tours` | Denali tenant `…000003` |
| `http://operator.localhost:3002/tours` | Operator smoke `…000014` |
| `http://urban.localhost:3002/tours` | Urban `…000004` |

Tours appear only when canonical `publishStatus === "active"` (`isDenaliTourPublished` / workspace equivalent).

```bash
pnpm run generate:workspace-registry   # after workspace.manifest guestThemeStylesheets change
pnpm run p6:gate                       # daily · includes M17 + SDK-CAT + G-ENV
pnpm run p4:gate                       # Phase 17 club surfaces · same M17/SDK/G-ENV chain
pnpm --filter @apps/marketing run test -- test/guest-theme-stack.spec.ts
pnpm run guard:public-catalog-m17      # dynamic count · also inside p6:gate
pnpm --filter @apps/marketing run test:smoke   # operator · explicit YES
pnpm --filter @apps/marketing run test:smoke:urban   # urban.localhost · explicit YES
```

Copy dev overrides from tracked `apps/marketing/.env.local.example` → `.env.local` (optional; dev API defaults via `@app-tour/guest-surface-host`).

**Registration chain (SMK-MKT-03):** CTA from [marketing-catalog-ui.md](./marketing-catalog-ui.md) (`data-marketing-register`) → portal [portal-registration-ui.md](./portal-registration-ui.md) hooks.

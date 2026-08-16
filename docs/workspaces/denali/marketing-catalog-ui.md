# Marketing catalog UI — component tree

```yaml
doc_id: DENALI-MARKETING-CATALOG-UI
version: "2026-08-16-v12"
extends: public-catalog.md
apps: [marketing]
phase: P6-1
```

## Scope

Workspace-agnostic **presentation shell** for public tour catalog in `apps/marketing`. Business rules and egress shaping stay in workspace plugins + API; marketing **must not** static-import `@app-tour/workspace-*`.

**Authority:** [public-catalog.md](./public-catalog.md) · P6 theming: [p6-theming-file-tree.md](../../phase-19/p6/p6-theming-file-tree.md)

---

## PR-21 Catalog discovery shell (2026-07-04) — active

**Goal:** Modern `/tours` page — editorial cards + user filters aligned with Denali admin egress (`PublicCatalogCard`). **PR-22** adds server-side list filters on `GET /denali/catalog`.

### Admin required → list card (Denali)

| Wizard / publish gate | Canonical path               | `PublicCatalogCard`                   | Card UI (PR-21)             |
| --------------------- | ---------------------------- | ------------------------------------- | --------------------------- |
| Tour kind             | `category`                   | `category`, `listSubtitle`            | Category badge on cover     |
| Title                 | `title`                      | `title`                               | H2                          |
| Destination           | `destinationId`              | — (detail-only today)                 | —                           |
| Start                 | `startDateTime`              | `departureAt`                         | Dates row                   |
| End (multi-day)       | `endDateTime`                | `endAt`                               | Date range                  |
| Capacity              | `capacityMax`                | `totalCapacity`, `spotsRemaining`     | Spots pill / sold-out badge |
| Short description     | `program.shortDescription`   | `listDescription`, `shortDescription` | Body copy (clamp)           |
| Cover                 | `photos[0]`                  | `coverImageUrl`                       | 16:9 media + fallback (`/home/fallback-tour-cover.webp`; smoke `cdn.example` URLs ignored — [public-catalog.md](./public-catalog.md) § Photo egress) |
| Price                 | `pricing.basePricePerPerson` | `priceAmount`, `showListPrice`        | Price chip on cover         |
| Difficulty            | `program.difficultyLevel`    | `difficultyLevel`                     | Stat pill + filter          |
| Fitness               | `participants.fitnessLevel`  | `fitnessLevel`                        | Stat pill + filter          |
| Transport             | `transport.mode`             | `transport`                           | Detail / registration only  |
| Policies              | `policies.*`                 | `policiesText`, cancellation fields   | Detail only                 |

Exposure redaction (`denali-catalog-exposure-bindings`) may hide mapped fields — card omits empty rows (fail-soft).

### Filter pipeline (URL → API or client)

**Denali (PR-22):** When `resolveCatalogListFeatures().serverListFilters` includes a param, marketing forwards it on `GET /denali/catalog` / BFF `GET /api/catalog`; Denali applies filter + sort on the full published set **before** cursor pagination. Marketing **also** runs `filterMarketingCatalogItems` + `sortMarketingCatalogItems` on the fetched batch (idempotent safety net when API/cache is stale). **Fetch limit:** default **20** per cursor page when Denali server owns the active narrowing filters; widen to **50** only when a narrowing filter is **client-only** (Urban/guest-club). Filtered requests use `cache: no-store`.

**Pagination (PR-24):** Cursor-based pages (`?cursor=<tourId>`) replace the list batch (not infinite append). `load-more` and `first-page` links use `resolveMarketingLocalePath("/tours")`. Active filter pills and filter form omit `cursor` (reset to page 1). Results line uses `list.resultsCountPage` when `cursor` or `nextCursor` is set. Pagination chrome (`[data-marketing-catalog-pagination]`, `[data-marketing-catalog-pagination-next]`) renders **only** when `loadMoreHref != null` or `firstPageHref != null` (`apps/marketing/app/tours/page.tsx`). A one-page catalog (typical smoke: four published tours, no `nextCursor`) has **no** «نمایش بیشتر» control.

**Empty filtered copy (BUG-15):** `list.emptyFiltered` is shown when the current filter set matches zero cards. That string must tell the guest to **clear filters** (visible controls: «بازنشانی» / Reset + «اعمال فیلترها»). It must **not** mention «نمایش بیشتر» / “load more” — that control is absent unless pagination exists. Load-more stays its own link (`list.loadMore` / `list.loadMoreSearch` when the empty page still has `nextCursor`). `list.filterScopeNotice` already mentions load-more **only** when `clientFiltersActive && nextCursor != null` (`showFilterScopeNotice`); do not duplicate that sentence into `emptyFiltered`.

**Denali category UX (PR-23):** Marketing shows two admin-aligned families only — **کوهنوردی** (`category=mountain`) and **طبیعت‌گردی** (`category=nature`) — no تک‌روزه/چندروزه chips. Server + client match `mountain_*` / `nature_*` slugs. Difficulty select uses wizard range **1–10** (step 0.5); fitness uses `low` / `medium` / `high`.

**Urban / guest-club:** Only `city` is server-side; other filters run client-side on the fetched batch (fetch limit 50 when client filters active — PR-21.1).

| Query               | Denali server                                                           | Client fallback                     |
| ------------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `q`                 | Title, category slug, description (Latin; Persian label search not yet) | Same on current page batch          |
| `category`          | Exact slug or `mountain`/`nature` family                                | Same (family prefix match)          |
| `difficulty`        | Snapped `difficultyLevel` (0.5 step)                                    | Same                                |
| `fitness`           | Exact `fitnessLevel`                                                    | Same                                |
| `availability=open` | `spotsRemaining > 0` or unknown capacity                                | Same                                |
| `sort`              | `newest`, `departure_asc`/`desc`, `price_asc`/`desc`, `difficulty_asc`  | Same                                |
| `cursor`            | API pagination (preserved in load-more)                                 | Same                                |
| `city`              | —                                                                       | Urban server filter only (SDK gate) |

**Modules:** `catalog-list-query.ts`, `build-catalog-list-fetch-query.ts`, `catalog-tour-filter-bar.tsx`, `derive-catalog-filter-options.ts`, `apply-marketing-catalog-list-pipeline.ts`, `filter-marketing-catalog-items.ts`, `sort-marketing-catalog-items.ts`.

**Hooks:** `data-marketing-catalog-toolbar`, `data-marketing-catalog-filters`, `data-marketing-catalog-category-chips`, `data-marketing-catalog-active-filters`, `data-marketing-catalog-results`, `data-marketing-catalog-card-media`, `data-marketing-catalog-card-category`, `data-marketing-catalog-card-dates`, `data-marketing-catalog-card-price`, `data-marketing-catalog-clear-filters`.

**SEO (PR-22.1):** Any active filter query (`q`, `category`, `difficulty`, `fitness`, `availability`, `sort`, `city`) sets `robots: noindex` via `catalogFiltersToNoindexSearchParams()` + manifest `noindexQueryParams`.

### Verify

fa `/tours` — filter bar, localized category chips, Persian digits on stats; SMK-MKT-01 unchanged selectors on card root/title/cta.

### Risks and mitigations (PR-21.1 → PR-22)

| Risk                                      | Mitigation                                                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client filters only see current API page  | **PR-22:** Denali `GET /denali/catalog` applies `q`/`category`/… **before** cursor slice; marketing passes params when `serverListFilters` manifest lists them |
| Urban / guest-club without server filters | Client pipeline + optional fetch limit 50 (PR-21.1)                                                                                                            |
| Active URL filter missing from dropdown   | `deriveCatalogFilterOptions` merges active filters                                                                                                             |
| Load-more dropped filters                 | `catalogFiltersToQueryInput` rebuilds query                                                                                                                    |
| Duplicate price/capacity on card          | `CatalogTourStats omitOverlayFields`                                                                                                                           |
| BFF list route missing PR-22 params       | **PR-22.1:** `buildCatalogListFetchQuery` shared by `fetch-catalog-list.ts` + `app/api/catalog/route.ts`                                                       |
| Filtered list pages indexed               | **PR-22.1:** manifest `noindexQueryParams` + `catalogFiltersToNoindexSearchParams()` on `/tours` metadata                                                      |
| Dismiss filter keeps stale cursor         | **PR-22.1:** `buildCatalogListQueryWithoutFilters` omits `cursor` when rebuilding pill href                                                                    |
| Persian label search                      | Still slug/title/description only until localized search index                                                                                                 |

---

## Route → component tree

```text
app/layout.tsx
  MarketingShell (header, branding, locale switcher)
  └── page routes

app/page.tsx                          → home CTA → /tours
app/tours/page.tsx                    → CatalogTourFilterBar + CatalogTourList
  └── CatalogTourFilterBar (GET filters, category chips, active pills)
  └── CatalogTourList
        └── CatalogTourCard (per item)
              └── CatalogTourStats (list, omitOverlayFields)
app/api/catalog/route.ts              → BFF passthrough (same query builder as fetch)
app/tours/[tourId]/page.tsx           → CatalogTourDetail (PR-D — see § PR-D)
  └── CatalogTourDetailHeroGallery (Denali, PR-D6 mosaic) · overflow → CatalogTourDetailGallery
  └── intro: back link + hero only (no visible breadcrumb — JSON-LD breadcrumb retained)
  └── header: title + optional destination
  └── CatalogTourDetailFacts (PR-D2 bento)
  └── CatalogTourDetailRegisterCta · CatalogTourDetailBookingRail · CatalogTourDetailStickyBar
  └── CatalogTourDetailJumpNav
  └── CatalogTourDetailReadiness · Logistics · GearServices · RegisterPreview · Faq
  └── CatalogItinerarySection · CatalogTourDetailPolicies
```

### Pure logic (no JSX)

| Module                                            | Role                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `format-catalog-display.ts`                       | subtitle, description, dates, price formatting. **ED-CURR-MKT-01:** Denali `pluginId` + `IRR` display is تومان/toman (same integer; no ×10). Other workspaces / ISO codes stay `Intl` currency style. JSON-LD `offers.priceCurrency` remains `IRR`. |
| `format-catalog-cancellation.ts`                  | cancellation template helpers (unit tests); detail UI uses `next-intl` ICU in `CatalogTourDetailPolicies` |
| `catalog-itinerary-display-logic.ts`              | segment labels, photo list shaping                                                                        |
| `fetch-catalog-list.ts` / `fetch-catalog-tour.ts` | server upstream fetch                                                                                     |
| `catalog-fetch-options.ts`                        | Next.js cache + revalidate tags                                                                           |

### Types

`catalog-types.ts` — `MarketingCatalogCard` extends SDK `PublicCatalogCard` + `UrbanCatalogCardExtensions` (optional `title` for partial API payloads).

Pure meta line: `build-catalog-tour-meta-line.ts` (shared list card + detail).

### SDK resolver registry (ADR-MKT-004)

Marketing calls workspace-sdk resolvers — **no** `if (pluginId === …)` in `apps/marketing`:

| Resolver                          | Module                                    | Marketing use                                                                                                                             |
| --------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveGuestLandingFeatures`     | `resolve-guest-landing-features.ts`       | Home `/` variant (full vs minimal) + section gates                                                                                        |
| `resolveCatalogListFeatures`      | `resolve-catalog-list-features.ts`        | Urban city filter; Denali `serverListFilters` + marketing fetch query                                                                     |
| `catalogListSupportsServerFilter` | `resolve-catalog-list-features.ts`        | Gate upstream query params in `build-catalog-list-fetch-query.ts`                                                                         |
| `resolveCatalogDetailSections`    | `resolve-catalog-detail-sections.ts`      | Itinerary / policies visibility                                                                                                           |
| `supportsCatalogRegistration`     | `resolve-catalog-registration-support.ts` | Register CTA (`data-marketing-register`) — manifest **L2+** (`catalogRegistrationFlow`); no runtime intake registry required in marketing |
| `tryResolveCatalogRegistrationForTourApiPath` | `resolve-catalog-registration-for-tour-api-path.ts` | Phase 3 PDP self-gate — manifest `GET /{ws}/registrations/for-tour/:tourId` only (Denali on trunk). Returns `null` when the workspace has no for-tour route — marketing must not register intake plugins |

Unit tests: `packages/workspace-sdk/test/resolve-catalog-*.spec.ts` (SDK-CAT-\*) · registration intake (`catalog-registration-dispatch`, `public-catalog-transport-intake`, `registration-intake.contract`) · enforced in `p6:gate` + `p4:gate` + `guard:public-catalog-m17`.

### Phase 3 PDP CTA vs logged-in / already-registered (2026-08-16)

Authority: [PCMS-001 §5.3](../../standards/member-session-portal-authority.mdoc) · [portal-member-login-modal.mdoc](../../phase-19/portal-member-login-modal.mdoc) §16 Phase 3 DoD.

**Problem:** After portal OTP the member returns to marketing (custom apex cookie share). Header already swapped Sign-in → profile chip, but the tour PDP still rendered «ثبت‌نام» + «قبلاً ثبت‌نام کرده‌اید؟ ورود» even when the member had an active self booking.

**Decision:** Shape CTAs in marketing **SSR** from the existing read-only session probe + optional API for-tour. Do not add cookie write or `app/api/me/*` / `app/api/public-auth/*`. Phase 5 hosts OTP on marketing via Portal-origin transport ([PCMS-001 §5.5](../../standards/member-session-portal-authority.mdoc)); `[data-marketing-register]` still navigates to portal register.

| Mode | When | Primary | Secondary | i18n |
| ---- | ---- | ------- | --------- | ---- |
| `guest` | Cookie missing / invalid / tenant bind fail | `data-marketing-register` → `resolveWebRegistrationUrl` | `data-marketing-tour-sign-in` → marketing modal (href fallback `resolveWebRegistrationLoginUrl`) | `detail.register` / `detail.signInToRegister` |
| `member-continue` | Session readable; for-tour `self` null, path missing, or fetch error | `data-marketing-register` → register URL **without** `auth=login` | none | `detail.continueRegister` |
| `member-self` | Session readable; for-tour returns `self.id`; GSH builds detail URL | `data-marketing-view-registration` → `/me/registrations/{id}` | `data-marketing-register` + `data-marketing-register-another` when `canRegister` | `detail.viewMyRegistration` / `detail.registerAnotherGuest` |

**Skin (Denali):** `[data-marketing-view-registration]` uses the same accent primary button as `[data-marketing-register]`. `[data-marketing-register-another]` is excluded from that button (`:not([data-marketing-register-another])`) and shares the underlined secondary stack with `[data-marketing-tour-sign-in]` (`36-mkt-tour-sign-in-cta.css`). Sticky wraps both in `[data-marketing-catalog-detail-sticky-cta]`. Login modal chrome is `37-mkt-login-modal.css` (imported last).

**Sold-out:** guest / member-continue still show sold-out copy. Member-self still shows view-registration (the booking exists); register-another is omitted when `canRegister` is false.

**Modules:** `resolve-marketing-tour-detail-cta.ts` (pure) · `resolve-marketing-tour-detail-cta.server.ts` (session + fetch) · `fetch-marketing-member-self-registration-for-tour.server.ts` · `catalog-tour-detail-register-cta.tsx` (shared by booking rail **and** sticky bar — sticky must not duplicate href logic). Page `app/tours/[tourId]/page.tsx` resolves the model once and passes it down.

### Phase 4 Portal public-auth CORS (2026-08-16)

Authority: [PCMS-001 §5.4](../../standards/member-session-portal-authority.mdoc) · [portal-member-login-modal.mdoc](../../phase-19/portal-member-login-modal.mdoc) §16 Phase 4 DoD.

Marketing remains href + read-only cookie chip + Phase 3 PDP CTA **until Phase 5**. Portal answers credentialed CORS on `/api/public-auth/*` from the **paired** marketing origin. Marketing must not import `createPortalSameOriginGuestAuthTransport` (Portal-only). Phase 5 **does** import `GuestAuthHostProvider` + `tryCreatePortalOriginGuestAuthTransport`.

**For-tour headers (mirror portal BFF, not identity/me-only):** `Authorization: Bearer` + `x-tenant-id` + `x-authenticated-tenant-id` + `x-user-id` + `x-actor-role` + `x-membership-status: ACTIVE` + `x-forwarded-host`. `resolveWorkspacePublicAuthFromRequest` does **not** decode JWT; actor id must be sent as `x-user-id` from the already-validated marketing session.

### Phase 5 Marketing Portal-origin login modal (2026-08-16)

Authority: [PCMS-001 §5.5](../../standards/member-session-portal-authority.mdoc) · [portal-member-login-modal.mdoc](../../phase-19/portal-member-login-modal.mdoc) §16 Phase 5 DoD.

Marketing hosts the shared phone/OTP/profile steps in `[data-marketing-login-modal]`. Transport `fetch`es the GSH portal public origin `/api/public-auth/*` with credentials. Cookie write stays Portal. After success, marketing reloads so SSR header + PDP CTA can see the member.

| Surface | Phase 5 | Fallback (no-JS / no portal origin) |
| ------- | ------- | ----------------------------------- |
| Header `[data-marketing-header-sign-in]` | **Navigate** to Portal `/login?portalReturn=/me/registrations` (page OTP). Not `MarketingLoginModalTrigger`. | Same `href` — no client intercept |
| PDP `[data-marketing-tour-sign-in]` | Client trigger opens marketing modal; stay on `/tours/{id}` after reload | `href` = portal `register?auth=login` |
| `[data-marketing-register]` | **Unchanged** — portal `/catalog/{id}/register` | — |

`MarketingLoginModalProvider` remains in `app/layout.tsx` so PDP (and a **future** marketing login host) can open `[data-marketing-login-modal]` without a second provider. `host="header"` on that dialog is reserved — do not attach it to chrome Sign in until product asks.

**Skin (Denali):** `37-mkt-login-modal.css` imported last from `denali-marketing.css`. Scope `body[data-app-surface="marketing"][data-workspace-plugin="denali"]` + `data-marketing-login-modal*`. Do not reuse `data-portal-login-modal` (portal CSS is `body[data-app-surface="portal"]`).

---

## Layout attributes (P6)

Set in `app/layout.tsx`:

| Attribute               | Marketing value        |
| ----------------------- | ---------------------- |
| `data-app-surface`      | `marketing`            |
| `data-workspace-plugin` | `{bootstrap.pluginId}` |
| `data-tenant-id`        | resolved tenant UUID   |

Workspace skin CSS scopes on:

```text
body[data-app-surface="marketing"][data-workspace-plugin="denali"]
```

See `packages/workspaces/denali/theme/denali-marketing.css`.

---

## `data-marketing-*` hooks (E2E + smoke)

Stable selectors for Playwright — **do not rename** without updating smoke specs.

### Shell

| Hook                             | Location              |
| -------------------------------- | --------------------- |
| `data-marketing-header`          | `marketing-shell.tsx` |
| `data-marketing-brand`           | brand link → `/`      |
| `data-marketing-logo`            | tenant logo img       |
| `data-marketing-locale-switcher` | header locale toggle (only when `guestLanding.shellChrome.localeSwitcher === true`) |
| `data-marketing-header-sign-in`  | guest Sign in — navigates to Portal `/login` (`href={portalMemberLoginUrl}`; not the marketing modal) |
| `data-marketing-header-member`   | authenticated profile chip → portal `/me/profile` |
| `data-marketing-header-member-meta` | name + account hint stack |
| `data-marketing-header-member-avatar-wrap` | avatar ring container |
| `data-marketing-member-authenticated` | shell root when member session matches tenant |
| `data-marketing-header-cta`      | sticky header tours CTA (only when `shellChrome.headerToursCta` and nav has no `tours` link) |

**Denali club header chrome (2026-07-14):** Persian-only public surface — `shellChrome.localeSwitcher: false`. Primary nav already includes `nav.tours` via `guestCrossSurfaceNav`; redundant `data-marketing-header-cta` is off (`headerToursCta: false`). Toolbar keeps `data-marketing-header-sign-in` as a Portal `/login` link (`resolvePortalMemberLoginUrl`). The marketing OTP modal is PDP-only (`data-marketing-tour-sign-in`).

### Home (`/`)

| Hook                                            | Location                                               |
| ----------------------------------------------- | ------------------------------------------------------ |
| `data-marketing-home`                           | `app/page.tsx` main                                    |
| `data-marketing-home-hero`                      | hero section                                           |
| `data-marketing-home-title`                     | hero h1                                                |
| `data-marketing-home-lead`                      | hero lead                                              |
| `data-marketing-home-cta`                       | primary CTA → `/tours`                                 |
| `data-marketing-home-search`                    | hero GET search form → `/tours?q=`                     |
| `data-marketing-home-featured`                  | featured bento (same catalog sort as latest)           |
| `data-marketing-home-section-header-row`        | shared PR-25 title + view-all grid row (featured/latest/gallery) |
| `data-marketing-home-section-view-all`          | shared «همه تورها» pill (`HomeSectionViewAllLink`)     |
| `data-marketing-home-featured-header-row`       | title + view-all row (PR-20N; also `section-header-row`) |
| `data-marketing-home-featured-view-all`         | «همه تورها» link (also `section-view-all`)             |
| `data-marketing-home-featured-lead`             | section lead under header                              |
| `data-marketing-home-featured-bento`            | bento grid container (card sheet)                      |
| `data-marketing-home-featured-card`             | per-tour card in featured bento                        |
| `data-marketing-home-featured-card-body`        | caption stack / pick text column                       |
| `data-marketing-home-featured-cta`              | flagship «مشاهده برنامه»                               |
| `data-marketing-home-featured-picks-list`       | supporting picks stack                                 |
| `data-marketing-home-latest`                    | latest published tours block                           |
| `data-marketing-home-latest-header-row`       | title + view-all row (PR-25)                           |
| `data-marketing-home-latest-view-all`         | «همه تورها» link                                       |
| `data-marketing-home-latest-lead`             | section lead under header row                          |
| `data-marketing-home-latest-row`                | horizontal scroll (mobile) / grid (≥640px) container   |
| `data-marketing-home-latest-card`               | per-tour card in latest row                            |
| `data-marketing-home-latest-cover`              | 16:9 cover figure (`CatalogCoverImage` or placeholder) |
| `data-marketing-home-latest-meta`               | tour date/location meta line                           |
| `data-marketing-home-latest-price`              | formatted price line                                   |
| `data-marketing-home-categories`                | category explorer from catalog `category`              |
| `data-marketing-home-category-chip`             | link → `/tours?category=`                              |
| `data-marketing-home-destinations`              | static destination cards (i18n seed)                   |
| `data-marketing-home-destination-card`          | per-destination article                                |
| `data-marketing-brand-title`                    | shell brand display name                               |
| `data-marketing-home-trust`                     | trust / branding block                                 |
| `data-marketing-home-why`                       | Why Denali bento (4 tiles)                             |
| `data-marketing-home-journey`                   | tour journey timeline                                  |
| `data-marketing-home-testimonials`              | participant quote cards                                |
| `data-marketing-home-testimonial-card-featured` | first quote — hero pull-quote span (PR-20K)            |
| `data-marketing-home-gallery`                   | cinematic bento mosaic (PR-20L)                        |
| `data-marketing-home-gallery-header-row`        | title + view-all row (PR-25)                           |
| `data-marketing-home-gallery-view-all`          | «همه تورها» link                                       |
| `data-marketing-home-gallery-lead`              | section lead under header row                          |
| `data-marketing-home-gallery-item-primary`      | dominant hero tile                                     |
| `data-marketing-home-gallery-support`           | supporting bento cluster                               |
| `data-marketing-home-gallery-link` / `-caption` | overlay link + title/CTA                               |
| `data-marketing-home-equipment`                 | static gear checklist                                  |
| `data-marketing-home-blog`                      | blog teaser stub (CMS-gated)                           |
| `data-marketing-home-jsonld`                    | ItemList JSON-LD on `/`                                |
| `data-marketing-home-faq`                       | FAQ accordion (`#faq`) + FAQPage JSON-LD               |
| `data-marketing-home-final-cta`                 | bottom CTA band                                        |
| `data-marketing-nav-drawer`                     | mobile nav `<details>` (shell)                         |
| `data-marketing-nav-drawer-toggle`              | drawer summary control                                 |
| `data-marketing-nav-drawer-panel`               | drawer link panel                                      |
| `data-marketing-header-cta`                     | sticky header CTA (full landing, mobile)               |
| `data-marketing-skip-link`                      | skip to `#main-content` (full landing)                 |
| `data-marketing-footer`                         | site footer (4 columns + newsletter stub)              |

Spec: [`marketing-landing.mdoc`](./marketing-landing.mdoc) v7 · smoke: SMK-MKT-HOME-01..03,05,06 · unit: HOME-UNIT-01..08 · SDK: SDK-HOME-01..03

### List (`/tours`)

| Hook                                      | Location                                                     |
| ----------------------------------------- | ------------------------------------------------------------ |
| `data-marketing-catalog`                  | `<main>` list page root (`/tours`) — `--catalog-page-padding-*`, max-width 72rem |
| `data-marketing-catalog-header`           | list header                                                  |
| `data-marketing-catalog-title`            | h1                                                           |
| `data-marketing-catalog-lead`             | list lead (PR-21)                                            |
| `data-marketing-catalog-toolbar`          | filter bar wrapper (PR-21)                                   |
| `data-marketing-catalog-filters`          | GET filter form (PR-21)                                      |
| `data-marketing-catalog-category-chips`   | category chip row (PR-21)                                    |
| `data-marketing-catalog-category-chip`    | per-category link (PR-21)                                    |
| `data-marketing-catalog-results`          | filtered count (PR-21)                                       |
| `data-marketing-catalog-filter-notice`    | page-local filter scope warning (PR-21.1; Urban/client-only) |
| `data-marketing-catalog-active-filters`   | dismissible active filter pills (PR-22.1)                    |
| `data-marketing-catalog-active-filter`    | per-filter pill link (`-id=` slug)                           |
| `data-marketing-catalog-clear-filters`    | reset all filters (PR-21)                                    |
| `data-marketing-catalog-grid`             | `catalog-tour-list.tsx` ul                                   |
| `data-marketing-catalog-grid-item`        | li per tour                                                  |
| `data-marketing-catalog-empty`            | empty state                                                  |
| `data-marketing-catalog-pagination`       | load-more / first-page nav (PR-24)                           |
| `data-marketing-catalog-pagination-next`  | load-more link                                               |
| `data-marketing-catalog-pagination-first` | back to first page (when `cursor` set)                       |
| `data-marketing-city-filter`              | Urban city filter form                                       |
| `data-marketing-city-clear`               | clear city filter link                                       |
| `data-marketing-catalog-filter-active`    | active q/category filter label on list                       |

### List card

| Hook                                      | Location                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `data-marketing-catalog-card`             | `catalog-tour-card.tsx` article                                            |
| `data-marketing-catalog-card-media`       | cover figure + price/scarcity overlays (PR-21)                             |
| `data-marketing-catalog-card-cover`       | cover link                                                                 |
| `data-marketing-catalog-cover`            | `catalog-cover-image.tsx` img                                              |
| `data-marketing-catalog-card-category`    | localized category pill in card body (below title)                         |
| `data-marketing-catalog-card-price`       | price chip on cover (PR-21)                                                |
| `data-marketing-catalog-card-spots`       | scarcity / sold-out badge (PR-21)                                          |
| `data-marketing-catalog-card-dates`       | departure date line (PR-21)                                                |
| `data-marketing-catalog-card-title`       | h2                                                                         |
| `data-marketing-catalog-card-summary`     | at-a-glance line: duration · difficulty · fitness · capacity (Denali list) |
| `data-marketing-catalog-card-description` | Urban fallback body copy                                                   |
| `data-marketing-catalog-card-meta`        | subtitle + dates line (detail)                                             |
| `data-marketing-catalog-card-stats`       | stats ul (detail; removed from Denali list card)                           |
| `data-marketing-catalog-card-cta`         | view tour link                                                             |

### Detail (`/tours/[tourId]`)

| Hook                                         | Location                                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `data-marketing-catalog-detail-page`         | `<main>` detail page root — `--catalog-page-padding-*`, max-width 64rem |
| `data-marketing-catalog-tour-detail`         | detail article                                                                                        |
| `data-marketing-catalog-breadcrumb-nav`      | breadcrumb `<nav>` (`catalog-tour-breadcrumb.tsx`)                                                    |
| `data-marketing-catalog-breadcrumb-list`     | breadcrumb `<ol>`                                                                                     |
| `data-marketing-catalog-breadcrumb-home`     | home crumb link                                                                                       |
| `data-marketing-catalog-breadcrumb-tours`    | list crumb link                                                                                       |
| `data-marketing-catalog-breadcrumb-current`  | current tour title (`aria-current="page"`)                                                            |
| `data-marketing-catalog-detail-back`         | back to list (hidden ≤767px — breadcrumb + shell nav cover exit)                                      |
| `data-marketing-catalog-detail-title`        | h1                                                                                                    |
| `data-marketing-catalog-detail-cover`        | cover figure                                                                                          |
| `data-marketing-catalog-detail-description`  | body description                                                                                      |
| `data-marketing-catalog-detail-meta`         | subtitle + dates                                                                                      |
| `data-marketing-catalog-detail-stats`        | stats ul (detail)                                                                                     |
| `data-marketing-catalog-itinerary`           | itinerary section                                                                                     |
| `data-marketing-catalog-itinerary-day`       | per-day article (`={dayNumber}`)                                                                      |
| `data-marketing-catalog-segment-photos`      | segment photo list (reachable https only — smoke `cdn.example` omitted, BUG-3)                      |
| `data-marketing-catalog-segment-photos-empty` | ED-PHOTO-EMPTY-01 — muted empty copy when a segment has no reachable `photoUrls` (day still renders) |
| `data-marketing-catalog-detail-policies`     | policies section                                                                                      |
| `data-marketing-catalog-detail-cancellation` | cancellation bullets                                                                                  |
| `data-marketing-register`                    | registration CTA (**SMK-MKT-03**) → portal [`portal-registration-ui.md`](./portal-registration-ui.md) |
| `data-marketing-tour-sign-in`                | guest-only secondary — **PDP marketing login modal** (href fallback portal `register?auth=login`; Phase 3: omitted when member session is readable) |
| `data-marketing-view-registration`           | member-self primary → portal `/me/registrations/{id}` |
| `data-marketing-register-another`            | member-self secondary → portal `/catalog/{id}/register` (no `auth=login`) |
| `data-marketing-tour-detail-cta-mode`        | `guest` \| `member-continue` \| `member-self` on CTA wrappers |

### Errors

| Hook                              | Location                                      | Copy |
| --------------------------------- | --------------------------------------------- | ---- |
| `data-marketing-error`            | `app/error.tsx`                               | generic error |
| `data-marketing-catalog-error`    | `app/tours/error.tsx`                         | catalog load failure |
| `data-marketing-not-found`        | both 404 trees (shared smoke hook)            | — |
| `data-marketing-page-not-found`   | `app/not-found.tsx`                           | `catalog.pageNotFound` — **page** missing |
| `data-marketing-tour-not-found`   | `app/tours/[tourId]/not-found.tsx`            | `catalog.notFound` — **tour** unpublished / missing |

**404 split (BUG-16):** Club hosts call `notFound()` on `/about`, `/pricing`, `/contact` (WRS platform-mother-only; do **not** publish club stubs). Those routes have no nested `not-found.tsx`, so the **root** tree runs: heading «صفحه یافت نشد», body that the page does not exist on this club, CTA home (`/`), document-title segment `catalog.pageNotFound.metadataTitle` → layout template `صفحه یافت نشد — {siteName}`. `/tours/{id}` still calls `notFound()` when `fetchCatalogTour` is null; the **segment** tree keeps tour copy («تور یافت نشد» / unpublished) and CTA `/tours`. SMK-MKT-14 continues to assert `[data-marketing-not-found]` on draft PDP. Mother host of the three informational routes still renders `MaintenancePage` — unchanged.

---

## Smoke coverage

| ID                        | Spec                                    | Hooks exercised                                                            |
| ------------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| SMK-MKT-HOME-01..03,05,06 | `marketing-home-smoke.spec.ts`          | home hero, latest (conditional), trust, final-cta, mobile, urban isolation |
| _(HOME-04)_               | `home-fail-soft.spec.ts`                | unit only — empty latest block (not E2E)                                   |
| SMK-MKT-01                | `marketing-catalog-smoke.spec.ts`       | catalog, header, toolbar, tour title                                       |
| SMK-MKT-16                | same                                    | server category filter, active pill dismiss (PR-22)                        |
| SMK-MKT-05                | `marketing-urban-catalog-smoke.spec.ts` | urban skin, city filter, no itinerary                                      |
| SMK-MKT-03                | `marketing-catalog-smoke.spec.ts`       | tour-detail, register, portal OTP flow                                     |
| SMK-MKT-16                | same                                    | PR-22 category filter + active pill dismiss                                |
| SMK-MKT-17                | `marketing-seo-pagination.spec.ts`      | filtered list `noindex, follow` (PR-22.1)                                  |
| Itinerary                 | same (Denali tour)                      | itinerary, segment-photos                                                  |

Default Playwright base URLs: operator `http://operator.localhost:3002` (`playwright.marketing.config.ts`); urban `http://urban.localhost:3002` (`playwright.marketing-urban.config.ts` · `pnpm run test:smoke:urban`); home `/` iPhone 13 (`playwright.marketing-home.config.ts` · `pnpm run test:smoke:home`).

---

## PR-D Tour detail PDP — outdoor/hiking (2026-07-04) — planned

**Goal:** `/tours/[tourId]` as a **conversion + outdoor decision-support PDP** for Denali mountain/nature tours — not a generic travel stub. Layout/conversion (PR-D1/D2) ships first without API changes; outdoor-critical content (PR-D2b–D5) requires **doc-first** egress on `PublicCatalogCard` + exposure binding fixes in `packages/workspaces/denali`.

**Authority chain:** wizard fields → `toDenaliCatalogCard` → exposure redaction → marketing RSC (no `@app-tour/workspace-*` imports in marketing).

**Design inputs:** industry PDP order (hero → facts → CTA → itinerary → logistics → policies); ui-ux-pro-max **UX checklist only** (touch targets, sticky padding, smooth scroll, color+text) — **not** skill default colors/fonts/motion.

### Current baseline (pre–PR-D)

Linear stack: breadcrumb → back → title → cover → shortDescription → meta → stats ul → itinerary → policies → single sticky CTA. Missing: above-fold CTA, outdoor metrics, logistics/map, gear/services, transport UI, destination label, gallery, registration preview, FAQ.

### Target section order (RTL · fa-first)

```text
0. Breadcrumb + back
1. Hero (cover → gallery when PR-D6)
2. Title + destination label + category badge
3. Quick facts bento: price · capacity/scarcity · dates · duration hint
4. Outdoor readiness (mountain/nature conditional cells)
5. CTA primary (+ sold-out when spotsRemaining === 0)
6. Short description
7. Jump nav → #readiness #itinerary #logistics #gear #policies #register
8. Long description (optional, PR-D4)
9. Itinerary (accordion when >2 days, PR-D2)
10. Logistics: gathering/start + map link · transport · return time (PR-D3)
11. Gear + included/excluded + insurance (PR-D4)
12. Policies + cancellation (existing)
13. Know-before-register + FAQ accordion (PR-D5)
14. CTA secondary
15. Sticky bar (mobile) / booking rail (desktop)
```

**Mobile fold order (critical):** cover → title → bento → CTA — **not** title-before-cover (AtlasPerk / Viator mobile stack).

**PR-D mobile closure (`32-pr-d-mobile-detail-closure.css`, ≤767px):**

| Rule | Behavior |
| ---- | -------- |
| Gutter parity | Same tokens as `/tours`: `--catalog-page-padding-x` (16px + safe-area), `--catalog-page-padding-y: var(--space-4)` on mobile; **no** negative-margin full-bleed (hero stays inset with `border-radius`) |
| Hero-first | CSS `order` on intro: gallery/cover `1`, title `2`, breadcrumb `3`; `data-marketing-catalog-detail-back` hidden (breadcrumb + shell nav) |
| Vertical rhythm | `detail-layout` / `detail-main` / `detail-body` gaps tightened to `--space-3`–`4`; section cards `--space-3` inner padding |
| Breadcrumb | Compact flex trail with `›` separators; current title ellipsis on one line |
| Jump nav | In-gutter horizontal scroll (`flex-wrap: nowrap`); first pill aligns with title/facts |
| Sticky bar | `padding-inline: max(--catalog-page-padding-x, safe-area insets)` — matches header inner gutter |
| Typography | Detail `h1` clamp `1.375rem–2rem` on mobile |

Detail `<main>` base (all viewports): `padding-block-end: max(--catalog-page-padding-y, safe-area-inset-bottom)` — mirrors list page (`01-block-p2.css`).

Desktop (≥768px) keeps doc target order: breadcrumb → back → hero → title.

**Desktop (≥1024px):** two-column grid — main column (§1–13) + sticky booking rail (price, capacity, CTA duplicate of §5).


---

### Risk register — high-risk gaps and mitigations

Every row is a **must-address** item before calling PR-D complete. Severity: **P0** conversion/trust blocker · **P1** outdoor decision blocker · **P2** polish/deferred with explicit gate.

| ID    | Risk                                                                                 | Sev | Mitigation (phase)                                                                                                                                                                                                                                                              | Acceptance                                                |
| ----- | ------------------------------------------------------------------------------------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| R-D01 | Single CTA at page bottom; attention drop before scroll                              | P0  | PR-D1: **one visible register control per viewport** — booking rail (desktop ≥64rem) · sticky bar (mobile); no duplicate inline CTAs in main column                                                                                                                             | SMK-MKT-03 green; one `[data-marketing-register]` visible |
| R-D02 | Mobile title-before-hero breaks industry fold                                        | P0  | PR-D1: CSS `order` or JSX split — preserve existing hooks on title/cover                                                                                                                                                                                                        | Visual: cover first ≤768px                                |
| R-D03 | Stats as plain `ul` — poor scan for price/capacity/scarcity                          | P0  | PR-D2: bento grid `data-marketing-catalog-detail-facts`; sold-out badge when `spotsRemaining === 0`                                                                                                                                                                             | CTA disabled + i18n `detail.soldOut` when full            |
| R-D04 | No sticky price+CTA on mobile scroll                                                 | P0  | PR-D1: `data-marketing-catalog-detail-sticky-bar` + `padding-bottom` on article = bar height + safe-area                                                                                                                                                                        | No content hidden under bar                               |
| R-D05 | Sticky nav/bar overlaps first section                                                | P0  | PR-D1: compensate scroll-margin on `#` targets; body padding per ui-ux-pro-max sticky-nav rule                                                                                                                                                                                  | Jump nav lands without overlap                            |
| R-D06 | **Outdoor readiness missing** — hiking hours, peak, trail km, elevation, min age     | P1  | PR-D2b: `CatalogTourDetailReadiness` + egress fields on card (see Data egress)                                                                                                                                                                                                  | Mountain tour shows peak+hours+minAge when set            |
| R-D07 | Difficulty/fitness alone insufficient for hike/no-go decision                        | P1  | PR-D2b: readiness block **above** long copy; link text to policies                                                                                                                                                                                                              | User sees physical bar before itinerary                   |
| R-D08 | **Destination name** not shown (only category slug)                                  | P1  | PR-D3: egress `destinationLabel` from `destinationId` + `destinationNameById` (already resolved in `catalog.service.ts`)                                                                                                                                                        | H1 subtitle or meta shows human name                      |
| R-D09 | **Meeting/gathering point** absent — Baymard: map required                           | P1  | PR-D3: egress `gatheringPrimary` (label + lat/lng); map **link** (OSM/Google) phase 1 — no heavy embed                                                                                                                                                                          | Link opens when coords exist                              |
| R-D10 | Legacy `meetingPoint` / `startPointLocationText` on exposure but not on card         | P1  | PR-D3: map to card text fields; prefer `gatheringPoints[0]` when present                                                                                                                                                                                                        | Fail-soft: hide section when all empty                    |
| R-D11 | **Exposure binding bug:** hiding `meetingPoint` redacts `itineraryDays`              | P0  | PR-D3: fix `denali-catalog-exposure-bindings.ts` — dedicated card keys, never `clearItinerary` for logistics fields                                                                                                                                                             | Unit test in `denali-catalog-exposure.spec.ts`            |
| R-D12 | `denali.destination` exposure maps to `category` redaction — conflates slug vs label | P1  | PR-D3: separate `destinationLabel` egress; category slug stays for filters                                                                                                                                                                                                      | Redact label without breaking category chip               |
| R-D13 | **Transport** on card (`transport` snapshot) but UI silent                           | P1  | PR-D3: `CatalogTourDetailLogistics` shows mode + optional cost/dong/personal-car                                                                                                                                                                                                | Uses existing `PublicCatalogTransportSnapshot`            |
| R-D14 | Return time missing for single-day tours                                             | P1  | PR-D3: egress `approximateReturnTime` on card (wizard field `denali.approximate-return-time` — **not** a catalog exposure binding; phase-10 guard)                                                                                                                              | Visible when data present on card                         |
| R-D15 | **Gear list** absent — top hiking PDP expectation                                    | P1  | PR-D4: egress `gearItems[]` → checklist UI                                                                                                                                                                                                                                      | Section hidden when empty                                 |
| R-D16 | Included/excluded services absent                                                    | P1  | PR-D4: egress `includedServices` / `excludedServices`                                                                                                                                                                                                                           | Two-column or accordion mobile                            |
| R-D17 | Tour insurance flag invisible                                                        | P1  | PR-D4: egress `includesTourInsurance` boolean                                                                                                                                                                                                                                   | Trust line in gear/services block                         |
| R-D18 | **longDescription** not on card                                                      | P1  | PR-D4: egress `longDescription`; plain text / preserve line breaks                                                                                                                                                                                                              | Below short description                                   |
| R-D19 | Single cover only — weak trust                                                       | P1  | PR-D6: hero mosaic (1 large + 2 stacked, 16:9) at fold; overflow grid + «+N more» when >3 photos; **PR-9 static fallbacks** (`/home/fallback-tour-cover.webp` + `/home/gallery/0*.webp`) pad when API returns <4 photos — hook `data-marketing-catalog-detail-gallery-fallback` | ≥3 photos → mosaic; LCP on primary                        |
| R-D20 | Registration surprises (national ID, age) after CTA click                            | P1  | PR-D5: `CatalogTourDetailRegisterPreview` from existing card flags (`nationalIdRequired`, `minimumAge`, …)                                                                                                                                                                      | Lists intake flags without admin change                   |
| R-D21 | No FAQ / objection handling (weather, fitness worry)                                 | P1  | PR-D5: tour FAQ from admin fields (`fitnessPrerequisiteText`, cancellation lines) first; static i18n fallback only when empty                                                                                                                                                   | Admin text replaces generic block                         |
| R-D22 | `paymentMode` invisible pre-register                                                 | P2  | PR-D5: egress + one line in policies or register preview                                                                                                                                                                                                                        | Optional                                                  |
| R-D23 | Leader/guide credentials absent                                                      | P2  | **Deferred PR-D7** — needs public-safe leader egress policy; document in `public-catalog.md` before code                                                                                                                                                                        | Explicit defer; not PR-D DoD                              |
| R-D24 | Reviews/testimonials                                                                 | —   | **Out of scope** — no review system                                                                                                                                                                                                                                             | Do not stub fake social proof                             |
| R-D25 | Date picker / pay on marketing                                                       | —   | **Out of scope** — portal owns registration + payment                                                                                                                                                                                                                           | CTA → portal only                                         |
| R-D26 | Motion-heavy / parallax (ui-ux-pro-max skill default)                                | P0  | CSS transitions ≤200ms; `prefers-reduced-motion: reduce` disables transform                                                                                                                                                                                                     | No scroll-jacking                                         |
| R-D27 | Breaking E2E hooks                                                                   | P0  | Additive hooks only; keep `data-marketing-catalog-tour-detail`, `data-marketing-register`, itinerary/policies hooks                                                                                                                                                             | SMK-MKT-02/03/itinerary unchanged                         |
| R-D28 | API/egress without docs (guard-docs)                                                 | P0  | Update **`public-catalog.md`** + this file **before** `denali-catalog-card.ts` / contract changes                                                                                                                                                                               | Husky green                                               |
| R-D29 | JSON-LD stale after exposure redaction                                               | P0  | PR-D5: verify `refreshDenaliCatalogStructuredData` after new fields; marketing graph unchanged contract                                                                                                                                                                         | SMK-MKT-06                                                |
| R-D30 | Persian digits on new numeric surfaces                                               | P1  | Extend PR Persian digits table to readiness, logistics, gear counts                                                                                                                                                                                                             | fa locale arabext                                         |
| R-D31 | Mountain vs nature conditional cells wrong                                           | P1  | PR-D2b: render cells from `category` family (`mountain_*` / `nature_*`) — mirror list filter semantics PR-23                                                                                                                                                                    | Nature hides peak; mountain hides trail km                |
| R-D32 | Exposure-off field shows empty shell                                                 | P1  | **Data-gated + exposure-gated:** no DOM node when redacted or null                                                                                                                                                                                                              | No “—” placeholders for hidden fields                     |
| R-D33 | Dual CTA divergent URLs                                                              | P0  | Single `registrationUrl` prop threaded to all CTAs                                                                                                                                                                                                                              | Assert same href in component test                        |
| R-D34 | Urban workspace regression                                                           | P0  | All new sections Denali-only via `pluginId` / section gates; Urban detail unchanged                                                                                                                                                                                             | SMK-MKT-05                                                |

---

### Phase plan

| Phase      | Scope                                                                                                    | API / denali package                          | Marketing only |
| ---------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------- |
| **PR-D1**  | Hero-first mobile, jump nav (smooth scroll), primary CTA above fold, sticky bar skeleton, scroll padding | No                                            | Yes            |
| **PR-D2**  | Bento quick facts, sold-out state, desktop booking rail, itinerary accordion (>2 days)                   | No                                            | Yes            |
| **PR-D2b** | Outdoor readiness section + i18n                                                                         | **Yes** — extend `PublicCatalogCard` + mapper | Yes            |
| **PR-D3**  | Logistics, destination label, map link, transport UI, exposure binding fix R-D11/R-D12                   | **Yes**                                       | Yes            |
| **PR-D4**  | Gear, included/excluded, insurance, longDescription                                                      | **Yes**                                       | Yes            |
| **PR-D5**  | Register preview, FAQ, paymentMode line, JSON-LD verify R-D29                                            | Partial egress                                | Yes            |
| **PR-D6**  | Photo gallery (multi-image)                                                                              | **Yes** — `photoUrls`                         | Yes            |
| **PR-D7**  | Leader/guide public block                                                                                | **Deferred** — product + egress policy        | TBD            |

**Implementation order:** D1 → D2 (ship UX win) → doc-first bundle **D2b + D3 + D4** (outdoor core) → D5 → D6. Do **not** start D2b until `public-catalog.md` card extension table is merged.

---

### Data egress — `PublicCatalogCard` extensions (PR-D2b–D6)

Marketing reads JSON only. New fields are **optional** on the SDK contract; Denali mapper sets them; exposure bindings redact per field id.

| Card field (proposed)                   | Wizard / canonical source              | Exposure field id                             | Section              |
| --------------------------------------- | -------------------------------------- | --------------------------------------------- | -------------------- |
| `destinationLabel`                      | `destinationId` → name map             | `denali.destination` (label only; slug stays) | Hero/meta            |
| `hikingHoursApprox`                     | `program.hikingHoursApprox`            | new or program gate                           | Readiness            |
| `hikingGoHours` / `hikingReturnHours`   | program                                | optional                                      | Readiness            |
| `peakHeightMeters`                      | `tripDetails.overview.peakHeight`      | optional                                      | Readiness (mountain) |
| `trailDistanceKm`                       | `tripDetails.overview.trailDistanceKm` | optional                                      | Readiness (nature)   |
| `elevationGainMeters`                   | `tripDetails.metrics.elevationGain`    | optional                                      | Readiness (mountain) |
| `minimumAge`                            | `participants.minimumAge`              | TBD (`denali.pricing-participants` or new)    | Readiness            |
| `maximumAge`                            | `participants.maximumAge`              | optional                                      | Readiness            |
| `fitnessPrerequisiteText`               | participants                           | optional                                      | FAQ / readiness      |
| `approximateReturnTime`                 | `basicInfo.approximateReturnTime`      | — (egress; wizard field not catalog-bound)    | Logistics            |
| `gatheringLabel`                        | `gatheringPoints[0]` or `startPoint`   | `meetingPoint` / zones                        | Logistics            |
| `gatheringLat` / `gatheringLng`         | locationData coords                    | same                                          | Map link             |
| `longDescription`                       | `program.longDescription`              | optional                                      | Body                 |
| `gearItems`                             | `participants.gearItems`               | optional                                      | Gear                 |
| `includedServices` / `excludedServices` | tripDetails.logistics                  | optional                                      | Services             |
| `includesTourInsurance`                 | pricing                                | optional                                      | Services             |
| `paymentMode`                           | `pricing.paymentMode`                  | `denali.pricing-payment`                      | Register preview     |
| `photoUrls`                             | `photos[]` signed URLs                 | `denali.photos`                               | Gallery              |

**Registration flags (already on card):** `nationalIdRequired`, `fatherNameRequired`, `birthDateRequired`, `transport` — surface in PR-D5 preview only.

**Exposure binding fix (R-D11):** replace `meetingPoint` / `startPointLocationText` handlers that call `clearItinerary` with redaction of logistics card keys only.

---

### New presentation hooks (additive)

| Hook                                             | Phase | Location                                        |
| ------------------------------------------------ | ----- | ----------------------------------------------- |
| `data-marketing-catalog-detail-hero`             | D1    | hero wrapper                                    |
| `data-marketing-catalog-detail-facts`            | D2    | bento grid                                      |
| `data-marketing-catalog-detail-cta-primary`      | D1    | above-fold CTA                                  |
| `data-marketing-catalog-detail-sticky-bar`       | D1    | mobile sticky                                   |
| `data-marketing-catalog-detail-jump-nav`         | D1    | section pills                                   |
| `data-marketing-catalog-detail-readiness`        | D2b   | outdoor block                                   |
| `data-marketing-catalog-detail-logistics`        | D3    | logistics section                               |
| `data-marketing-catalog-detail-map-link`         | D3    | external map anchor                             |
| `data-marketing-catalog-detail-gear`             | D4    | gear checklist                                  |
| `data-marketing-catalog-detail-services`         | D4    | included/excluded                               |
| `data-marketing-catalog-detail-register-preview` | D5    | intake preview                                  |
| `data-marketing-catalog-detail-faq`              | D5    | FAQ accordion                                   |
| `data-marketing-catalog-detail-hero-gallery`     | D6    | hero mosaic wrapper (layout single/duo/mosaic)  |
| `data-marketing-catalog-detail-gallery-more`     | D6    | «+N more» anchor to overflow grid               |
| `data-marketing-catalog-detail-gallery`          | D6    | overflow photo grid (`#catalog-detail-gallery`) |
| `data-marketing-catalog-detail-photo-trigger`    | D6b   | opens fullscreen lightbox at photo index        |
| `data-marketing-catalog-detail-photo-lightbox`   | D6b   | native `<dialog>` viewer (prev/next, Escape)    |
| `data-marketing-catalog-detail-booking-rail`     | D2    | desktop aside                                   |

Existing hooks in § Detail (`data-marketing-register`, `data-marketing-catalog-itinerary`, …) **must not** be removed or repurposed.

---

### Component tree (post–PR-D)

```text
app/tours/[tourId]/page.tsx
  └── CatalogTourDetail
        ├── CatalogTourBreadcrumb
        ├── CatalogTourDetailHero (cover + gallery D6)
        ├── CatalogTourDetailHeader (title, destination, back)
        ├── CatalogTourDetailFacts (bento D2)
        ├── CatalogTourDetailReadiness (D2b)
        ├── CatalogTourDetailCta (primary D1)
        ├── shortDescription / longDescription
        ├── CatalogTourDetailJumpNav (D1)
        ├── CatalogItinerarySection (accordion wrapper D2)
        ├── CatalogTourDetailLogistics (D3)
        ├── CatalogTourDetailGear + CatalogTourDetailServices (D4)
        ├── CatalogTourDetailPolicies (existing)
        ├── CatalogTourDetailRegisterPreview (D5)
        ├── CatalogTourDetailFaq (D5)
        ├── CatalogTourDetailCta (secondary)
        ├── CatalogTourDetailStickyBar | CatalogTourDetailBookingRail (D1/D2)
        └── JSON-LD scripts (existing)
```

Pure logic modules (no JSX): extend `build-catalog-tour-meta-line.ts`, add `build-catalog-map-link.ts`, `build-catalog-readiness-cells.ts` (category-family gates).

---

### Verify (PR-D closure)

| Check                   | Command / smoke                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Layout + CTA            | SMK-MKT-02, SMK-MKT-03                                                                       |
| Itinerary + photos      | existing Denali smoke selectors                                                              |
| Exposure binding        | `pnpm --filter @app-tour/workspace-denali test denali-catalog-exposure`                      |
| Contract                | extend `packages/workspace-sdk/test/resolve-catalog-detail-sections.spec.ts` if gates change |
| Persian digits          | manual fa `/tours/{id}` + extend § Persian digits table                                      |
| Urban isolation         | SMK-MKT-05 — no new Denali sections                                                          |
| Doc guard               | `pnpm run guard-docs` when denali package touched                                            |
| Fast-track (pre-commit) | `pnpm run phase-6:fast-track` after code lands                                               |

**PR-D Definition of Done:** all **P0** and **P1** rows in Risk register closed; P2/deferred rows explicitly listed in Roadmap; no admin panel changes.

#### Implementation status (2026-07-04)

| Phase         | Status       | Risks closed                                                                                               |
| ------------- | ------------ | ---------------------------------------------------------------------------------------------------------- |
| PR-D1         | **Done**     | R-D01, R-D02, R-D04, R-D05, R-D26, R-D27, R-D33                                                            |
| PR-D2         | **Done**     | R-D03, R-D34 (Urban unchanged); partial R-D02 sold-out; desktop dedup price/capacity bento vs booking rail |
| PR-D2b        | **Done**     | R-D06, R-D07, R-D31                                                                                        |
| PR-D3         | **Done**     | R-D08–R-D14, R-D32; R-D11 exposure fix + `denali-catalog-exposure-prd.spec.ts`                             |
| PR-D4         | **Done**     | R-D15–R-D18                                                                                                |
| PR-D5         | **Done**     | R-D20, R-D21, R-D22 (paymentMode line in register preview); R-D29 JSON-LD refresh verified                 |
| PR-D6         | **Done**     | R-D19                                                                                                      |
| PR-D7         | **Deferred** | R-D23                                                                                                      |
| **Cross-cut** | **Done**     | R-D30 Persian digits table; R-D33 single `registrationUrl` state                                           |

**Landed modules:** `resolve-marketing-denali-plugin.ts` (`isDenaliMarketingPlugin`) + `resolve-catalog-detail-denali-pdp-gates.ts` (central PR-D section gates for detail PDP); `catalog-tour-detail-facts.tsx`, `catalog-tour-detail-register-cta.tsx`, `catalog-tour-detail-jump-nav.tsx`, `catalog-tour-detail-sticky-bar.tsx`, `catalog-tour-detail-booking-rail.tsx`, `build-catalog-tour-detail-facts.ts`, `resolve-catalog-tour-registration-state.ts`; **PR-D2b–D6:** `read-denali-catalog-detail-egress.ts`, `catalog-tour-detail-readiness.tsx`, `catalog-tour-detail-logistics.tsx`, `catalog-tour-detail-gear-services.tsx`, `catalog-tour-detail-gallery.tsx`, `build-catalog-readiness-cells.ts`, `build-catalog-map-link.ts`; **PR-D5:** `catalog-tour-detail-register-preview.tsx`, `catalog-tour-detail-faq.tsx`, `build-catalog-register-preview-items.ts`; layout/CSS in `denali-marketing.css` (detail block); accordion in `catalog-itinerary-section.tsx`.

---

## Persian digits on tour detail (2026-07-04)

When locale is `fa`, numeric copy on `/tours/[tourId]` uses Eastern Arabic (Persian) numerals:

| Surface                                    | Mechanism                                                                                                                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Itinerary day label                        | ICU `{day, number}` + `formats.number.default.numberingSystem: arabext` in `src/i18n/request.ts`                                                                                                                |
| Segment lines (time, inline digits)        | `formatCatalogItinerarySegmentLine` → `toLocalizedDigits` (`src/i18n/format-localized-digits.ts`)                                                                                                               |
| Day title / summary (API text with digits) | `CatalogItinerarySection` localizes visible strings                                                                                                                                                             |
| Stats capacity / spots                     | ICU `{count, number}` in `messages/fa/catalog.json`                                                                                                                                                             |
| Cancellation hours / penalty               | ICU `{hours, number}` / `{percent, number}`                                                                                                                                                                     |
| Meta dates + price                         | `formatCatalogDateRange` / `formatCatalogPrice`. Dates: `numberingSystem: arabext` when `fa-IR`. **Price (ED-CURR-MKT-01):** Denali `pluginId` + `IRR` is grouped digits + تومان/toman — **not** `Intl` `style: currency` (that painted ریال/`IRR`). Same stored integer; **no ×10**. Other plugin ids and non-`IRR` codes keep `Intl` currency style. JSON-LD `offers.priceCurrency` stays ISO `IRR`. |
| **PR-D readiness**                         | peak, trail km, elevation, hiking hours, min/max age — `buildCatalogReadinessCells` + ICU `{hours,meters,km,years, number}` with `toLocalizedDigits` on prerequisite text (`catalog-tour-detail-readiness.tsx`) |
| **PR-D logistics**                         | return time via `toLocalizedDigits`; transport cost/dong via `formatCatalogPrice` (same Denali-only IRR→toman rule as list/detail price)                                                                                    |
| **PR-D register preview**                  | min/max age via ICU `{years, number}` in `detail.registerPreview.*`                                                                                                                                             |
| **PR-D gallery alt**                       | ICU `{index, number}` in `detail.gallery.photoAlt`                                                                                                                                                              |
| **PR-D6b lightbox**                        | Click/tap hero mosaic + overflow grid → `<dialog>` fullscreen; arrow keys; `detail.gallery.lightbox*` i18n; one client boundary in `@apps/marketing`                                                            |
| **PR-D facts / sticky / rail**             | capacity, spots, difficulty — same ICU paths as list stats (`detail.facts`, `detail.capacity`, `detail.spotsRemaining`)                                                                                         |

English locale keeps Latin digits (`latn`).

---

## Styling rules

| Rule                                | Detail                                                                                                                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No catalog CSS in `app/globals.css` | guest-shell + tailwind import only                                                                                                                                                                          |
| Workspace skin                      | `guestThemeStylesheets.marketing` in manifest → generated bootstrap                                                                                                                                         |
| Layout tokens                       | `--catalog-grid-columns`, `--catalog-detail-max-width` in `denali-marketing.css`                                                                                                                            |
| rem-first units                     | `--mkt-text-*`, `--mkt-radius-*`, `--mkt-shadow-*`, `--mkt-lift-*` — spacing via `--space-*` (rem). **No raw px** for spacing/typography; `px` only for `--mkt-border-width` fallback (1px) and breakpoints |
| Design-system SoT                   | [`design-system/denali-club/MASTER.md`](../../../design-system/denali-club/MASTER.md) → mapped in `denali-marketing.css` root tokens (`--color-primary`, `--color-accent` CTAs)                             |
| Primitives                          | P6: `@app-tour/ui-primitives/input` + `/button` on Urban city filter; nav CTAs stay `Link`/`<a>` + workspace skin                                                                                           |

### CSS duplicate-maintenance policy (Urban + Denali)

`denali-marketing.css` and `urban-marketing.css` intentionally mirror layout selectors (`[data-marketing-catalog-*]`) under `body[data-workspace-plugin="…"]`. **Do not** import workspace skins from `apps/marketing`. When changing catalog layout hooks or grid tokens, update **both** skins in the same PR or document the intentional divergence in this file. A shared `@app-tour/catalog-marketing-layout` partial is deferred until a third workspace lands.

---

## Roadmap status (2026-06-30)

Enterprise hardening **complete** for Denali + Urban. All items below landed:

| Item                                                           | Status |
| -------------------------------------------------------------- | ------ |
| Track A presentation fields (SDK resolvers + specs SDK-CAT-\*) | Done   |
| Urban marketing skin + registry bootstrap                      | Done   |
| Urban exposure on catalog API                                  | Done   |
| Denali skin ↔ denali-club MASTER                               | Done   |
| SMK-MKT-05 urban E2E                                           | Done   |
| Denali exposure DB-less smoke fallback                         | Done   |
| M17 guard + tracked env templates (dynamic count)              | Done   |

Deferred (non-blocker): Track B `catalogUi` manifest · shared CSS partial until workspace #3.

**Active (2026-07-04):** **PR-D1–D6** tour detail PDP landed (layout, bento facts, dual CTA, sticky bar, booking rail, jump nav, itinerary accordion, readiness, logistics, gear/services, gallery, register preview, FAQ). **PR-D7** (leader/guide) deferred — see § PR-D risk register R-D23.

---

## Verify

### Local dev (Denali catalog from Postgres)

Guest BFF API base is shared via `@app-tour/guest-surface-host` (`resolveTourOpsApiBaseUrl`). In **`NODE_ENV=development`**, when `TOUR_OPS_API_URL` is unset, marketing defaults to `http://127.0.0.1:3001` (same chain as admin branding fetch). Production still requires explicit `TOUR_OPS_API_URL` (G-ENV-04).

1. Postgres up: `docker compose -f infra/docker-compose.yml up -d postgres`
2. API: `cd apps/api && pnpm run dev` (`.env` + `.env.local` with `DATABASE_URL`)
3. Marketing: `pnpm --filter @apps/marketing run dev` — optional tracked `apps/marketing/.env.local.example` → `.env.local`
4. Browse by **host label** (tenant from `phase-43-host-tenant-ids`, plugin from `resolve-dev-plugin-id`):

| Host                                   | Workspace                |
| -------------------------------------- | ------------------------ |
| `http://denali.localhost:3002/tours`   | Denali tenant `…000003`  |
| `http://operator.localhost:3002/tours` | Operator smoke `…000014` |
| `http://urban.localhost:3002/tours`    | Urban `…000004`          |

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

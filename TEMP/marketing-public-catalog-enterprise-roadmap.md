# Marketing Public Catalog — Enterprise Hardening Roadmap

> **نسخه:** 2.1 (2026-06-30) — بازبینی مسیرها و استانداردهای repo
> **نوع:** نقشه راه اجرایی TEMP (پیش از promote به `docs/`)
> **حکم v2:** v1 چند مسیر/doc/اولویت اشتباه داشت؛ این نسخه با **کد + doc رسمی** هم‌تراز است

---

## 0. Authority map — کدام doc استاندارد است؟

| اولویت | سند | نقش |
|--------|-----|-----|
| 1 | [`docs/workspaces/denali/public-catalog.md`](../docs/workspaces/denali/public-catalog.md) | **SoT** API، M2b Urban، cache، i18n، implementation map |
| 2 | [`docs/phase-19/p6-implementation-standards.mdoc`](../docs/phase-19/p6-implementation-standards.mdoc) | layering، ui-primitives، BFF، checklist §7 |
| 3 | [`docs/phase-19/p6/p6-theming-file-tree.md`](../docs/phase-19/p6/p6-theming-file-tree.md) | globals vs skin، generator، verify P6-1-N-015 |
| 4 | [`docs/phase-19/p6/runbooks/host-subdomain-map.md`](../docs/phase-19/p6/runbooks/host-subdomain-map.md) | **dev smoke canonical:** `operator.localhost:3002` · tenant `…000014` |
| 5 | [`docs/phase-19/platform-denali-first-customer.mdoc`](../docs/phase-19/platform-denali-first-customer.mdoc) | سه app جدا · Urban **خارج از P6 exit** |
| 6 | [`docs/phase-17/platform-club-catalog-publish.mdoc`](../docs/phase-17/platform-club-catalog-publish.mdoc) | publish → revalidate · extends public-catalog |
| 7 | [`packages/workspace-sdk/src/tour/public-catalog.contract.ts`](../packages/workspace-sdk/src/tour/public-catalog.contract.ts) | ADR-MKT-003 · `PublicCatalogSurface` |
| 8 | [`scripts/guard-docs.sh`](../scripts/guard-docs.sh) | doc-first **فقط** برای `workspace-sdk`, `platform-core`, `apps/api` |

**قانون naming doc در `docs/workspaces/`:** فقط `.md` (مثل `public-catalog.md`) — نه `.mdoc`.

**قانون extensibility در public-catalog (خط 289):**

> Marketing renders workspace fields **without static-importing workspace packages** — **API JSON drives display**.

پس مسیر enterprise ترجیحی: **نرمال‌سازی در egress workspace card**، نه branch زیاد در marketing.

---

## A. اصلاحات v1 → v2 (اشتباهات roadmap قبلی)

| # | v1 (غلط/ناقص) | v2 (اصلاح) |
|---|----------------|------------|
| 1 | P0: `denali.localhost:3002` = first-customer URL | **Canonical smoke:** `operator.localhost:3002` (tenant `…000014`) — [`host-subdomain-map.md`](../docs/phase-19/p6/runbooks/host-subdomain-map.md) |
| 2 | `denali.localhost` tenant 003 = blocker اصلی | tenant `…000003` = **Denali admin login label** (`denali.localhost:3000`) — catalog dev اختیاری؛ 503 = `TENANT_DB_BUDGET_EXCEEDED` جداگانه |
| 3 | doc جدید `docs/workspaces/public-catalog-onboarding.mdoc` | **§ جدید** در `public-catalog.md` یا `docs/phase-17/…` — convention: `.md` در workspaces |
| 4 | `marketing-catalog-ui.mdoc` | `docs/workspaces/denali/marketing-catalog-ui.md` |
| 5 | Phase 3 Urban قبل از Denali polish | **Denali first** (P6 exit) · Urban M2b = **Phase 4** (post-P6) |
| 6 | فقط `format-catalog-display.ts` hardcode | **۶ فایل** با `pluginId === "urban"` (جدول B2) |
| 7 | `guard-docs` برای `apps/marketing` | marketing/workspace **خارج از guard** — فقط SDK/API نیاز docs دارند |
| 8 | SDK `CatalogDisplayProfile` تنها راه | **Track A (ترجیح):** normalize در `toCatalogCard` · **Track B:** manifest `catalogUi` + generated registry |
| 9 | pagination/city filter گپ | **از قبل پیاده** — M5/M10 در `app/tours/page.tsx` ✅ |
| 10 | verify فقط `pre-commit:fast` | + `guard:public-catalog-m17` · `guest-theme-stack` · `p6:gate` subset |

---

## B. وضعیت فعلی — چه چیز **استاندارد** است (تکرار نکنید)

| قابلیت doc | مسیر | وضعیت |
|------------|------|--------|
| M5 pagination | `apps/marketing/app/tours/page.tsx` | ✅ Load more + cursor |
| M10 Urban city filter | همان + `fetch-catalog-list.ts` | ✅ (با hardcode urban) |
| M11 revalidate | `apps/api/src/marketing/*` + `app/api/revalidate/route.ts` | ✅ |
| M14 cover image | `catalog-cover-image.tsx` | ✅ |
| P6 guest theme stack | `denali-marketing.css` + generated bootstrap | ✅ |
| BFF fetch | `fetch-catalog-list.ts`, `fetch-catalog-tour.ts` | ✅ |
| Registration CTA | `resolve-web-registration-url.ts` | ✅ |
| SMK-MKT smoke | `tests/e2e/marketing-catalog-smoke.spec.ts` · base `shop.operator.localhost:3002` | ✅ |
| Pure itinerary logic | `catalog-itinerary-display-logic.ts` | ✅ |
| Import boundary | no `@app-tour/workspace-*` in marketing | ✅ |

---

## C. گپ‌ها (بازبینی کامل)

### P0 — Blocker doc / extensibility

| ID | مشکل | مسیر(ها) |
|----|------|----------|
| GAP-DOC-01 | Implementation map فاقد کامپوننت‌های UI جدید | `docs/workspaces/denali/public-catalog.md` §375+ |
| GAP-DOC-02 | راهنمای «workspace سوم» پراکنده | همان doc — § **Adding a workspace** (جدید) |
| GAP-EXT-01 | شاخه `pluginId` در marketing (Open/Closed) | **B2 جدول** — ۶ فایل |
| GAP-EXT-02 | فیلدهای Denali در stats/detail بدون gate | `catalog-tour-stats.tsx`, `catalog-tour-detail.tsx`, `catalog-itinerary-section.tsx`, `catalog-tour-detail-policies.tsx` |

### P1 — Type / architecture

| ID | مشکل | مسیر(ها) |
|----|------|----------|
| GAP-TYPE-01 | `MarketingCatalogCard` duplicate `PublicCatalogCard` + itinerary types | `apps/marketing/src/catalog/catalog-types.ts` ↔ SDK contract |
| GAP-ARCH-01 | دو مسیر extensibility doc تعریف نشده | Track A workspace egress vs Track B manifest — **تصمیم در Phase 0** |
| GAP-DRY-01 | meta/locale در card/detail/stats تکرار | `catalog-tour-card.tsx`, `catalog-tour-detail.tsx`, `catalog-tour-stats.tsx` |

### P2 — P6 / theming / Urban (post-Denali)

| ID | مشکل | مسیر(ها) |
|----|------|----------|
| GAP-P6-01 | raw `<a>`, `<input>`, `<button>` — بدون ui-primitives | `catalog-tour-card.tsx`, `catalog-tour-detail.tsx`, `app/page.tsx`, `app/tours/page.tsx` (city filter) |
| GAP-P6-02 | `@app-tour/ui-primitives` در deps marketing نیست | `apps/marketing/package.json` |
| GAP-THEME-01 | Urban بدون `guestThemeStylesheets.marketing` | `packages/workspaces/urban/workspace.manifest.json` — **عمدی P6** ولی M2b نیاز دارد |
| GAP-DOC-03 | UX spec public catalog | `docs/workspaces/denali/marketing-catalog-ui.md` *(جدید)* |

### P3 — Dev / polish / gates

| ID | مشکل | مسیر(ها) |
|----|------|----------|
| GAP-DEV-01 | `denali.localhost:3002` → catalog 503 (budget) | `apps/api` tenant pool · seed tenant `…000003` |
| GAP-DEV-02 | doc dev host matrix ناقص برای marketing | `host-subdomain-map.md` + `public-catalog.md` |
| GAP-UX-01 | Phase C styling (skill draft) | `packages/workspaces/denali/theme/denali-marketing.css` |
| GAP-GATE-01 | roadmap verify فاقد M17 + p6 marketing specs | `scripts/guards/guard-public-catalog-m17.mjs`, `scripts/p6-denali-product-gate.sh` |

### B2 — inventory کامل `pluginId` hardcode (باید صفر شود)

| فایل | خط / الگو |
|------|-----------|
| `apps/marketing/src/catalog/format-catalog-display.ts` | `pluginId === "urban"`, `pluginId !== "urban"` |
| `apps/marketing/app/tours/page.tsx` | `bootstrap.pluginId === "urban"` (city filter UI) |
| `apps/marketing/src/catalog/fetch-catalog-list.ts` | `pluginId === "urban"` (city query) |
| `apps/marketing/app/api/catalog/route.ts` | `pluginId === "urban"` |
| `apps/marketing/test/marketing-catalog-display.spec.ts` | urban-specific (OK as test fixture) |

---

## D. Milestones (هم‌راستا با P6)

```text
M1 Doc Truth       — public-catalog.md + marketing-catalog-ui.md + onboarding §
M2 Egress-First    — workspace card normalize OR manifest catalogUi (بدون urban branch)
M3 Denali Polish   — skin Phase C · types DRY · ui-primitives (CTA)
M4 Urban M2b       — urban-marketing.css · city filter via registry · post-P6
M5 Gates + Dev     — p6:gate marketing slice · M17 · denali.localhost optional fix
```

**Denali production (P6 exit) = M1 + M2 (Denali track) + M3 + M5 gates**

Urban کامل = + M4 (explicitly **after** `platform-denali-first-customer` exit)

---

## E. نقشه فازها (اصلاح‌شده)

### Phase 0 — Doc + architecture decision (۱–۲ روز) — **BLOCKER**

| ID | Task | File(s) | Acceptance |
|----|------|---------|------------|
| 0.1 | به‌روز Implementation map — UI layer | `docs/workspaces/denali/public-catalog.md` | + `catalog-tour-card/list/detail/stats/policies`, `catalog-itinerary-display-logic.ts`, `denali-marketing.css` |
| 0.2 | Component tree + `data-marketing-*` | `docs/workspaces/denali/marketing-catalog-ui.md` | table hooks · list vs detail |
| 0.3 | § **Adding a workspace** (10-step) | `docs/workspaces/denali/public-catalog.md` | manifest `httpRoutes` + `publicCatalog` + SDK path + `guestThemeStylesheets.marketing` + exposure + seed |
| 0.4 | **تصمیم Track A vs B** (ADR یک پارagraph) | همان doc § Extensibility | Track A preferred per line 289 |
| 0.5 | Dev host matrix | `docs/phase-19/p6/runbooks/host-subdomain-map.md` | operator vs denali vs urban tenants |
| 0.6 | Cross-ref P6 theming | `docs/phase-19/p6/p6-theming-file-tree.md` | marketing catalog UI doc link |

**Verify:** `pnpm run guard-docs` (when staging SDK/API changes together)

---

### Phase 1 — Extensibility: egress-first (۲–۴ روز)

> **Track A (ترجیح doc):** workspace `toCatalogCard` فیلدهای presentation بدهد.

| ID | Task | File(s) | Acceptance |
|----|------|---------|------------|
| 1.A.1 | Extend `PublicCatalogCard` optional presentation fields | `packages/workspace-sdk/src/tour/public-catalog.contract.ts` | e.g. `listSubtitle`, `listDescription`, `showListPrice`, `detailSections` |
| 1.A.2 | Denali mapper populate | `packages/workspaces/denali/src/catalog/denali-catalog-card.ts` | category → subtitle · shortDescription → description |
| 1.A.3 | Urban mapper populate | `packages/workspaces/urban/src/catalog/*` (urban card mapper) | city/venue → subtitle · catalogSummary |
| 1.A.4 | Marketing dumb renderer | `format-catalog-display.ts`, `catalog-tour-stats.tsx`, `catalog-tour-detail.tsx` | **zero** `pluginId === "urban"` in production TS (tests OK) |
| 1.A.5 | City filter via registry flag | `resolve-catalog-api-path.ts` یا manifest `catalogFeatures: { cityFilter }` | remove urban branch from `page.tsx` / `fetch-catalog-list.ts` / `app/api/catalog/route.ts` |

**Track B (fallback اگر Track A برای sections کافی نبود):**

| ID | Task | File(s) |
|----|------|---------|
| 1.B.1 | `catalogUi` در `workspace.manifest.json` | denali + urban manifests |
| 1.B.2 | Generator emit `resolveCatalogUiProfile(pluginId)` | `scripts/generate-workspace-registry.mjs` + SDK consumer |

| 1.T | Unit tests | `apps/marketing/test/marketing-catalog-display.spec.ts`, workspace catalog specs, SDK contract spec |

**Verify:** `pnpm run test:changed` · doc update **الزامی** (SDK + workspace + api exposure if touched)

---

### Phase 2 — Types & DRY (۱ روز)

| ID | Task | File(s) | Acceptance |
|----|------|---------|------------|
| 2.1 | `MarketingCatalogCard` → `PublicCatalogCard` + urban extension | `catalog-types.ts` | single SoT SDK |
| 2.2 | `buildCatalogTourMetaLine()` shared | `build-catalog-tour-meta-line.ts` *(جدید)* | card + detail |
| 2.3 | Pass locale from page (optional) | `app/tours/page.tsx`, `[tourId]/page.tsx` | reduce nested `getTranslations` |

**Verify:** `pnpm --filter @apps/marketing test`

---

### Phase 3 — Denali polish + P6 UI (۲–۳ روز)

| ID | Task | File(s) | Acceptance |
|----|------|---------|------------|
| 3.1 | Add `@app-tour/ui-primitives` dep | `apps/marketing/package.json` | subpath imports `/button` only |
| 3.2 | Replace raw CTAs | `catalog-tour-card.tsx`, `catalog-tour-detail.tsx`, `app/page.tsx` | P6 §2 |
| 3.3 | Phase C tokens (Denali) | `packages/workspaces/denali/theme/denali-marketing.css` | per club design tokens — doc note if deferred |
| 3.4 | Doc P6 checklist row | `docs/phase-19/p6-implementation-standards.mdoc` | marketing catalog entry |

**Verify:**

```bash
pnpm --filter @apps/marketing run test -- test/guest-theme-stack.spec.ts
pnpm run guard:import-boundary
```

---

### Phase 4 — Urban M2b parity (۲–۳ روز) — **post-P6 exit**

| ID | Task | File(s) | Acceptance |
|----|------|---------|------------|
| 4.1 | `urban-marketing.css` | `packages/workspaces/urban/theme/urban-marketing.css` | scope: `body[data-app-surface="marketing"][data-workspace-plugin="urban"]` |
| 4.2 | Manifest `guestThemeStylesheets.marketing` | `packages/workspaces/urban/workspace.manifest.json` | per p6-theming-file-tree L76 |
| 4.3 | Regenerate bootstrap | `pnpm run generate:workspace-registry` | `workspace-guest-theme-stylesheets.generated.ts` |
| 4.4 | Extend guest-theme test | `apps/marketing/test/guest-theme-stack.spec.ts` | urban CSS path when manifest set |
| 4.5 | Urban city filter ui-primitives | `app/tours/page.tsx` | Input + Button from primitives |

**Verify:** `pnpm run generate:workspace-registry -- --check` · visual `urban.localhost:3002` (if seeded)

---

### Phase 5 — Gates, dev hosts, E2E (۱–۲ روز)

| ID | Task | File(s) | Acceptance |
|----|------|---------|------------|
| 5.1 | Document operator vs denali hosts | `host-subdomain-map.md` | marketing URLs table |
| 5.2 | Optional: fix tenant 003 catalog 503 | API pool / bootstrap | `denali.localhost:3002/tours` 200 |
| 5.3 | E2E stays operator-based | `playwright.marketing.config.ts` | no false expectation on denali host |
| 5.4 | SEO/JSON-LD audit | `build-marketing-metadata.ts`, detail page | matches public-catalog M8/M13 |

**Verify (fast-track closure):**

```bash
pnpm run guard:public-catalog-m17
pnpm --filter @apps/marketing test
pnpm --filter @apps/marketing run test:smoke   # explicit YES · servers required
# p6:gate marketing slice only:
pnpm --filter @apps/marketing exec node --import tsx --test \
  test/resolve-web-registration-url.spec.ts test/guest-theme-stack.spec.ts
```

---

## F. Dependency graph

```text
Phase 0 (doc + Track A/B decision)
    │
    ├──► Phase 1 (egress-first extensibility)
    │         └──► Phase 2 (types/DRY)
    │                   └──► Phase 3 (Denali polish + P6 UI)
    │
    ├──► Phase 4 (Urban M2b) — after P6 exit · needs Phase 1 registry
    │
    └──► Phase 5 (gates + dev doc) — parallel after Phase 3
```

---

## G. File index (تأیید‌شده در repo)

### Marketing — UI

| Path | نقش |
|------|-----|
| `apps/marketing/app/tours/page.tsx` | list · pagination · city filter |
| `apps/marketing/app/tours/[tourId]/page.tsx` | detail route |
| `apps/marketing/app/tours/error.tsx` | error boundary M12 |
| `apps/marketing/app/api/catalog/route.ts` | BFF list |
| `apps/marketing/app/api/catalog/[tourId]/route.ts` | BFF detail |
| `apps/marketing/src/catalog/catalog-tour-card.tsx` | list card |
| `apps/marketing/src/catalog/catalog-tour-list.tsx` | grid |
| `apps/marketing/src/catalog/catalog-tour-list-item.tsx` | re-export compat |
| `apps/marketing/src/catalog/catalog-tour-detail.tsx` | detail body |
| `apps/marketing/src/catalog/catalog-tour-stats.tsx` | stats |
| `apps/marketing/src/catalog/catalog-tour-detail-policies.tsx` | policies |
| `apps/marketing/src/catalog/catalog-itinerary-section.tsx` | itinerary UI |
| `apps/marketing/src/catalog/catalog-itinerary-display-logic.ts` | pure logic |
| `apps/marketing/src/catalog/format-catalog-display.ts` | **Phase 1 refactor** |
| `apps/marketing/src/catalog/format-catalog-cancellation.ts` | cancellation copy |
| `apps/marketing/src/catalog/catalog-types.ts` | **Phase 2 unify** |
| `apps/marketing/src/catalog/fetch-catalog-list.ts` | server fetch |
| `apps/marketing/src/catalog/fetch-catalog-tour.ts` | detail fetch |
| `apps/marketing/playwright.marketing.config.ts` | smoke base URL |

### Workspace / SDK / API

| Path | نقش |
|------|-----|
| `packages/workspace-sdk/src/tour/public-catalog.contract.ts` | ADR-MKT-003 |
| `packages/workspace-sdk/src/catalog/resolve-catalog-api-path.ts` | list/detail paths |
| `packages/workspace-sdk/src/plugin/workspace-plugin.contract.ts` | `publicCatalog?` |
| `packages/workspaces/denali/src/catalog/denali-catalog-card.ts` | Denali egress |
| `packages/workspaces/denali/src/http/catalog.service.ts` | exposure surfaces |
| `packages/workspaces/denali/theme/denali-marketing.css` | Denali skin |
| `packages/workspaces/denali/workspace.manifest.json` | guestTheme + devBootstrap |
| `packages/workspaces/urban/src/catalog/` | Urban egress *(Phase 1.A)* |
| `packages/workspaces/urban/workspace.manifest.json` | **no guestTheme yet** |
| `apps/api/src/http/configure-denali-catalog-http-host.ts` | host adapter |
| `apps/api/src/marketing/should-invalidate-marketing-catalog.ts` | publish hook |

### Docs & guards

| Path | نقش |
|------|-----|
| `docs/workspaces/denali/public-catalog.md` | **SoT** |
| `docs/workspaces/denali/marketing-catalog-ui.md` | **new Phase 0** |
| `docs/phase-19/p6/runbooks/host-subdomain-map.md` | dev hosts |
| `scripts/guards/guard-public-catalog-m17.mjs` | M17 static guard |
| `scripts/p6-denali-product-gate.sh` | `pnpm run p6:gate` |
| `.github/workflows/marketing-guard.yml` | CI |

---

## H. Definition of Done

### M1 — Doc Truth

- [ ] `public-catalog.md` map = file tree واقعی
- [ ] `marketing-catalog-ui.md` exists
- [ ] § Adding a workspace (10 steps)
- [ ] Track A/B documented

### M2 — Egress-First

- [ ] **0** `pluginId === "urban"` in `apps/marketing/src/**` (except tests)
- [ ] SDK contract extended OR manifest registry generated
- [ ] Workspace mappers populate presentation fields

### M3 — Denali Polish

- [ ] ui-primitives on CTAs
- [ ] `guest-theme-stack.spec.ts` green
- [ ] import boundary green

### M4 — Urban M2b

- [ ] `urban-marketing.css` + manifest + generator
- [ ] city filter without inline plugin check

### M5 — Gates

- [ ] `pnpm run guard:public-catalog-m17` PASS
- [ ] p6 marketing unit specs PASS
- [ ] dev host doc accurate

---

## I. ترتیب اجرا (۳ هفته)

| هفته | فاز | خروجی |
|------|-----|--------|
| 1 | 0 + 1.A | doc + egress normalize + حذف urban branches |
| 2 | 2 + 3 | types + Denali skin/primitives |
| 3 | 5 (+ 4 if Urban) | gates · dev doc · optional Urban skin |

---

## J. Doc-first covenant (دقیق)

| Path touched | نیاز docs در commit? |
|--------------|---------------------|
| `packages/workspace-sdk/**` | **بله** — `guard-docs` |
| `apps/api/**` | **بله** |
| `packages/workspaces/**` | خیر (guard) · **بله (توصیه)** — public-catalog § |
| `apps/marketing/**` | خیر (guard) · **بله (توصیه)** — marketing-catalog-ui |

---

## K. Out of scope

| موضوع | مرجع |
|-------|------|
| Portal OTP / register | `public-catalog.md` M17 · portal docs |
| Exposure engine | `TEMP/field-exposure-*` |
| Admin tour list UX | `apps/web` |
| `design-system/denali-club/` | draft skill — not repo SoT until promoted |

---

*v2.1 — paths verified against repo 2026-06-30. Promote Phase 0 docs to `docs/` then archive this TEMP file.*

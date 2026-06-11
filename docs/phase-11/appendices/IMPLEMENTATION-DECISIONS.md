# Phase 11 — Implementation decisions

```yaml
contract: docs/phase-11/README.md
authority: TEMP/wizard-platform-implementation-roadmap.md
```

## DEC-P11-001 — Operator smoke `workspaceType` (11.0)

**تاریخ:** 2026-06-11  
**وضعیت:** ACCEPTED

### مشکل

وقتی `OPERATOR_SMOKE_E2E_SEED=1` و `STORAGE_DRIVER=memory`:

- **Web** (`tenant-kernel.ts`) پلاگین **denali** برای tenant `…000014`  
- **API** (`resolve-workspace-type.ts`) عمداً **`starter`** برمی‌گرداند  

نتیجه: ویزارد Denali + Settings hub بدون ماژول‌های reference (equipment، locations، …). تست `API-9.6-02` این split را مستند کرده بود.

### گزینه‌ها

| گزینه | توضیح | رد / قبول |
| ----- | ----- | --------- |
| A | Web → `starter` هنگام smoke | رد — UI و Playwright روی Denali ساخته شده |
| B | API → `denali` از registry (حذف override) | **قبول** |
| C | seed equipment روی `starter` | رد — دو منبع حقیقت برای همان tenant |

### تصمیم

**گزینه B:** حذف بلوک `OPERATOR_SMOKE_E2E_SEED` → `starter` در `resolveWorkspaceTypeForTenant`.  
Tenant `…000014` در `tenant-registry.ts` از قبل `workspaceType: "denali"` دارد.

### پیامدها

- `GET /settings/modules` در smoke همان manifest کامل denali را برمی‌گرداند (`API-9.6-02` به‌روز).  
- `POST /tours` در smoke از validation **denali** استفاده می‌کند — پل زدن `create-tour.server.ts` (starter shape) تا **11.7** باقی می‌ماند؛ SMK-P9-02 ممکن است نیاز به به‌روزرسانی داشته باشد.  
- کاتالوگ smoke: `bootstrapOperatorSmokeCatalogIfNeeded` برای equipment/locations/themes در dev+memory.

### پذیرش

- `API-9.6-02` — equipment + reconciliation در لیست modules  
- `resolve-workspace-type.spec.ts` — smoke → `denali`  
- `docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md` — بند workspace type به‌روز

---

## DEC-P11-002 — `@app-tour/draft-engine` package layout (11.1)

**تاریخ:** 2026-06-11  
**وضعیت:** ACCEPTED

### تصمیم

Port مستقیم `legacy/packages/draft-engine` به `packages/draft-engine` با نام `@app-tour/draft-engine`.

- **Core entry** (`.`) — `DraftEngine` + types فقط  
- **React entry** (`./react`) — `useDraftEngine`؛ `peerDependencies.react`  
- تست‌ها در `test/engine.spec.ts` (نه داخل `src/`)  
- بدون وابستگی به workspace-sdk / platform-core

### دلیل subpath React

`engine.ts` باید در Node/integration تست‌پذیر باشد (headless). React فقط در `./react`.

### پذیرش

`pnpm --filter @app-tour/draft-engine run build && pnpm --filter @app-tour/draft-engine run test`

---

## DEC-P11-003 — User-scoped draft snapshots (11.2)

**تاریخ:** 2026-06-10  
**وضعیت:** ACCEPTED

### تصمیم

جدول `workspace_draft_snapshots` با کلید یکتا:

`(tenant_id, workspace_id, user_id, draft_namespace, draft_key)`

هر اپراتور draft مستقل دارد (مثل Legacy Denali create wizard). OCC روی `version` — client نسخه فعلی را در PATCH می‌فرستد؛ سرور `version + 1` ذخیره می‌کند.

### API

- مسیر: `/workspaces/{workspaceId}/drafts/{namespace}/{key}`
- پاسخ/بدنه PATCH هم‌شکل `DraftSyncPayload` از `@app-tour/draft-engine`
- `409 DRAFT_VERSION_CONFLICT` — بدنه شامل snapshot سرور برای `DraftConflictError`

### RLS

همان الگوی Phase 9.6 settings — `tenant_id = current_setting('app.current_tenant_id')::uuid`

### پذیرش

`apps/api/test/workspace-drafts.spec.ts` — API-P11-2-01 … 06

---

## DEC-P11-004 — Web draft host layout (11.3)

**تاریخ:** 2026-06-10  
**وضعیت:** ACCEPTED

### تصمیم

لایه web در `apps/web/src/draft/` (نه پکیج جدا در این فاز) — BFF Route Handler + `useWorkspaceDraft` که `@app-tour/draft-engine/react` را wrap می‌کند.

### BFF

مسیر browser: `/api/workspaces/{workspaceId}/drafts/{namespace}/{key}` → proxy به API 11.2 با session bearer.

### پذیرش

`apps/web/test/workspace-draft-client.spec.ts` · `draft-sync-indicator-logic.spec.ts`

---

## DEC-P11-005 — `wizard-navigation` package (11.4)

**تاریخ:** 2026-06-10  
**وضعیت:** ACCEPTED

### تصمیم

پکیج headless `@app-tour/wizard-navigation` — `FieldFocusRegistry`، `focusWizardField`، `scrollToFirstIssue`، `mapValidationResultToIssues` (از `@app-tour/platform-core`).

قرارداد DOM: `data-field-path` (اصلی) + `data-field-id` (fallback).

React hook `useWizardStepValidation` فقط در `apps/web` — core بدون React.

### پذیرش

`packages/wizard-navigation/test/focus.spec.ts` · `apps/web/test/wizard-field-path-attributes.spec.ts`

---

## DEC-P11-006 — Denali wizard draft binding (11.5)

**تاریخ:** 2026-06-10  
**وضعیت:** ACCEPTED

### تصمیم

`operator.wizard` / `denali-create` envelope در `useWorkspaceDraft` برای `new-tour-wizard-client` (فقط `pluginId === denali`).

`meta.currentStepIndex` + `wizardSessionId` همراه `TourWizardDraft` در JSONB ذخیره می‌شود.

### پذیرش

`denali-wizard-draft-binding.spec.ts` · `denali-wizard-draft-resume.spec.ts`

---

## DEC-P11-007 — Client-side tour clone hydration (11.6)

**تاریخ:** 2026-06-10  
**وضعیت:** ACCEPTED

### مشکل

Operator duplicate (`/tours/new?clone={tourId}`) در trunk فقط URL را می‌ساخت؛ ویزارد از تمپلیت خالی یا draft ذخیره‌شده bootstrap می‌شد.

### گزینه‌ها

| گزینه | توضیح | رد / قبول |
| ----- | ----- | --------- |
| A | Server `POST /tours/{id}/clone` | رد — خارج از scope 11.6؛ 11.9 |
| B | Client fetch `GET /tours/{id}` + canonical → draft | **قبول** |
| C | Port کامل legacy `transformTourToDenaliWizardValues` (API DTO) | رد — trunk canonical `data` مستقیم دارد |

### تصمیم

**گزینه B:** `denaliHydrateTourCloneDraft` روی `canonical.data` با:

- نرمال‌سازی legacy `basicInfo` → مسیرهای flat ویزارد
- پسوند ` (Copy)` روی عنوان
- فیلتر `participants.gearItems` به کاتالوگ equipment فعال
- `?clone=` بر draft remote اولویت دارد

`surface` اختیاری `TourCloneHydrator` روی `WorkspacePlugin` (فقط Denali در 11.6).

### پذیرش

`denali-tour-clone-hydration.spec.ts` · `tour-clone-hydrate.spec.ts`

---

## DEC-P11-008 — Denali review step + validation UX (11.7)

**تاریخ:** 2026-06-10  
**وضعیت:** ACCEPTED

### تصمیم

استپ `review` در تمپلیت Denali + validation client-side با `PlatformWizardEngine.validateCanonical` (همان engine API).

- **Continue:** فقط فیلدهای استپ فعال  
- **Create:** کل فرم؛ خطا → `useWizardStepValidation` + `scrollToFirstIssue`  
- **`publishStatus`:** enum `draft` / `active` روی استپ review (Layer C field)

Submit در `lastStepFooter` می‌ماند — داخل composite review نیست.

### رد شده در 11.7

- `prepareDenaliSubmitArtifact` کامل (**T7** addendum)  
- completion % header (**T9**)

### پذیرش

`denali-wizard-validation.spec.ts` · `denali-review-step.spec.ts`

---

## DEC-P11-009 — Rules parity hardening (11.8)

**تاریخ:** 2026-06-10  
**وضعیت:** ACCEPTED

### تصمیم

Port parity layer از legacy `denali-domain` بدون تغییر rule semantics:

1. **Transport dong** — web `isDenaliDongAmountVisible(mode, allowPersonalCar)` mirrors `isDenaliTransportDongAmountVisible`.
2. **`nationalIdRequired`** — خارج از composite `pricing-participants`؛ primitive boolean در plan.
3. **`DenaliUIContextOptions`** — `workspaceFormProfile` از tenant profile به `evaluateFormFieldRule`.
4. **Invariant engine** — `applyDenaliInvariantState` on every draft push (ghost purge).
5. **Template overlay** — `resolveDenaliRuleSetFromTemplate` delegates to `applyOverlayToRuleSet`.
6. **Catalog** — `altitudeM` on destinations؛ `formProfile` on tour themes for wizard filters.
7. **Submit** — `prepareDenaliTourCreatePayload` (sanitize + gear catalog filter + canonical roots); `createTourAction` passes Denali canonical through (no starter shim).

### پذیرش

`template-overlay.spec.ts` · `denali-transport-logic.spec.ts` · `denali-tour-create-payload.spec.ts`

---

## DEC-P11-010 — Server tour clone API (11.12)

**تاریخ:** 2026-06-10  
**وضعیت:** ACCEPTED

### زمینه

DEC-P11-007 عمداً clone را client-side نگه داشت (`?clone=` + wizard hydrate). برای automation و یک round-trip duplicate بدون باز کردن ویزارد، endpoint سرور لازم است.

### گزینه‌ها

| # | گزینه | نتیجه |
| - | ----- | ----- |
| A | منطق clone جدا در API (بدون plugin) | رد — drift از Denali transform |
| B | `plugin.tourClone` → `createTour` | **پذیرفته** |

### تصمیم

`POST /tours/{tourId}/clone`:

1. خواندن تور مبدأ با همان RBAC `getTourById`
2. `hydrateWizardDraft` روی `canonical.data` (تجهیزات اختیاری از body یا settings repo)
3. `ToursService.createTour` با `roots` / `data` hydrated — بدون مسیر validation جدا

Workspaceهای بدون `tourClone` (مثلاً starter) → `422 TOUR_CLONE_UNSUPPORTED`.

### پذیرش

`tours-clone.spec.ts` (API-P11-12-01 … 04)

---

## DEC-P11-011 — Clone photo remint (11.13)

**تاریخ:** 2026-06-11  
**وضعیت:** ACCEPTED

### زمینه

Clone عکس‌ها را با همان `id` و `storageKey` تور مبدأ کپی می‌کرد — preview ویزارد فقط `wizard-drafts/` را sign می‌کند.

### تصمیم

1. **Canonical** — `remintDenaliClonePhotosInCanonical` UUID جدید + `storageKey` مقصد (wizard-draft یا tour جدید).
2. **Wizard** — `hydrateWizardDraft` با `wizardSessionId` plan برمی‌گرداند؛ `POST /tours/clone-photo-remint` blobها را در MinIO کپی می‌کند.
3. **Server clone** — پس از `createTour`، remint + copy + `updateTour` وقتی MinIO پیکربندی شده.

عکس‌های فقط-URL: `url` حفظ؛ فقط `id` عوض می‌شود.

### پذیرش

`remint-denali-clone-photos.spec.ts` · `clone-photo-remint.spec.ts`

---

## DEC-P11-012 — Web BFF tour clone proxy (11.14)

**تاریخ:** 2026-06-11  
**وضعیت:** ACCEPTED

### تصمیم

`POST /api/tours/{tourId}/clone` در `apps/web` — همان الگوی `app/api/tours/[id]/route.ts` (session Bearer → upstream). منطق proxy در `proxy-tour-clone-api.server.ts` برای تست بدون Next runtime.

لیست تورها همچنان `/tours/new?clone=` — BFF برای duplicate یک‌مرحله‌ای اختیاری است.

### پذیرش

`proxy-tour-clone-api.spec.ts` (WEB-P11-14-01 … 02)

---

## DEC-P11-013 — Public catalog `spotsRemaining` (11.15)

**تاریخ:** 2026-06-11  
**وضعیت:** ACCEPTED

### تصمیم

`spotsRemaining = max(0, capacityMax − Σ approved.partySize)` روی کارت کاتالوگ Denali — بدون PII. فقط `status === "approved"` در occupancy؛ pending/waitlisted در API عمومی لحاظ نمی‌شوند.

`DenaliPublicBookingPort.sumApprovedPartySizeByTourIds` در host (`apps/api` bookings repo، RLS). `listDenaliCatalog` / `getDenaliCatalogTour` پس از `toDenaliCatalogCard` enrich می‌کنند.

### پذیرش

`compute-spots-remaining.spec.ts` · `catalog-spots-enrichment.spec.ts` · `denali-catalog.spec.ts` DCAT-04

---

## DEC-P11-014 — User Portal shell (`apps/portal`, 11.16)

**تاریخ:** 2026-06-11  
**وضعیت:** ACCEPTED

### تصمیم

`apps/portal` (dev port **3003**) میزبان `/catalog/{tourId}/register` + BFFهای `public-auth` و `POST /api/catalog/registrations` است. Marketing CTAها به portal base (`PORTAL_PUBLIC_BASE_URL` / `PORTAL_DEV_PORT`) اشاره می‌کنند. `apps/web` همان مسیر را به portal redirect می‌کند.

### پذیرش

`apps/portal/test/resolve-portal-base-url.spec.ts` · `apps/marketing/test/resolve-web-registration-url.spec.ts` MKT-08…11

---

## DEC-P11-015 — Operator `acceptedCount` from bookings (closure)

**تاریخ:** 2026-06-11  
**وضعیت:** ACCEPTED

### تصمیم

Stub `acceptedCount: 0` در `list-tours-operator` / `get-tour-operator` با همان aggregation تأییدشدهٔ کاتالوگ (`sumApprovedPartySizeByTourIds`) جایگزین شد — فقط `approved`، tenant-scoped.

لیست تور: دکمه **Quick copy** (`requestServerTourClone` → `/tours/{id}/edit`) کنار **Duplicate (wizard)** (`?clone=`).

### پذیرش

`tours-operator-accepted-count.spec.ts` OPS-ACC-01 · `operator-tours-duplicate-server` test id

---

## DEC-P11-016 — Wizard draft audit settings + theme `compatibleCategories` (11.17)

**تاریخ:** 2026-06-11  
**وضعیت:** ACCEPTED

### تصمیم

1. **Settings `/settings/wizard-drafts`** — فهرست `GET /workspaces/{id}/drafts` + timeline رویدادها per row (`wizard_drafts` module).
2. **`compatibleCategories`** — روی `GET /settings/resources/tour_themes` برای tenantهای Denali از `resolveThemeCompatibleCategories(formProfile)`؛ web filter از API field استفاده می‌کند.

### پذیرش

`workspace-draft-audit-logic.spec.ts` · `theme-compatible-categories.spec.ts` · `enrich-tour-theme-compatible-categories.spec.ts`

---

## DEC-P11-017 — Portal E2E smoke (11.18)

**تاریخ:** 2026-06-11  
**وضعیت:** ACCEPTED

### تصمیم

1. **`@apps/portal`** — Playwright `test:smoke` (SMK-PTL-01) با سرور smoke اختصاصی.
2. **Urban SMK-P8-02** — intake روی `urban.localhost:3003` (نه web `:3000`).
3. **`guard-public-catalog-m17`** — BFF و flow در portal؛ web فقط redirect shim.

### پذیرش

`portal-registration-smoke.spec.ts` · `guard-public-catalog-m17` · urban smoke servers portal boot

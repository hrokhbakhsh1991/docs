# 🗺️ Enterprise Transformation Map

**Tour Ops — از Denali-locked Platform به Workspace-Based Platform**

> **وضعیت سند:** نقشهٔ اجرایی (North Star + Migration Plan)  
> **اجرا:** هنوز شروع نشده — این فایل فقط مسیر را ثبت می‌کند  
> **آخرین هم‌ترازی با repo:** branch `main` (Tour Ops monorepo)

---

## 0. خلاصهٔ یک‌خطی

**Platform logic = generic · Workspace logic = injectable**

Core نباید Denali (یا هیچ workspace خاص) را بشناسد. Denali باید یک **Plugin** در `packages/workspaces/denali/` باشد، نه بخشی از engine.

---

## 1. هدف نهایی (Definition of Platform)

| ویژگی | معنی عملی |
|--------|-----------|
| **Workspace-agnostic Core** | هیچ `denali` / `Denali*` / `@repo/denali-domain` در لایهٔ platform |
| **Workspace = Plugin** | هر مدل کسب‌وکار = package مستقل + contract واحد |
| **Schema-driven UI** | field registry → rule engine → renderer → widget |
| **Canonical = تنها SoT** | یک state؛ RHF فقط adapter موقت (تا حذف در فاز ۴b) |
| **DB generic** | `canonical_data` JSON + `workspace_type`؛ بدون schema Denali در DB layer |
| **Workspace جدید بدون touch Core** | فقط plugin + bootstrap registry |

---

## 2. وضعیت فعلی repo (Baseline — قبل از Migration)

### 2.1 امتیازدهی کلی

| حوزه | وضعیت | شواهد |
|------|--------|--------|
| Core workspace-agnostic | 🔴 | ~223 فایل با `denali` در `apps/api` + `packages` + `libs` |
| Workspace به‌صورت package | 🔴 | `packages/workspaces/` وجود ندارد |
| Backend strategy pattern | 🟡 | `IWorkspaceStrategy` + `WorkspaceStrategyRegistry` فقط tours/backend |
| Dual state RHF + canonical | 🔴 | `DenaliWizardSyncContext`, adapter دوطرفه |
| Renderer coverage | 🔴 | `<input>` مستقیم در steps/sections؛ composite bypass |
| DB canonical | 🟡/🔴 | `trip_details` jsonb + ستون‌های ساخت‌یافته؛ template `canonical_data` |
| Guardrails پایه | 🟢 | depcruise، architecture-guardrails، denali-wizard CI |
| Guardrail «denali در core = fail» | 🔴 | وجود ندارد |

### 2.2 آنچه **از قبل** استخراج شده (Partial Phase 1/2)

| مسیر فعلی | نقش | وضعیت نسبت به هدف |
|-----------|------|---------------------|
| `packages/denali-domain/` (~114 فایل TS) | registry، rules، adapters، projection | ✅ domain جدا — ❌ هنوز **Core نیست**؛ نام و coupling Denali |
| `packages/types/src/denali/` | canonical wire types | 🟡 باید به workspace plugin برود |
| `packages/shared-contracts/src/tours/workspaces/denali*.ts` | workspace definition + invariants | 🟡 باید به plugin برود |
| `apps/api/.../strategies/` | `IWorkspaceStrategy` per profile | 🟡 backend-only؛ Denali-aware (`DENALI_STRATEGY_PROFILES`) |
| `packages/draft-engine/` | draft sync generic | ✅ workspace-agnostic |
| `libs/core/` | tenant config | ✅ بدون Denali |

### 2.3 coupling hotspots (اولویت حذف)

**Backend (`apps/api/src/modules/tours/` — 23 فایل Denali-touched):**

- `strategies/workspace.strategy.registry.ts` — `DENALI_STRATEGY_PROFILES`, `usesDenaliCanonicalTemplate`
- `utils/create-tour-form-profile-strip.ts`, `assert-create-tour-invariants.ts`
- `dto/trip-details.dto.ts`, `policies/assert-tour-publish-transition.ts`
- `entities/tour-details.entity.ts` — `trip_details` jsonb (شکل Denali-canonical)

**Frontend (~200+ فایل در `apps/web/src/features/tours/`):**

- `wizard/denali/**` (~185 فایل) — orchestration، contexts، steps
- `denali/sections/`, `denali/fields/DenaliFieldRenderer.tsx`
- `components/tours/wizard/WorkspaceTourWizard.tsx` — FormProvider + Denali providers
- `wizard/bindings/denali.ts` — lazy step registry
- duplicate generated: `wizard/denali/rules/generated/` vs `packages/denali-domain/.../generated/`

**Database entities:**

- `TourEntity` — ستون‌های list/filter (title, capacity, dates, price)
- `TourDetails.trip_details` — jsonb canonical trip shape
- `workspace_tour_wizard_template.canonical_data` — ✅ الگوی درست برای template
- `workspace_tour_creation_preset.canonical_data` — ✅

### 2.4 guardrails موجود (قابل گسترش)

| ابزار | مسیر | پوشش فعلی |
|--------|------|-----------|
| dependency-cruiser | `dependency-cruiser.config.js` | `denali-domain-no-apps-web`, façade boundaries در web/denali |
| architecture scripts | `scripts/check-tour-domain-guardrails.mjs` | EventKind legacy در tours/wizard |
| integrity gate | `scripts/ci-integrity-check.sh` | eslint + depcruise + tests |
| denali perf CI | `.github/workflows/denali-wizard-performance.yml` | benchmark wizard |
| registry audit | `tools/ci/registry-integrity-audit.ts` | field registry integrity |
| web verify | `apps/web/scripts/verify-denali-architecture.ts` | build gate |

---

## 3. ساختار packages هدف (Target Tree)

```text
packages/
  workspace-sdk/              # Contract + types (Phase 1) — ZERO denali imports
  platform-core/              # Field/Rule/Step/Renderer engines (Phase 2–3) — ZERO denali
  workspaces/
    denali/                   # Phase 2 — migration از denali-domain + types/denali + web UI slice
    urban/                    # Phase 4 — workspace دوم (DoD)
    <future>/
apps/
  api/                        # generic tour engine + plugin loader
  web/                        # generic wizard shell + plugin bootstrap
```

**قانون import:**

```text
platform-core  →  workspace-sdk
workspaces/*   →  workspace-sdk, platform-core (optional widgets)
apps/*         →  platform-core, workspace-sdk, workspaces/* (bootstrap only)
platform-core  →  workspaces/*   ❌ ممنوع
workspace-sdk  →  denali / workspaces/*   ❌ ممنوع
```

---

## 4. اصول غیرقابل مذاکره (Non-Negotiables)

1. **Core workspace-agnostic** — هیچ identifier `denali_*` / `Denali*` در `platform-core` و `workspace-sdk`
2. **Canonical = تنها SoT** — UI از canonical می‌خواند؛ update فقط canonical (فاز ۴b: حذف RHF mirror)
3. **Workspace = Plugin** — bootstrap از contract؛ بدون `if (profile === 'denali_pilot')` در core
4. **Renderer 100%** — ممنوع: `<input>`, `<select>`, `<textarea>` مستقیم در wizard path
5. **DB workspace-agnostic** — persist: `canonical_data` + `workspace_type` (+ index روی projection)

---

## 5. فازبندی Migration (بسیار دقیق)

> **قانون اجرا:** هر sub-phase = PR جدا + exit criteria + بدون شکستن CI موجود  
> **ترتیب:** Phase 1 → 2 → 3 → 4 → 5 (با overlap کنترل‌شده فقط جایی که ذکر شده)

---

### Phase 0 — Freeze & Baseline (پیش‌نیاز، ~1 PR)

**هدف:** خط مبدا قابل اندازه‌گیری قبل از هر refactor

| # | کار | خروجی | Exit criteria |
|---|-----|--------|---------------|
| 0.1 | ثبت این `map.md` در repo | `map.md` | merge به main |
| 0.2 | اسکریپت baseline metrics | `scripts/platform-transformation/baseline-metrics.mjs` | گزارش: تعداد فایل/خط denali per layer |
| 0.3 | snapshot تست سبز | CI green روی main | `pnpm test`, smoke wizard, API e2e isolation |
| 0.4 | freeze لیست workspace فعلی | doc در map | `denali_pilot`, `urban_event`, classic profiles |

**خروجی baseline metrics (هدف):**

```text
denali files: packages/denali-domain, apps/web/.../denali, apps/api/.../tours
@repo/denali-domain importers count
direct JSX inputs in wizard/denali/steps (rg count)
```

---

### Phase 1 — Contract Extraction (`packages/workspace-sdk`)

**هدف:** contract در **کد TypeScript** — بدون جابجایی Denali، بدون breaking production

#### Phase 1.1 — Scaffold package

| # | کار | فایل‌ها |
|---|-----|---------|
| 1.1.1 | ایجاد package | `packages/workspace-sdk/package.json`, `tsconfig.json` |
| 1.1.2 | exports | `@repo/workspace-sdk` — types + interfaces only |
| 1.1.3 | wire pnpm workspace | `pnpm-workspace.yaml` (already `packages/*`) |
| 1.1.4 | build در root `pnpm build` | اضافه به chain قبل از apps |

**Exit:** `pnpm --filter @repo/workspace-sdk build` سبز؛ **صفر** import از denali-domain

#### Phase 1.2 — تعریف Contract types

| Type / Interface | مسئولیت |
|----------------|----------|
| `WorkspacePluginId` | string slug (`denali`, `urban`) |
| `WorkspaceFieldDefinition` | path, zodKind, stepId, wire, visibility tags |
| `WorkspaceFieldRegistry` | readonly list + lookup by path |
| `WorkspaceStepDefinition` | stepId, order, titleKey, fieldPaths |
| `WorkspaceRuleSet` | hidden/required/conditional matrix |
| `WorkspaceWidgetKey` | enum/string — generic + custom |
| `WorkspaceWidgetMap` | zodKind / fieldType → widget key |
| `WorkspaceSchema` | Zod schema factory (generic `unknown` in/out) |
| `WorkspaceTransformers` | canonical ↔ API payload ↔ DB projection |
| `WorkspacePlugin` | **aggregate:** id, version, registry, steps, schema, rules, widgets, transformers |
| `CanonicalDocument` | `Record<string, unknown>` یا branded generic (نه DenaliCanonicalTourModel) |
| `WorkspacePluginLoader` | `load(id): WorkspacePlugin` |
| `WorkspacePluginRegistry` | register + resolve |

**مسیر پیشنهادی:**

```text
packages/workspace-sdk/src/
  index.ts
  canonical.types.ts
  field-registry.types.ts
  step-engine.types.ts
  rule-engine.types.ts
  widget-registry.types.ts
  schema.types.ts
  transformers.types.ts
  workspace-plugin.interface.ts
  plugin-registry.types.ts
```

**Exit:** unit tests: mock plugin boot بدون Denali؛ contract compile-only

#### Phase 1.3 — Bridge: `IWorkspaceStrategy` → SDK (backward compatible)

| # | کار | توضیح |
|---|-----|--------|
| 1.3.1 | adapter interface | `packages/workspace-sdk/src/backend-strategy-bridge.types.ts` |
| 1.3.2 | map existing strategy | `WorkspaceStrategyAdapter implements Partial<WorkspacePlugin>` — **فقط** backend slice (validation, publish, strip) |
| 1.3.3 | **بدون** تغییر رفتار API | existing tests سبز |

**فایل‌های API touched (minimal):**

- `apps/api/src/modules/tours/strategies/workspace.strategy.interface.ts` — re-export types از SDK یا extends
- optional: `workspace-plugin.adapter.ts` (جدید)

**Exit:** `WorkspaceStrategyRegistry` tests pass؛ adapter typed against SDK

#### Phase 1.4 — Guardrails Phase 1

| # | Guardrail | پیاده‌سازی |
|---|-----------|------------|
| 1.4.1 | SDK denali-free | `scripts/platform-transformation/check-workspace-sdk-purity.mjs` |
| 1.4.2 | depcruise rule | `workspace-sdk-no-workspace-packages` |
| 1.4.3 | CI step (non-blocking → blocking) | `architecture-guardrails.yml` |

**Exit:** CI fail اگر `denali` در `packages/workspace-sdk/`

#### Phase 1 — Definition of Done

- [ ] `@repo/workspace-sdk` publishable در monorepo
- [ ] `WorkspacePlugin` interface کامل (frontend + backend slices)
- [ ] Mock plugin + tests
- [ ] `IWorkspaceStrategy` به SDK وصل (adapter)
- [ ] Guardrail denali-free روی SDK
- [ ] **هیچ** جابجایی فایل Denali هنوز انجام نشده

---

### Phase 2 — Denali Isolation (`packages/workspaces/denali`)

**هدف:** Denali از «نام package در core graph» به «plugin» — core فقط `loadPlugin('denali')`

#### Phase 2.1 — ساخت shell workspace package

| # | کار |
|---|-----|
| 2.1.1 | `packages/workspaces/denali/package.json` — depends on `@repo/workspace-sdk` |
| 2.1.2 | `denaliPlugin: WorkspacePlugin` export |
| 2.1.3 | bootstrap در API/Web **هنوز** dual-path (legacy + plugin) |

#### Phase 2.2 — Migration domain layer (rename home, نه rewrite)

| منبع فعلی | مقصد | ترتیب |
|-----------|------|--------|
| `packages/denali-domain/**` | `packages/workspaces/denali/domain/**` | اول |
| `packages/types/src/denali/**` | `packages/workspaces/denali/types/**` | دوم |
| `packages/shared-contracts/.../workspaces/denali*.ts` | `packages/workspaces/denali/contracts/**` | سوم |
| `packages/shared-contracts/.../denali-wizard.contract.ts` | همان | سوم |

**استراتژی:** re-export shim در `@repo/denali-domain` برای backward compat تا Phase 3 (deprecated)

```text
@repo/denali-domain  →  re-exports from @repo/workspace-denali (temporary alias)
```

#### Phase 2.3 — API: plugin loader

| # | کار | فایل |
|---|-----|------|
| 2.3.1 | `WorkspacePluginRegistry` service | `apps/api/src/modules/workspaces/` (جدید) |
| 2.3.2 | resolve `workspace_type` از tenant/settings | integrate با `TenantEntity` / tour `form_profile_snapshot` |
| 2.3.3 | `validate(plugin.schema, canonical)` generic entry | جایگزین تدریجی `assert-create-tour-invariants` branches |
| 2.3.4 | migrate `MountainOutdoorWorkspaceStrategy` | `packages/workspaces/denali/backend/strategy.ts` |

**Exit API:**

- [ ] create/update tour از plugin schema validate می‌شود (shadow mode: log diff)
- [ ] `rg denali apps/api/src/modules/tours/strategies` → فقط adapter imports

#### Phase 2.4 — حذف Denali constants از API core paths

| حذف/جایگزین | با |
|-------------|-----|
| `DENALI_STRATEGY_PROFILES` در registry | plugin id + profile map در denali package |
| `usesDenaliCanonicalTemplate()` | `plugin.features.canonicalTemplate` |
| `appliesDenaliSingleDayLogisticsStrip` | plugin transformer rule |

#### Phase 2.5 — Web: bootstrap plugin (بدون renderer refactor)

| # | کار |
|---|-----|
| 2.5.1 | `WorkspacePluginProvider` — load denali plugin config |
| 2.5.2 | `WorkspaceTourWizard` — resolve plugin از context نه hardcoded denali |
| 2.5.3 | **هنوز** render همان Denali steps (legacy path) |

#### Phase 2 — Definition of Done

- [ ] `packages/workspaces/denali` implements `WorkspacePlugin`
- [ ] `@repo/denali-domain` = thin re-export (deprecated notice)
- [ ] API plugin loader + shadow validation
- [ ] `rg -i denali apps/api/src/modules/workspaces` allowed; `rg -i denali packages/workspace-sdk` = 0
- [ ] smoke + integration denali tests سبز

---

### Phase 3 — Renderer Refactor (Generic Engine)

**هدف:** UI فقط `registry → renderer → widget`؛ حذف تدریجی JSX دستی

#### Phase 3.1 — `packages/platform-core` (frontend engine)

| Module | مسئولیت |
|--------|----------|
| `FieldRegistryEngine` | lookup field by path |
| `RuleEngine` | `isVisible`, `isRequired`, `isDisabled` — pure |
| `StepEngine` | step order, active fields per step |
| `RendererContract` | field → widget key + props |
| `GenericFieldRenderer` | dispatch to widget registry |
| `CompositeFieldRenderer` | nested/group — **جایگزین bypass** |

**وابستگی:** فقط `@repo/workspace-sdk`

#### Phase 3.2 — Widget registry (generic + plugin)

| لایه | محل |
|------|-----|
| Generic widgets | `packages/platform-core/widgets/` — Text, Select, Checkbox, Date… |
| Denali custom widgets | `packages/workspaces/denali/widgets/` — map, gear, itinerary… |
| Merge at runtime | `plugin.widgets` overrides/extends core |

#### Phase 3.3 — Migrate steps (یک step در هر PR)

**ترتیب پیشنهادی (کم‌ریسک → پرریسک):**

| PR # | Step file | فیلدها |
|------|-----------|--------|
| 3.3.1 | `DenaliLegalStep.tsx` | کم، mostly static |
| 3.3.2 | `DenaliPhotosStep.tsx` | medium |
| 3.3.3 | `DenaliBasicInfoStep.tsx` | medium |
| 3.3.4 | `DenaliPricingStep.tsx` | composite pricing |
| 3.3.5 | `DenaliLogisticsStep.tsx` | map/location widgets |
| 3.3.6 | `DenaliProgramNatureStep.tsx` | itinerary composite |
| 3.3.7 | `DenaliReviewStep.tsx` | read-only summary |

**هر PR exit criteria:**

- [ ] step فقط `GenericFieldRenderer` + plugin widgets
- [ ] `rg '<input|<select|<textarea' <step-file>` = 0
- [ ] structural guard tests pass
- [ ] smoke spec مربوط به step pass

#### Phase 3.4 — حذف / deprecate

| حذف | شرط |
|-----|------|
| `DenaliFieldRenderer.tsx` | وقتی edit flow روی generic renderer |
| `denali/sections/*` direct mounts | merge به renderer |
| duplicate `rules/generated` در web | فقط plugin package |
| `DenaliCanonicalContext` | بعد از Phase 4a canonical SoT |

#### Phase 3.5 — ESLint guard

| Rule | scope |
|------|-------|
| `no-restricted-syntax` | JSX form controls in `**/wizard/**` |
| `no-restricted-imports` | `@repo/denali-domain` from `platform-core` |

**Exit Phase 3:**

- [ ] `platform-core` denali-free
- [ ] تمام 6+1 steps از renderer
- [ ] ESLint wizard control rule = error در CI
- [ ] `pnpm qa:smoke:tour-wizard` + denali integration سبز

---

### Phase 4 — Canonical SoT + Second Workspace (DoD واقعی)

**هدف:** ثابت کردن platform با workspace دوم **بدون** تغییر core

#### Phase 4a — Canonical single state (RHF → thin adapter)

| # | کار | ریسک |
|---|-----|------|
| 4a.1 | `CanonicalStore` (React context یا zustand) | medium |
| 4a.2 | user input → `updateCanonical(path, value)` | medium |
| 4a.3 | RHF: فقط `useForm` برای zod resolver submit | high — تدریجی |
| 4a.4 | حذف `DenaliWizardSyncContext` dual write | high |
| 4a.5 | round-trip tests: canonical ↔ API payload | required |

**Exit 4a:**

- [ ] هیچ `setValue`/`getValues` برای **render** UI
- [ ] adapter sync tests 100% pass
- [ ] draft-engine از canonical feed شود (`denali-adapter` → generic)

#### Phase 4b — Second workspace: `packages/workspaces/urban`

| # | deliverable |
|---|-------------|
| 4b.1 | `urbanPlugin: WorkspacePlugin` — minimal fields (title, date, capacity, price) |
| 4b.2 | 3-step wizard (basic → details → review) |
| 4b.3 | tenant provision: `urban.localhost` (reuse `provision:tenant` pattern) |
| 4b.4 | **صفر** PR در `platform-core` — فقط plugin + seed |
| 4b.5 | E2E: create → publish → list |

**فایل‌های مرجع urban موجود:**

- profile `urban_event` در strategy registry
- smoke: `04-tour-wizard-urban-profile.spec.ts`
- integration: `wizard-real-stack.submit-urban.spec.ts`

#### Phase 4 — Definition of Done (Platform milestone)

- [ ] `packages/workspaces/urban` بدون تغییر `platform-core`
- [ ] denali + urban همان engine (`GenericFieldRenderer`, `StepEngine`)
- [ ] E2E هر دو workspace
- [ ] canonical SoT برای denali (4a complete)
- [ ] `rg -i denali packages/platform-core packages/workspace-sdk` → **0**

---

### Phase 5 — Data Layer Refactor

**هدف:** DB فقط generic storage + projection indexes

#### Phase 5.1 — Schema design

```sql
-- هدف (مفهومی)
tours (
  id,
  tenant_id,
  workspace_type,      -- 'denali' | 'urban' | ...
  canonical_data JSONB NOT NULL,
  status,
  -- projected columns (generated or maintained by trigger/app):
  title TEXT,
  starts_on DATE,
  ends_on DATE,
  list_price_minor BIGINT,
  ...
)
```

#### Phase 5.2 — Migration sub-phases

| # | کار |
|---|-----|
| 5.2.1 | migration:add `workspace_type`, `canonical_data` nullable |
| 5.2.2 | backfill script از `TourEntity` + `TourDetails.trip_details` |
| 5.2.3 | dual-read period (structured + canonical) |
| 5.2.4 | API write → canonical only |
| 5.2.5 | drop/deprecate Denali-specific columns (major version) |

#### Phase 5.3 — Index strategy

- GIN روی `canonical_data` **فقط** اگر query pattern نیاز دارد
- ترجیح: projected columns برای list/filter/sort
- plugin `transformers.toProjection(canonical)` → update projected cols

#### Phase 5 — Definition of Done

- [ ] API persist فقط `canonical_data` + `workspace_type`
- [ ] list/filter روی projected columns
- [ ] backfill verified روی staging
- [ ] rollback plan documented

---

## 6. Guardrails — نقشهٔ کامل (فاز به فاز)

| فاز | Guardrail | فایل | blocking |
|-----|-----------|------|----------|
| 1 | SDK denali-free | `check-workspace-sdk-purity.mjs` | ✅ |
| 1 | depcruise: sdk ↛ workspaces | `dependency-cruiser.config.js` | ✅ |
| 2 | core ↛ `@repo/workspaces/*` (platform-core بعداً) | depcruise | ✅ |
| 2 | denali فقط در `packages/workspaces/denali` | `check-workspace-plugin-isolation.mjs` | ✅ |
| 3 | no direct form controls in wizard | ESLint custom rule | ✅ |
| 3 | platform-core denali-free | rg script | ✅ |
| 4 | urban boot without denali import | jest isolation test | ✅ |
| 4 | no dual-write pattern | ast-grep / custom lint | 🟡 |
| 5 | no Denali column writes | API integration test | ✅ |
| all | baseline metrics regression | `baseline-metrics.mjs` compare | 📊 report |

**دستورات هدف (Definition of Done نهایی):**

```bash
rg -i denali packages/platform-core packages/workspace-sdk   # → 0
rg '<input|<select|<textarea' apps/web/src/features/tours/wizard --glob '!*.spec.*'  # → 0
pnpm guardrails:platform-isolation                            # → pass (future script)
```

---

## 7. تست‌ها — نقشهٔ حفاظت در هر فاز

| لایه | مسیر | فاز فعال |
|------|------|----------|
| denali-domain unit | `packages/denali-domain/src/**/*.spec.ts` | 1–2 |
| workspace-sdk unit | `packages/workspace-sdk/src/**/*.spec.ts` | 1+ |
| structural guards | `apps/web/.../denali/__tests__/guards/` | 3 |
| smoke playwright | `apps/web/src/features/tours/__tests__/smoke/` | all |
| integration real-stack | `.../integration/wizard-real-stack.*.spec.ts`Dto` | 2–4 |
| API e2e isolation | `pnpm test:e2e:isolation` | all |
| denali perf | `.github/workflows/denali-wizard-performance.yml` | 3 |
| **urban E2E (new)** | `wizard-real-stack.submit-urban.spec.ts` + plugin boot test | 4 |

**قانون:** هیچ PR فاز N merge نشود اگر smoke + isolation مربوط به Denali قرمز شود.

---

## 8. وابستگی بین فازها (DAG)

```text
Phase 0 (baseline)
    ↓
Phase 1 (workspace-sdk contract)
    ↓
Phase 2 (denali → workspaces/denali) ──→ Phase 5 (data) can start shadow/backfill after 2.3
    ↓
Phase 3 (renderer / platform-core)
    ↓
Phase 4a (canonical SoT) ── parallel tail of 3.3
    ↓
Phase 4b (urban plugin = Platform DoD)
    ↓
Phase 5 (DB cutover)
```

**Overlap مجاز:**

- Phase 5.2.1 migration schema می‌تواند همزمان Phase 3 (قبل از cutover)
- Phase 4a می‌تواند از step 3.3.3 به بعد موازی شود

**Overlap ممنوع:**

- Phase 4b قبل از Phase 3.1 (engine باید generic باشد)
- Phase 5 cutover قبل از Phase 4a (canonical باید stable باشد)

---

## 9. ریسک‌ها و mitigations

| ریسک | شدت | Mitigation |
|------|------|------------|
| Canonical coupling (`DenaliCanonicalTourModel`) | 🔴 | SDK generic `CanonicalDocument`; rename در plugin |
| Renderer ناقص | 🔴 | step-by-step PR + ESLint |
| Dual state RHF + canonical | 🔴 | Phase 4a؛ feature flag `CANONICAL_SOT=1` |
| Composite widget bypass | 🟠 | `CompositeFieldRenderer` در platform-core |
| Backend schema coupling | 🟠 | shadow validation Phase 2.3 |
| `@repo/denali-domain` importers (~80+) | 🟠 | re-export shim؛ codemod تدریجی |
| shared-contracts build (`moduleResolution`) | 🟡 | fix tsconfig Node16 (جدا از migration) |
| DB migration downtime | 🔴 | dual-read/write + backfill |

---

## 10. چک‌لیست Definition of Done — Platform محسوب می‌شود وقتی:

- [ ] **Phase 1–4b** همه complete
- [ ] workspace جدید (`urban`) بدون تغییر `platform-core`
- [ ] `rg -i denali packages/platform-core packages/workspace-sdk` → 0
- [ ] Wizard: 0 input مستقیم در JSX (ESLint enforced)
- [ ] E2E denali + urban با **همان** engine
- [ ] API: `validate(plugin.schema, canonical)` — بدون `validateDenaliTour`
- [ ] DB: `canonical_data` + `workspace_type` (Phase 5 complete)
- [ ] baseline metrics: denali importers in apps/web ↓ ≥90% vs Phase 0

---

## 11. Appendix A — فایل‌های کلیدی (مرجع سریع)

### Registry & codegen (امروز → فردا در plugin)

| نقش | مسیر فعلی |
|-----|-----------|
| Authoritative registry | `packages/denali-domain/src/registry/denaliFieldRegistryData.ts` |
| Codegen | `apps/web/scripts/generate-denali-wizard-config.ts` |
| Generated rules | `packages/denali-domain/src/rules/generated/` |
| Web duplicate (حذف در 2.5) | `apps/web/.../wizard/denali/rules/generated/` |

### Adapter / SoT (امروز)

| نقش | مسیر |
|-----|------|
| SSOT adapter | `packages/denali-domain/src/adapters/denaliCanonicalFormAdapter.ts` |
| Sync context | `apps/web/.../denali/DenaliWizardSyncContext.tsx` |
| Draft bridge | `apps/web/.../drafts/denali-adapter.ts` |

### Backend strategy (امروز → plugin backend)

| نقش | مسیر |
|-----|------|
| Interface | `apps/api/.../strategies/workspace.strategy.interface.ts` |
| Registry | `apps/api/.../strategies/workspace.strategy.registry.ts` |
| Denali strategy | `apps/api/.../strategies/mountain-outdoor.workspace.strategy.ts` |

### Orchestrator (امروز → generic shell)

| نقش | مسیر |
|-----|------|
| Main wizard | `apps/web/src/components/tours/wizard/WorkspaceTourWizard.tsx` |
| Denali bindings | `apps/web/src/features/tours/wizard/bindings/denali.ts` |

---

## 12. Appendix B — آنچه عمداً **الان** انجام نمی‌شود

- ❌ scaffold `workspace-sdk` (Phase 1 — بعد از تأیید این map)
- ❌ جابجایی فایل‌های Denali
- ❌ تغییر DB schema production
- ❌ حذف یک‌باره RHF
- ❌ rewrite کامل `WorkspaceTourWizard` قبل از Phase 3

---

## 13. جملهٔ نهایی

> **Platform logic = generic**  
> **Workspace logic = injectable**

این repo امروز **engine پیشرفتهٔ Denali** دارد. این map مسیر تبدیل آن به **Platform** را — PR به PR — ثبت می‌کند.

---

*برای شروع اجرا: Phase 0 → Phase 1.1. هر sub-phase یک PR با exit criteria همین سند.*

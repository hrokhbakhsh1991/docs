# Enterprise Transformation Map

**Tour Ops — از Denali-locked Platform به Workspace-Based Platform**

> **وضعیت:** نقشهٔ اجرایی (North Star + Migration Plan)  
> **اجرا:** طبق فازها — هر sub-phase = PR جدا  
> **آخرین هم‌ترازی:** branch `main` (Tour Ops monorepo)

---

## خلاصهٔ یک‌خطی

**Platform logic = generic · Workspace logic = injectable**

Core نباید Denali (یا هیچ workspace خاص) را بشناسد. Denali = **Plugin** در `packages/workspaces/denali/`، نه بخشی از engine.

---

## 1. هدف نهایی

| ویژگی | معنی عملی |
|--------|-----------|
| Workspace-agnostic Core | بدون `denali` / `Denali*` / `@repo/denali-domain` در لایهٔ platform |
| Workspace = Plugin | هر مدل کسب‌وکار = package مستقل + contract واحد |
| Schema-driven UI | registry → rule engine → renderer → widget |
| Canonical = تنها SoT | RHF فقط adapter موقت (حذف در Phase 4a) |
| DB generic | `canonical_data` JSON + `workspace_type` |
| Workspace جدید | فقط plugin + bootstrap — بدون touch core |

---

## 2. وضعیت فعلی repo (Baseline)

### امتیازدهی

| حوزه | وضعیت | شواهد |
|------|--------|--------|
| Core workspace-agnostic | 🔴 | `denali` در `apps/api`, `packages`, `libs` |
| Workspace به‌صورت package | 🔴 | `packages/workspaces/` وجود ندارد |
| Backend strategy | 🟡 | `IWorkspaceStrategy` فقط tours/backend |
| Dual state RHF + canonical | 🔴 | `DenaliWizardSyncContext`, adapter دوطرفه |
| Renderer coverage | 🔴 | input مستقیم در steps/composites |
| DB canonical | 🟡/🔴 | `trip_details` jsonb + template `canonical_data` |
| Guardrails پایه | 🟢 | depcruise, architecture-guardrails, denali CI |
| Guardrail «denali در core = fail» | 🔴 | وجود ندارد |

### استخراج‌های جزئی (قبل از migration کامل)

| مسیر | نقش |
|------|------|
| `packages/denali-domain/` | registry, rules, adapters — هنوز Denali-named |
| `packages/types/src/denali/` | canonical wire types → باید به plugin |
| `shared-contracts/.../workspaces/denali*.ts` | workspace definition → باید به plugin |
| `apps/api/.../strategies/` | backend strategy — Denali-aware |
| `packages/draft-engine/` | ✅ generic |
| `libs/core/` | ✅ بدون Denali |

### Hotspots حذف (اولویت)

- **API:** `workspace.strategy.registry.ts`, `create-tour-form-profile-strip`, `trip-details.dto`, `tour-details.entity`
- **Web:** `wizard/denali/**`, `denali/fields`, `WorkspaceTourWizard.tsx`, `bindings/denali.ts`, duplicate `rules/generated/`
- **DB:** `TourEntity` columns + `TourDetails.trip_details` jsonb

---

## 3. ساختار packages هدف

```text
packages/
  workspace-sdk/           # Contract — ZERO denali imports
  platform-core/           # Field/Rule/Step/Renderer — ZERO denali
  workspaces/
    denali/                # migration از denali-domain + types + web slice
    urban/                 # workspace دوم (DoD)
apps/
  api/                     # generic engine + plugin loader
  web/                     # generic wizard shell + bootstrap
```

**قانون import:**

```text
platform-core  →  workspace-sdk
workspaces/*   →  workspace-sdk, platform-core (optional)
apps/*         →  platform-core, workspace-sdk, workspaces/* (bootstrap)
platform-core  →  workspaces/*   ❌
workspace-sdk  →  workspaces/*     ❌
```

---

## 4. اصول غیرقابل مذاکره

1. Core workspace-agnostic — بدون `denali_*` در `platform-core` و `workspace-sdk`
2. Canonical = تنها SoT — UI از canonical؛ update فقط canonical (Phase 4a: حذف RHF mirror)
3. Workspace = Plugin — bootstrap از contract؛ بدون `if (profile === 'denali_pilot')` در core
4. Renderer 100% — ممنوع: `<input>`, `<select>`, `<textarea>` مستقیم در wizard path
5. DB workspace-agnostic — `canonical_data` + `workspace_type`

---

## 5. فازبندی Migration

> هر sub-phase = PR جدا + exit criteria · ترتیب: **0 → 1 → 2 → 3 → 4 → 5**

### Phase 0 — Freeze & Baseline (~1 PR)

> **جزئیات اجرایی و تحلیل مسیر:** [`phase-0-platform-baseline.md`](phase-0-platform-baseline.md)

| # | کار | Exit |
|---|-----|------|
| 0.1 | ثبت `map.md` | merge |
| 0.2 | `scripts/platform-transformation/baseline-metrics.mjs` | گزارش denali per layer |
| 0.3 | CI green روی main | test + smoke |
| 0.4 | freeze لیست workspace | `denali_pilot`, `urban_event`, classic profiles |

---

### Phase 1 — Contract (`packages/workspace-sdk`)

**هدف:** contract در TypeScript — بدون جابجایی Denali

| Sub-phase | کار | Exit |
|-----------|-----|------|
| 1.1 | scaffold `@repo/workspace-sdk` | build سبز؛ صفر import از denali-domain |
| 1.2 | types: `WorkspacePlugin`, `WorkspaceFieldRegistry`, `WorkspaceRuleSet`, `CanonicalDocument`, … | mock plugin tests |
| 1.3 | bridge `IWorkspaceStrategy` → SDK (backward compatible) | API tests سبز |
| 1.4 | guardrail: SDK denali-free + depcruise | CI fail اگر denali در SDK |

**DoD Phase 1:** `@repo/workspace-sdk` + mock plugin + adapter — **هنوز بدون جابجایی فایل Denali**

---

### Phase 2 — Denali Isolation (`packages/workspaces/denali`)

| Sub-phase | کار |
|-----------|-----|
| 2.1 | shell package + `denaliPlugin: WorkspacePlugin` |
| 2.2 | move: `denali-domain` → `workspaces/denali/domain`؛ types؛ contracts — shim `@repo/denali-domain` موقت |
| 2.3 | API `WorkspacePluginRegistry` + shadow validation |
| 2.4 | حذف `DENALI_STRATEGY_PROFILES` و constants از API core |
| 2.5 | Web `WorkspacePluginProvider` — هنوز legacy render path |

**DoD Phase 2:** plugin implements contract · API loader · `workspace-sdk` بدون denali

---

### Phase 3 — Renderer (`packages/platform-core`)

| Sub-phase | کار |
|-----------|-----|
| 3.1 | `FieldRegistryEngine`, `RuleEngine`, `StepEngine`, `GenericFieldRenderer`, `CompositeFieldRenderer` |
| 3.2 | generic widgets در core؛ custom در `workspaces/denali/widgets` |
| 3.3 | migrate steps یکی‌یکی (Legal → Photos → Basic → Pricing → Logistics → Program → Review) |
| 3.4 | deprecate `DenaliFieldRenderer`, duplicate generated rules, sections bypass |
| 3.5 | ESLint: no form controls در `**/wizard/**` |

**DoD Phase 3:** تمام steps از renderer · `platform-core` denali-free · smoke سبز

---

### Phase 4 — Canonical SoT + Workspace دوم

**4a — Single canonical state**

- `CanonicalStore` · input → `updateCanonical` · RHF فقط برای submit resolver
- حذف `DenaliWizardSyncContext` dual write
- round-trip tests canonical ↔ API

**4b — `packages/workspaces/urban` (Platform DoD)**

- minimal plugin · 3-step wizard · tenant provision · E2E create → publish
- **صفر** PR در `platform-core`

**DoD Phase 4:** urban بدون تغییر core · denali + urban همان engine · canonical SoT

---

### Phase 5 — Data Layer

- schema: `workspace_type`, `canonical_data` JSONB
- backfill از `TourEntity` + `trip_details`
- dual-read → write canonical only → deprecate Denali-specific columns
- list/filter روی projected columns (نه GIN روی کل JSON مگر لازم)

**DoD Phase 5:** API persist فقط canonical + workspace_type · backfill verified

---

## 6. Guardrails (فاز به فاز)

| فاز | Guardrail | blocking |
|-----|-----------|----------|
| 1 | SDK denali-free | ✅ |
| 2 | core ↛ workspaces (تا platform-core) | ✅ |
| 3 | no direct form controls در wizard | ✅ |
| 4 | urban بدون import denali | ✅ |
| all | baseline metrics regression | 📊 |

```bash
rg -i denali packages/platform-core packages/workspace-sdk   # → 0 (هدف نهایی)
rg '<input|<select|<textarea' apps/web/.../wizard --glob '!*.spec.*'  # → 0
```

---

## 7. تست‌ها

| لایه | مسیر | فاز |
|------|------|-----|
| denali-domain unit | `packages/denali-domain/**/*.spec.ts` | 1–2 |
| workspace-sdk unit | `packages/workspace-sdk/**/*.spec.ts` | 1+ |
| structural guards | `wizard/denali/__tests__/guards/` | 3 |
| smoke | `features/tours/__tests__/smoke/` | all |
| integration | `integration/wizard-real-stack.*.spec.ts` | 2–4 |
| API e2e | `pnpm test:e2e:isolation` | all |
| urban E2E | `submit-urban.spec.ts` | 4 |

**قانون:** هیچ PR فاز N اگر smoke/isolation Denali قرمز باشد.

---

## 8. وابستگی فازها (DAG)

```text
Phase 0 → Phase 1 → Phase 2 ──→ Phase 5 (shadow بعد از 2.3)
              ↓
         Phase 3 → Phase 4a → Phase 4b → Phase 5 cutover
```

**Overlap مجاز:** Phase 5 schema موازی Phase 3 · Phase 4a از step 3.3.3  
**Overlap ممنوع:** Phase 4b قبل از 3.1 · Phase 5 cutover قبل از 4a

---

## 9. ریسک‌ها

| ریسک | Mitigation |
|------|------------|
| `DenaliCanonicalTourModel` coupling | `CanonicalDocument` generic در SDK |
| Renderer ناقص | step-by-step PR + ESLint |
| Dual state | Phase 4a + feature flag |
| Composite bypass | `CompositeFieldRenderer` |
| `@repo/denali-domain` importers | re-export shim + codemod |
| DB migration | dual-read/write + backfill |

---

## 10. Definition of Done — Platform

- [ ] Phase 1–4b complete
- [ ] workspace جدید بدون تغییر `platform-core`
- [ ] `rg -i denali packages/platform-core packages/workspace-sdk` → 0
- [ ] Wizard: 0 input مستقیم (ESLint)
- [ ] E2E denali + urban
- [ ] API: `validate(plugin.schema, canonical)`
- [ ] DB: `canonical_data` + `workspace_type`

---

## 11. مرجع سریع (مسیرهای کلیدی امروز)

| نقش | مسیر |
|-----|------|
| Registry | `packages/denali-domain/src/registry/denaliFieldRegistryData.ts` |
| Codegen | `apps/web/scripts/generate-denali-wizard-config.ts` |
| Adapter / sync | `denaliCanonicalFormAdapter.ts`, `DenaliWizardSyncContext.tsx`, `drafts/denali-adapter.ts` |
| API strategy | `apps/api/.../strategies/workspace.strategy.*` |
| Wizard shell | `WorkspaceTourWizard.tsx`, `wizard/bindings/denali.ts` |

---

## شروع اجرا

**Phase 0 → Phase 1.1** — هر sub-phase یک PR با exit criteria همین سند؛ فاز ۰: [`phase-0-platform-baseline.md`](phase-0-platform-baseline.md).

> Platform logic = generic · Workspace logic = injectable

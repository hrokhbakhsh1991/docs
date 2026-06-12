# نقشه راه Enterprise — ویزارد Denali و پلتفرم چند-Workspace

> **تاریخ:** 2026-06-11  
> **وضعیت:** پیش‌نویس اجرایی — فایل موقت (`TEMP/`)  
> **مخاطب:** Architect / تیم پیاده‌سازی  
> **ورودی‌ها:**  
> - [`TEMP/wizard-template-settings-gaps.md`](wizard-template-settings-gaps.md)  
> - [`TEMP/wizard-platform-implementation-roadmap.md`](wizard-platform-implementation-roadmap.md)  
> - [`docs/phase-11/denali-rules-parity.md`](../docs/phase-11/denali-rules-parity.md)  
> - [`docs/workspaces/denali/wizard-experience.md`](../docs/workspaces/denali/wizard-experience.md)

---

## پاسخ به سوال اصلی

### آیا Denali «اولین مشتری» است و زیرساخت باید global باشد؟

**بله — این مدل در trunk همین است:**

| لایه | نقش | Denali امروز |
|------|-----|--------------|
| `platform-core` | موتور headless: RenderPlan + validate ماتریسی | generic |
| `workspace-sdk` | قرارداد `WorkspacePlugin` | generic |
| `packages/workspaces/denali` | قوانین، registry، clone، draft envelope | **مشتری اول** |
| `apps/web` | shell `/tours/new` + host | باید generic باشد؛ **امروز Denali-heavy** |

Denali **reference implementation** است — نه fork. Urban/Starter بعداً همان engine را با plugin متفاوت می‌گیرند؛ **شرط‌ها و استپ‌ها در workspace دیگر می‌تواند کاملاً متفاوت باشد** و نباید در web core hardcode شود.

### آیا شرط‌ها و قوانین Legacy Denali رعایت می‌شوند؟

**پاسخ کوتاه: بخش بزرگ create-wizard بله (Phase 11.8)؛ کل Legacy خیر — شکاف‌های مشخص باقی است.**

#### ✅ بسته / parity تأیید‌شده (create flow)

| حوزه Legacy | وضعیت trunk | مرجع |
|-------------|-------------|------|
| ماتریس category × duration | ✅ ruleSet + overlay | `denaliRuleSet`, `templateOverlay` |
| Dong × `allowPersonalCar` | ✅ | `denali-transport-logic.spec.ts` |
| Ghost values (فیلد مخفی → پاک canonical) | ✅ | `applyDenaliInvariantState` |
| `fieldRulesOverlay` از settings | ✅ | `resolveDenaliRuleSetFromTemplate` |
| `nationalIdRequired` جدا از composite | ✅ | 11.8-T2 |
| Per-step validation + focus field | ✅ | `wizard-navigation`, 11.4/11.7 |
| Review step + validation summary | ✅ | 11.7 (gaps §۴ قدیمی — **stale**) |
| Autosave + OCC + conflict | ✅ | draft-engine, 11.1–11.5 |
| Clone `?clone=` + photo remint | ✅ | 11.6, 11.12–11.14 |
| `workspaceFormProfile` در rule eval | ✅ (11.8-T3) | `buildDenaliWizardRuleEvalContext` — gaps §۱۲.۴ **stale** |

#### ⚠️ partial — رفتار Legacy ناقص یا تست نشده

| حوزه | شکاف |
|------|------|
| فیلتر equipment بر `compatibleCategories` | entity/API ناقص |
| theme `formProfile` روی API resource | type/API ندارد؛ فیلتر web partial |
| Leaders multiselect + rewards labels | tab/labels/fallback همه users |
| Event tour → destinations خالی | unverified |
| Stale UUID sanitize (theme/destination/gear) | submit بدون normalize کامل |
| Peak height prefill از destination catalog | altitudeM partial |
| Template builder (section-groups, stepOverrides) | flat checkbox UI |
| Server publish gate / readiness | UI هست؛ API block ندارد |

#### ❌ باز — Legacy داشت؛ trunk ندارد

| حوزه | Legacy | Trunk |
|------|--------|-------|
| **Edit tour کامل** | `DenaliTourEditForm` | فقط title PATCH (R1) |
| **Preset → wizard** | prefill | CRUD بدون `?preset=` |
| **Guide languages → wizard** | — | CRUD؛ wizard متن آزاد |
| **Leave dirty modal** | beforeunload | ندارد |
| **Version diff / rollback** | — | ندارد |
| **Approval workflow / field comments** | — | Phase 12+ |
| **Layer C deprecated fields** | `paymentMode`, meeting fields | defer |

**قاعده طلایی parity:** semantics قوانین domain در `packages/workspaces/denali` **frozen** — فازهای زیر فقط wire، encapsulation، و UX هستند؛ تغییر rule بدون DEC + تأیید صاحب workspace **ممنوع**.

---

## اصول غیرقابل مذاکره (North Star)

1. **Doc-first** — تغییر `platform-core` / `workspace-sdk` / `apps/api` → ابتدا `docs/phase-12/…` یا به‌روزرسانی phase-11.
2. **Core بدون import مستقیم Denali** — فقط registry/bootstrap.
3. **WorkspacePlugin = single extension point** — rules، composites، draft binding، clone، review، submit payload.
4. **Partial save ≠ full validate** — autosave بدون Zod کامل؛ validate در step-gate و submit.
5. **Tenant boundary** — draft key: `(tenantId, workspaceId, draftNamespace, draftKey)`.
6. **Denali = reference customer** — هر abstraction باید از Denali extract شود، نه hardcode برای Denali در web.

---

## نمای کلی فازها

```text
Phase 0  ──► درک، audit parity، baseline تست
Phase 1  ──► معماری platform (decouple web core)     ← blocker برای workspace #2
Phase 2  ──► تکمیل parity Legacy (create + settings chain)
Phase 3  ──► Denali product (edit, preset, builder UX)
Phase 4  ──► Enterprise Tier B (publish gate, audit, versioning)
Phase 5  ──► Workspace #2 readiness (Urban pilot — hooks only)
Phase 6  ──► Polish (visual baseline, motion, E2E)
```

**DAG:** `0 → 1 → 2 → 3` · `1 → 5` · `3 → 4` · `2,3 → 6`

---

# Phase 0 — Audit و baseline (۱–۲ هفته)

> **هدف:** snapshot واقعی trunk vs Legacy؛ جلوگیری از کار روی gaps doc stale.

## 0.1 — همگام‌سازی مستندات gap

| ID | تسک | توضیح کامل | پذیرش |
|----|-----|------------|-------|
| **0.1-T1** | بازبینی `wizard-template-settings-gaps.md` §۴–§۱۳ | §۴ review، §۱۳ persistence/clone/validation در Phase 11 بسته شده — علامت ✅ بزن یا بخش «تاریخچه» اضافه کن تا تیم گمراه نشود. | هر ردیف stale با تاریخ و subphase مرجع |
| **0.1-T2** | ماتریس parity واحد | یک جدول master: Legacy behavior → trunk file → test spec → status | فایل `TEMP/denali-legacy-parity-matrix.md` |
| **0.1-T3** | Inventory import leakage | `rg '@app-tour/workspace-denali"' apps/web --glob '!test/**'` — لیست client imports از barrel | لیست + اولویت subpath |

## 0.2 — Baseline تست (بدون full gate)

| ID | تسک | توضیح | پذیرش |
|----|-----|-------|-------|
| **0.2-T1** | Denali wizard unit suite | `denali-wizard-theme`, `denali-rules-parity`, `denali-transport-logic`, `denali-wizard-validation` | همه سبز؛ log در TEMP |
| **0.2-T2** | Operator create smoke | `tours-operator.spec` + bridge spec | 11/11+ |
| **0.2-T3** | Manual checklist Legacy rules | سناریوهای §۱۲ gaps: bus+allowPersonalCar→dong، hidden→ghost clear، overlay hidden | checklist امضا‌شده در TEMP |

## 0.3 — Research gate (اجباری قبل Phase 1)

| ID | تسک | توضیح |
|----|-----|-------|
| **0.3-T1** | مطالعه `WorkspacePlugin` contract | `workspace-plugin.contract.ts`, `workspace-wizard-surface.ts` — لیست hookهای موجود vs لازم |
| **0.3-T2** | مطالعه Legacy rule sources | `legacy/` (read-only): `evaluateFormFieldRule`, contextual rules, invariant — **فقط مرجع رفتار** |
| **0.3-T3** | DEC پیش‌نویس Phase 12 | `docs/phase-12/README.md` scaffold: plugin hooks API |

---

# Phase 1 — معماری Platform (decouple Denali از web core)

> **هدف:** `WorkspaceWizardHost` workspace-agnostic؛ Denali logic فقط از plugin + workspace UI bundle.
> **چرا اول:** بدون این، workspace دوم = copy-paste شاخه `if (denali)`.

## 1.1 — قرارداد SDK (workspace-sdk)

| ID | تسک | توضیح کامل | فایل‌ها | پذیرش |
|----|-----|------------|---------|-------|
| **1.1-T1** | `WizardDraftBinding<TForm>` | interface: `namespace`, `draftKey`, `prepareEnvelope`, `hydrateEnvelope`, `mergeRemote` | `workspace-sdk/src/wizard/wizard-draft-binding.ts` | type export + doc Markdoc |
| **1.1-T2** | `WizardRuleEvalContext` | generic bag: `workspaceFormProfile`, `themeCatalog`, … — plugin typed extension | `workspace-wizard-hooks.ts` | Denali extends via branded type |
| **1.1-T3** | `evaluateFieldRule(form, path, ctx)` hook | optional on plugin؛ host generic caller | `workspace-plugin.contract.ts` | default noop |
| **1.1-T4** | `resolveRuleDimensions(draft)` hook | جایگزین hardcode Denali در host | همان | Urban returns `{}` |
| **1.1-T5** | `WizardCompositeRegistry` | `rendererId → lazy import path` یا metadata-only در plugin | `workspace-wizard-surface.ts` | بدون React در SDK |
| **1.1-T6** | `WizardReviewSurface` hook | plugin returns `{ componentId }` یا render props contract | `workspace-wizard-surface.ts` | Denali: review step id |
| **1.1-T7** | `prepareSubmitPayload(draft, ctx)` hook | validate + sanitize + ACL projection | plugin contract | starter: raw draft |
| **1.1-T8** | `TourCloneHydrator` wiring generic | host calls `plugin.tourClone` — حذف hardcode resolver | `tour-clone-hydrator.contract.ts` | clone فقط وقتی plugin دارد |
| **1.1-T9** | Doc + guard | `docs/phase-12/subphases/12.0-wizard-plugin-hooks.md` | Husky guard-docs | merge blocked بدون doc |

## 1.2 — platform-core (حداقل لازم)

| ID | تسک | توضیح | پذیرش |
|----|-----|-------|-------|
| **1.2-T1** | `validateWizardDraft(plugin, draft, scope)` | orchestrator: matrix validate + invoke `plugin.validationHooks` | spec در platform-core |
| **1.2-T2** | Wire Urban hooks در engine | `checkCapacity` واقعاً صدا زده شود وقتی hook تعریف شده | urban spec سبز |
| **1.2-T3** | Document dual-engine model | matrix (platform) vs contextual (workspace) — explicit در doc | dev/onboarding واضح |

## 1.3 — Refactor apps/web host

| ID | تسک | توضیح کامل | فایل | پذیرش |
|----|-----|------------|------|-------|
| **1.3-T1** | حذف `denaliRuleEvalContext` prop از host | context از `plugin.buildRuleEvalContext(session, catalogs)` | `workspace-wizard-host.tsx` | no `Denali*` type in host props |
| **1.3-T2** | Generic `handleBeforeNext` | `plugin.validateStep?.(draft, stepId)` — نه فقط denali | host | starter/urban می‌توانند validate اضافه کنند |
| **1.3-T3** | Generic conditional visibility | `plugin.applyConditionalSteps?.(steps, draft, ctx)` | host | Denali impl moves to workspace package adapter |
| **1.3-T4** | Generic review step slot | host renders `WizardReviewSlot` — plugin registers | host + denali adapter | Denali review unchanged visually |
| **1.3-T5** | Generic completion header | optional `plugin.wizardSurfaces.completionHeader` | host | non-denali: hidden |
| **1.3-T6** | `wizard-field.tsx` composite loader | resolve renderer via plugin registry — نه `pluginId==='denali'` | `wizard-field.tsx` | depcruise: web ↛ denali barrel |
| **1.3-T7** | Label resolver hook | `plugin.resolveFieldLabel?.(path, locale)` | host | default: template labels |
| **1.3-T8** | `new-tour-wizard-client` generic draft | `useWorkspaceDraft(plugin.draftBinding)` | client | no `DENALI_*` constants in client |
| **1.3-T9** | Submit path symmetric | همه pluginها: `prepareSubmitPayload` before POST | `create-tour.server.ts` | starter gets validation |
| **1.3-T10** | Client-safe exports audit | تمام web imports → subpath (`/plugin`, `/draft`, `/acl`) | denali package.json exports | no `node:*` in client bundle |
| **1.3-T11** | Boundary test | depcruise rule: `apps/web/src/wizard/**` ↛ `@app-tour/workspace-denali` barrel | `.dependency-cruiser` | CI guard |

## 1.4 — Denali workspace package (انتقال logic)

| ID | تسک | توضیح | پذیرش |
|----|-----|-------|-------|
| **1.4-T1** | `denaliWizardPluginAdapter.ts` | implements new hooks؛ thin wrapper روی existing rules | `packages/workspaces/denali/src/wizard/` |
| **1.4-T2** | Move conditional logic | `applyDenaliConditionalFieldRules` از web → denali adapter | web فقط generic call |
| **1.4-T3** | Move validation adapter | `validateDenaliWizardDraftSync` export from denali؛ web import subpath | tests unchanged |
| **1.4-T4** | Composite metadata-only in package | React stays in web **موقت** — registry ids in denali | documented tech debt → Phase 5 |

## 1.5 — پذیرش Phase 1

- [ ] `workspace-wizard-host.tsx` بدون import از `@app-tour/workspace-denali` (root)
- [ ] `rg 'pluginId === \"denali\"' apps/web/src/wizard/workspace-wizard-host.tsx` → 0
- [ ] Urban validation hook invoked in platform test
- [ ] Doc phase-12.0 merged
- [ ] `pnpm run pre-commit:fast` سبز

---

# Phase 2 — تکمیل Parity Legacy (create + settings → wizard)

> **هدف:** هر رفتار Legacy که مشتری Denali انتظار دارد در **create wizard** و زنجیره settings برقرار شود.

## 2.1 — Settings catalog chain

| ID | تسک | Legacy مرجع | توضیح | پذیرش |
|----|-----|-------------|-------|-------|
| **2.1-T1** | `compatibleCategories` on equipment | Legacy equipment filter | فیلد API + Prisma + settings CRUD | wizard فقط gear سازگار با tour category |
| **2.1-T2** | `isActive` on equipment row | soft-delete | entity + filter inactive | stale selection hint |
| **2.1-T3** | `formProfile` on tour theme | theme filter | API type + seed | `resolveThemeCompatibleCategories` با API data |
| **2.1-T4** | Stale selection UX | hint + keep selection | gear/theme/destination composites | test snapshot |
| **2.1-T5** | Event tour empty destinations | Legacy list behavior | `resolveDestinationsForTourType('event')` → `[]` | spec |
| **2.1-T6** | Settings empty-state links | operator UX | وقتی catalog خالی → CTA به `/settings/...` | visual test id |
| **2.1-T7** | Smoke seed equipment/themes | dev parity | `seedOperatorSmokeCatalog` غنی‌تر | smoke بدون CRUD دستی |

## 2.2 — Leaders / roster parity

| ID | تسک | توضیح | پذیرش |
|----|-----|-------|-------|
| **2.2-T1** | API `tab=active` semantics | map `tab` → `status=active` در users list | integration spec |
| **2.2-T2** | Rewards `labels[]` در leader filter | member+label admin قابل انتخاب | parity spec با Legacy scenario |
| **2.2-T3** | حذف fallback «همه users» | `leaders.length===0` → empty state نه all items | UX test |
| **2.2-T4** | Badge labels در multiselect | نمایش rewards labels کنار نام | `data-testid` per badge |
| **2.2-T5** | Document DEC-P9-018 | owner-only API + wizard expectation | doc |

## 2.3 — Rule & sanitize hardening

| ID | تسک | Legacy | پذیرش |
|----|-----|--------|-------|
| **2.3-T1** | Submit sanitize UUIDs | strip invalid theme/destination/gear ids | `denali-catalog-sanitize` + API 400 |
| **2.3-T2** | Peak height prefill | destination.altitudeM → peakHeight | destination field spec |
| **2.3-T3** | `minRequiredPeaks` Select 0–4 | Legacy numeric enum UX | composite یا primitive |
| **2.3-T4** | Full `sanitizeDenaliWizardDraftSnapshot` port | Legacy normalize pre-submit | diff test با golden fixtures |
| **2.3-T5** | Cross-step validation holes | composite sub-paths in step filter | audit `filterValidationToStep` |
| **2.3-T6** | Capability rules regression suite | `canDefineCustomServices` + profiles | parameterized spec per profile |

## 2.4 — Flow orchestration (create)

| ID | تسک | Legacy | پذیرش |
|----|-----|--------|-------|
| **2.4-T1** | `beforeunload` dirty guard | tab close warning | e2e optional |
| **2.4-T2** | Leave route confirm | Next.js router guard modal | component + test |
| **2.4-T3** | Step index restore precision | برگشت از dashboard → same step | draft meta test |
| **2.4-T4** | Clear all / reset draft | Legacy factory reset | button + API DELETE draft |

## 2.5 — پذیرش Phase 2

- [ ] `TEMP/denali-legacy-parity-matrix.md` — create-flow rows همه ✅ یا documented defer
- [ ] `denali-rules-parity.spec.ts` expanded
- [ ] Manual Legacy checklist §۱۲ — 100% tick

---

# Phase 3 — Denali Product Completion

> **هدف:** feature parity محصول operator Denali beyond create.

## 3.1 — Edit wizard (R2)

| ID | تسک | توضیح | پذیرش |
|----|-----|-------|-------|
| **3.1-T1** | Route `(app)/tours/[id]/edit` → wizard host | reuse `WorkspaceWizardHost` با mode=edit | navigable |
| **3.1-T2** | Hydrate canonical → draft | `transformTourToDenaliWizardValues` | round-trip test |
| **3.1-T3** | PATCH semantics + OCC | rowVersion conflict banner | 409 UX |
| **3.1-T4** | Edit-specific rules | publish/active guards | DEC |
| **3.1-T5** | Doc `TOURS-EDIT-UX.md` update | R1→R2 closure | doc-gate |

## 3.2 — Presets

| ID | تسک | توضیح | پذیرش |
|----|-----|-------|-------|
| **3.2-T1** | `/tours/new?preset={id}` | load preset config → prefill draft | e2e |
| **3.2-T2** | Preset picker UI | entry from tours list / settings | optional |
| **3.2-T3** | Preset + template gate | published template required | INV-WIZ |

## 3.3 — Guide languages

| ID | تسک | پذیرش |
|----|-----|-------|
| **3.3-T1** | `localGuideLanguageId` یا multiselect از catalog | field in registry |
| **3.3-T2** | Rule: `requiresLocalGuide` → language required | validation spec |
| **3.3-T3** | Deprecate free-text-only `localGuideName` یا hybrid | DEC |

## 3.4 — Template builder UX

| ID | تسک | Legacy | پذیرش |
|----|-----|--------|-------|
| **3.4-T1** | Section-groups UI | Legacy builder sections | settings page |
| **3.4-T2** | `stepOverrides` per step | reorder/hide within step | persisted config |
| **3.4-T3** | Live preview | optional split pane | defer ok |
| **3.4-T4** | Template version migrate | draft compatibility | DEC-P12 |

## 3.5 — Publishing UX (client)

| ID | تسک | پذیرش |
|----|-----|-------|
| **3.5-T1** | `publishStatus` در review visible | palette + review step |
| **3.5-T2** | Readiness meter hooks | wire to server gate (Phase 4) |
| **3.5-T3** | Schedule publish UI shell | disabled until Phase 4 backend |

---

# Phase 4 — Enterprise Tier B

> **هدف:** governance، server-side publish authority، audit — نه فقط UI.

## 4.1 — Server publish gate

| ID | تسک | توضیح | پذیرش |
|----|-----|-------|-------|
| **4.1-T1** | `evaluateDenaliWizardSubmitGate` API-side | block active publish if invalid | 422 structured |
| **4.1-T2** | Readiness checklist endpoint | `% complete` + blocking issues | BFF route |
| **4.1-T3** | Idempotent create | `Idempotency-Key` header | duplicate safe |

## 4.2 — Audit & versioning

| ID | تسک | پذیرش |
|----|-----|-------|
| **4.2-T1** | Field-level audit trail | wizard changes in workspace_draft_events |
| **4.2-T2** | Canonical version history | tour revisions table + UI diff |
| **4.2-T3** | Rollback to published | DEC + API |

## 4.3 — Workflow (optional Tier B)

| ID | تسک | پذیرش |
|----|-----|-------|
| **4.3-T1** | Reviewer assignment | status `pending_review` |
| **4.3-T2** | Field comments | Velt-style defer |
| **4.3-T3** | `/tours/drafts` hub | list resume all drafts |

## 4.4 — Cross-device draft

| ID | تسک | پذیرش |
|----|-----|-------|
| **4.4-T1** | Draft key includes `userId` | `(tenant, workspace, user, namespace, key)` |
| **4.4-T2** | Migration existing drafts | script |

---

# Phase 5 — Workspace #2 Readiness (Urban pilot)

> **هدف:** ثابت کند abstraction کار می‌کند — **بدون** copy Denali.

| ID | تسک | توضیح | پذیرش |
|----|-----|-------|-------|
| **5.1-T1** | Urban `draftBinding` | namespace `urban.wizard` | save/resume |
| **5.1-T2** | Urban `validateStep` | capacity hook wired | step gate |
| **5.1-T3** | Urban wizard route smoke | `/tours/new` on urban host | 200 |
| **5.1-T4** | Document workspace onboarding | `docs/workspaces/adding-a-workspace.md` | checklist |

---

# Phase 6 — Polish & regression

| ID | تسک | پذیرش |
|----|-----|-------|
| **6.1-T1** | WZ-P2-06 Playwright visual baseline | Architect YES |
| **6.1-T2** | WZ-P2-07 framer-motion (optional) | perf budget |
| **6.1-T3** | Full operator E2E | smoke-denali-e2e-servers green |
| **6.1-T4** | Bundle size guard | client bundle ↛ minio/crypto |

---

## وابستگی به doc رسمی

| Phase | Doc pack هدف |
|-------|--------------|
| 1 | `docs/phase-12/subphases/12.0-wizard-plugin-hooks.md` |
| 2 | `docs/phase-12/subphases/12.1-legacy-parity-closure.md` |
| 3 | `docs/phase-12/subphases/12.2-denali-edit-preset-builder.md` |
| 4 | `docs/phase-12/subphases/12.3-enterprise-publish-audit.md` |

---

## Definition of Done — کل برنامه

1. **معماری:** web host بدون Denali branch؛ plugin hooks documented.
2. **Legacy create:** parity matrix 100% ✅ or explicit DEC defer.
3. **Denali product:** edit + preset + guide languages + builder sections.
4. **Enterprise:** server publish gate + audit minimum.
5. **Workspace #2:** Urban proves reuse.
6. **Tests:** fast-track green؛ E2E before PR closure.

---

## یادداشت اجرایی VPS (2026-06-11)

- Admin: `operator.localhost:3000/tours/new` — OTP dev `1234`
- API: `OPERATOR_SMOKE_E2E_SEED=1` + JWT keys لازم
- باگ bundle `node:crypto` — subpath imports (Phase 1.3-T10) **انجام partial**

---

*آخرین به‌روزرسانی: 2026-06-11 · نویسنده: Agent session · مرجع conversation: wip/phase9-continuation*

# Phase 9 — مسیر ادامه (Legacy ↔ Trunk · روش مدرن)

```yaml
roadmap_version: "2026-06-09-v1"
audience: solo-dev · architect · agent
method: READ legacy → READ docs/phase-9 → CHECK trunk → ACT modern delta → PROVE specs
companion_files:
  - TEMP/phase9-behavioral-closure-checklist.md
  - TEMP/phase9-doc-95plus-roadmap.md
  - TEMP/phase9-settings-registry-roadmap.md
  - docs/phase-9/AGENT-NAVIGATOR.md
  - docs/phase-9/audits/IMPLEMENTATION-TRUTH.md
  - docs/phase-9/appendices/LEGACY-ADMIN-REFERENCE.md
  - apps/api/docs/legacy-vs-denali-gap-analysis.md
legacy_root: legacy/
trunk_web: apps/web/app/(app)/
truth_snapshot: "2026-06-09 — PARTIAL_R1..R7 on trunk · 0/9 VERIFIED_BEHAVIORAL"
```

> **اصل کار:** Legacy **مرجع رفتار و parity** است، نه منبع import. Trunk **معماری جدید** دارد (Fastify modules · Prisma · workspace plugins · canonical SoT · BFF). در هر زیرفاز: چیزی از legacy **اضافه** می‌کنیم، چیزی را **عمداً حذف/تعویض** می‌کنیم، چیزی را **مدرن‌تر** نگه می‌داریم.

---

## نحوه استفاده

| ستون | معنی |
| ---- | ---- |
| **Legacy** | کجا در `legacy/` ببین — رفتار UI/API |
| **Docs (PEK)** | حقیقت اجرایی Phase 9 |
| **Trunk امروز** | وضعیت تقریبی repo |
| **از Legacy بردار** | چیزی که trunk هنوز ندارد یا ناقص است |
| **مدرن / بهتر در Trunk** | عمداً متفاوت یا بهتر — حفظ شود |
| **قدم بعدی** | کار مشخص + proof |

**Verify سریع memory:**

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
pnpm --filter @apps/api run test:file test/tours-operator.spec.ts test/finance-route-registrar.spec.ts
# bundle کامل: docs/dev/tiered-testing.md § Phase 9 targeted API specs
```

---

## 9.0 — Entry & parity contract

| | |
| --- | --- |
| **Legacy** | کل درخت `legacy/apps/web/app/(app)/` |
| **Docs** | `docs/phase-9/subphases/9.0-entry.md` · `OPERATOR-PRODUCT-SCOPE.md` · `ADMIN-ROUTE-MATRIX.md` |
| **Trunk** | VERIFIED_ENTRY |
| **از Legacy بردار** | inventory route برای `operator-route-parity-inventory.ts` |
| **مدرن / بهتر** | DEC-P9-008 · Urban/Marketing خارج از scope · `legacy/` frozen |
| **قدم بعدی** | `phase-8:gate` formal · entry yaml |

**Gap سراسری:** `apps/api/docs/legacy-vs-denali-gap-analysis.md`

---

## 9.1 — Identity & Session

| | |
| --- | --- |
| **Legacy** | `legacy/apps/web/app/auth/login/` · `legacy/apps/api/src/modules/auth/` · `modules/identity/` |
| **Docs** | `9.1-identity-session.md` · `IDENTITY-PORT-SCOPE.md` · `OPERATOR-LOGIN-FLOW.md` · `erip/9.1-cop-identity-port.md` |
| **Trunk** | PARTIAL_R1 — OTP + session memory سبز |
| **از Legacy بردار** | OTP rate limits · invite token (تا 9.4) · sessionVersion revoke on role change |
| **مدرن / بهتر** | JWT + sessionVersion (DEC-P9-012) · Fastify routes · Prisma · BFF cookie · بدون Nest tree |
| **قدم بعدی** | Migration `010_identity_production_delta.sql` · `phase-9-persistence.integration.spec.ts` |

**تله:** server-side session table SoT — در trunk ممنوع.

---

## 9.2 — Admin Shell

| | |
| --- | --- |
| **Legacy** | `legacy/apps/web/app/(app)/layout.tsx` · dashboard · nav · finance widget |
| **Docs** | `9.2-admin-shell.md` · `ADMIN-SHELL-UX.md` · `AGENT-STATE-MAP-9.2.md` · `erip/9.2-cop-admin-shell.md` |
| **Trunk** | PARTIAL_R2 — OperatorShell · `(app)/finance` landed |
| **از Legacy بردار** | mobile drawer فعال · dashboard widget grid · SMK-P9-01 landmarks |
| **مدرن / بهتر** | force-dynamic RSC · CASL nav · ui-primitives (DEC-P9-013) · lazy branding |
| **قدم بعدی** | CP-9.2-11 finance در shell · `admin-shell-access` + `dashboard-smoke` |

---

## 9.3 — Tours Operator

| | |
| --- | --- |
| **Legacy** | `legacy/apps/web/app/(app)/tours/` · workspace/waitlist/transport · register |
| **Docs** | `9.3-tours-operator.md` · `TOURS-LIST-UX.md` · `TOURS-EDIT-UX.md` · `TOURS-WORKSPACE-UX.md` · `TOURS-REGISTER-UX.md` · `tours-operator-api-dispatch-addendum.md` |
| **Trunk** | PARTIAL_R5 — pages landed · API 8/8 memory |
| **از Legacy بردار** | URL query model · card grid · workspace tabs با داده bookings · transport badges · clone tour (P2) |
| **مدرن / بهتر** | `view=operator` projection (DEC-P9-014) · wizard فقط `/tours/new` · Denali list projection plugin |
| **قدم بعدی** | CP-9.3-W05..W07 data tables · Denali POST body برای tenant 014 · `tours-list.spec.ts` web |

---

## 9.4 — Users & RBAC

| | |
| --- | --- |
| **Legacy** | `legacy/apps/web/app/(app)/users/` · five roles · CSV · rewards · ownership |
| **Docs** | `9.4-users-rbac.md` · `USERS-DIRECTORY-UX.md` · `users-api-dispatch-addendum.md` · DEC-P9-015 |
| **Trunk** | PARTIAL_R6 — API 29 tests · SMK-P9-03 |
| **از Legacy بردار** | pending tab polish · CSV UX · resend · segment labels (optional) |
| **مدرن / بهتر** | 3-tier RBAC · member locked panel · Urban admin 403 (RULE-P9-002) |
| **قدم بعدی** | Prisma identity · ownership transfer UI · `operator-ability.spec.ts` |

---

## 9.5 — Bookings Command Center

| | |
| --- | --- |
| **Legacy** | `legacy/apps/web/app/(app)/bookings/` · `bookings/new` · `leader/review` |
| **Docs** | `9.5-bookings-ops.md` · `BOOKINGS-OPS-UX.md` · `bookings-api-dispatch-addendum.md` · DEC-P9-011 |
| **Trunk** | PARTIAL_R6 — Command Center · SMK-P9-04/06/07 |
| **از Legacy بردار** | KPI strip · detail panel · tour board (R4) · SLA hints |
| **مدرن / بهتر** | approve + outbox TX (P9-F-006) · ops manifest · leader URL alias |
| **قدم بعدی** | Postgres approve proof · deep link bookings/[id] · waitlist promotion |

---

## 9.6 — Settings Registry

| | |
| --- | --- |
| **Legacy** | `legacy/apps/web/app/(app)/settings/**` · audit-trail |
| **Docs** | `9.6-settings-templates.md` · `SETTINGS-MODULE-REGISTRY.md` · `SETTINGS-PORT-SCOPE.md` · `TEMP/phase9-settings-registry-roadmap.md` |
| **Trunk** | PARTIAL_R7 — hub + modules · API 21 tests memory |
| **از Legacy بردار** | FK destinations · audit filters · tour-form-defaults parity |
| **مدرن / بهتر** | manifest dispatch · normalized Prisma tables (DEC-P9-010) · config version |
| **قدم بعدی** | Migration `007_operator_settings_delta.sql` · SMK-P9-05 persist |

---

## 9.7 — Finance Command Center

| | |
| --- | --- |
| **Legacy** | `legacy/apps/web/app/(app)/finance/` · reconciliation-triage · `modules/finance/` |
| **Docs** | `9.7-finance-denali.md` · `FINANCE-OPS-UX.md` §2.2 gap · `finance-api-dispatch-addendum.md` |
| **Trunk** | PARTIAL_R1 — API R1 · hub · SMK-P9-11/12 |
| **از Legacy بردار** | MinIO receipts · prepayment UI data · installments board · PSP gateways (بعداً) |
| **مدرن / بهتر** | denali-finance adapter · outbox ledger · minor units · FinanceOpsManifest · Urban 404 |
| **قدم بعدی** | R2 prepayments Postgres · R3 installments · **ممنوع:** claim 9.7 closed |

---

## 9.8 — Operator Admin DoD

| | |
| --- | --- |
| **Legacy** | کل `(app)/` acceptance baseline |
| **Docs** | `9.8-operator-dod-gate.md` · `SMOKE-SCENARIO-MAP.md` · `FORENSIC-RUBRIC-P9.md` |
| **Trunk** | SPEC_ONLY — smoke 12/12 local |
| **از Legacy بردار** | رفتار operator روزمره end-to-end |
| **مدرن / بهتر** | phase-9:gate · forensic ≥8 · platform-core zero diff · hooks re-enable |
| **قدم بعدی** | 9.1–9.7 VERIFIED_BEHAVIORAL · `phase-9.contract.spec.ts` · Architect YES gate |

---

## Cross-cutting

| موضوع | Legacy | Trunk | وضعیت |
| ----- | ------ | ----- | ----- |
| Persistence | TypeORM | Prisma 005/006/007/010 | apply pending |
| Finance | Nest monolith | denali-finance + outbox | R1 only |
| Tests | heavy default | test:file + http-test-client | pattern OK |

---

## الگوی PR

```text
READ legacy → READ docs/phase-9 → DIFF trunk → DOC-first (if core) → ACT → PROVE → SYNC TRUTH
```

---

## اولویت (یک شاخه)

```text
W  Wizard template builder (§ زیر) — W0 doc → W1 empty → W2 builder → W3 wire  [ACTIVE — قبل از gate]
A  Postgres migrations + persistence integration
B  9.2 shell + 9.3 workspace data
C  9.7 R4+ · 9.6 settings persist
D  9.8 contract + phase-9:gate  [DEFERRED — فقط با Architect YES]
```

---

## Legacy → Doc map

| Legacy | Doc |
| ------ | --- |
| `legacy/.../auth/` | OPERATOR-LOGIN-FLOW.md |
| `legacy/.../tours/` | TOURS-LIST-UX · TOURS-WORKSPACE-UX |
| `legacy/.../users/` | USERS-DIRECTORY-UX |
| `legacy/.../bookings/` | BOOKINGS-OPS-UX |
| `legacy/.../settings/` | SETTINGS-MODULE-REGISTRY |
| `legacy/.../finance/` | FINANCE-OPS-UX |
| `legacy/.../modules/identity/` | IDENTITY-PORT-SCOPE |
| `legacy/.../modules/finance/` | dispatch only — **do not port tree** |

---

*TEMP — در تعارض، PEK در `docs/phase-9/` برنده است.*

---

## Execution log

### 2026-06-09 — Session start (Week A baseline)

| Check | Command / evidence | Result |
| ----- | ------------------ | ------ |
| Memory API bundle (52 tests) | `pnpm --filter @apps/api run test:file` (9.1–9.6 subset + tours-operator) | **52/52 PASS** ~16s |
| Web 9.3 logic | `tours-workspace` + `tours-list` + `tours-operator` | **18/18 PASS** |
| Route contract | `phase-9.contract.spec.ts` | **4/4 PASS** |
| Postgres migrations | `pnpm --filter @apps/api run db:migrate:deploy` | **17 migrations applied** |
| Persistence integration | `STORAGE_DRIVER=prisma` + `phase-9-persistence.integration.spec.ts` | **5/5 PASS** |
| Finance R2 prepayments | `finance-prepayments.spec.ts` + Postgres | **4/4 PASS** |

**Next in queue (Week B → C):**

1. `finance-invoice.spec.ts` + installments R3 (Postgres)
2. Denali POST `/tours` body alignment for smoke tenant 014 (prod path)
3. 9.2 shell closure — mobile drawer + dashboard widgets (SMK-P9-01 hardening)
4. `pnpm --filter @apps/web run test:e2e:operator` full smoke re-verify
5. Update `IMPLEMENTATION-TRUTH.md` subphase statuses after each block green

**Env for Postgres local:**

```bash
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export STORAGE_DRIVER=prisma
```

### 2026-06-09 — Session 2 (Finance R3 API)

| Check | Result |
| ----- | ------ |
| `finance-schedules.spec.ts` (generate + list + sum + RBAC) | **4/4 PASS** Postgres |
| Doc | `docs/dev/tiered-testing.md` — Postgres finance bundle |

**Next:** operator smoke E2E · denali tenant 014 registry · dashboard live widgets

### 2026-06-09 — Session 3 (Dashboard 9.2 live widgets)

| Check | Result |
| ----- | ------ |
| Live widgets (Overview, Tours, Bookings, Registrations) | **Implemented** — fetch `/api/tours`, `/api/bookings/summary` |
| Finance widget | unchanged (denali admin/owner gate) |
| `dashboard-widgets-logic.spec.ts` | **5/5 PASS** |
| `dashboard-smoke.spec.ts` + `finance-dashboard-widget.spec.ts` | **8/8 PASS** |

**Files:** `apps/web/src/admin/dashboard/dashboard-*-widget*.tsx`, `dashboard-widgets-logic.ts`, `dashboard-page-client.tsx`

**Next:** operator smoke E2E · denali tenant 014 registry · Finance R4 (ledger CSV / receipts)

### 2026-06-09 — Session 4 (Operator smoke E2E 13/13)

| Check | Result |
| ----- | ------ |
| `pnpm --filter @apps/web run test:e2e:operator` | **13/13 PASS** (~3.3m) |
| Denali wizard + starter API bridge | `createTourAction` maps `title` → `basics.title` |
| Memory smoke workspace lock | `OPERATOR_SMOKE_E2E_SEED=1` + `STORAGE_DRIVER=memory` → API `starter` |
| Smoke server env | strip `DATABASE_URL*` · `P5_VALIDATION_WORKERS_ENABLED=false` |
| Wizard prefill (SMK-P9-05) | denali path `title` + test id on denali field |
| Doc | `docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md` |

**Next:** Finance R4 · IMPLEMENTATION-TRUTH VERIFIED_BEHAVIORAL · 9.8 gate (Architect YES)

### 2026-06-09 — Session 5 (Finance R4 ledger CSV)

| Check | Result |
| ----- | ------ |
| Ledger tab Export CSV | `finance-ledger-export-csv` · client download |
| `finance-reports-logic.spec.ts` WEB-9.7-R4-01..02 | **6/6 PASS** |
| Doc | `docs/phase-9/appendices/FINANCE-OPS-UX.md` §5.6 |

**Next:** reconciliation triage ledger-adjust (R4 stretch) · IMPLEMENTATION-TRUTH updates · 9.8 gate

### 2026-06-09 — Session 6 (Reconciliation R4 KPI + TRUTH sync)

| Check | Result |
| ----- | ------ |
| `ledger-journal-gap` finding in reconciliation triage | WEB-9.7-TRI-03 · fetch ledger-events |
| `IMPLEMENTATION-TRUTH.md` + `AGENT-CURRENT-PHASE.yaml` | smoke **13/13** · dashboard R3 · finance R4 partial |

**Next:** Wizard template builder (see § Wizard Template Builder below) — **not** 9.8 gate until Architect YES

---

## Wizard Template Builder — مسیر پیشنهادی (تحقیق + معماری)

```yaml
track_id: WIZARD-TEMPLATE-BUILDER
roadmap_version: "2026-06-09-v1"
priority: HIGH — جلوتر از 9.8 gate
status: RESEARCH_COMPLETE · IMPLEMENTATION_NOT_STARTED
doc_target: docs/phase-9/appendices/SETTINGS-MODULE-REGISTRY.md (v2 wizard_template payload)
plugin_surface: packages/workspace-sdk → همه workspace plugins
first_consumer: denali (فوری) · starter/urban (همان قرارداد)
```

> **خواسته محصول:** `/tours/new` **خالی** باشد تا ادمین در Settings قالب ویزارد را بسازد — نه فرم هاردکد Denali (~۶۰ فیلد). Gate فعلاً **عمداً** عقب می‌افتد.

### تحقیق اینترنت — الگوی استاندارد Enterprise

منابع: [Salesforce Dynamic Forms / Build Forms DG](https://architect.salesforce.com/docs/architect/decision-guides/guide/build-forms.html) · [Adobe XDM tenant vs global schema](https://experienceleague.adobe.com/en/docs/experience-platform/xdm/api/getting-started) · [Kopra multi-tenant custom fields](https://kopra.dev/blog/multi-tenant-custom-fields-architecture) · [Ranveer Kumar schema-driven UI](https://blog.ranveerkumar.com/articles/dynamic-scalable-ui-schema-driven-forms-configurable-screens-notification-systems) · [Formitiva schema/registry/renderer](https://github.com/Formitiva/formitiva-monorepo)

| الگوی صنعت | ایده | تطبیق با app-tour |
| ---------- | ---- | ----------------- |
| **سه‌لایه Schema → Registry → Renderer** | ساختار declarative جدا از کامپوننت UI و از validation سرور | ✅ داریم: `fieldRegistry` + `PlatformWizardEngine` + `WorkspaceWizardHost` |
| **Global catalog + Tenant overlay** (Salesforce FieldSet/CMDT، Adobe global vs tenant container) | توسعه‌دهنده فیلد تعریف می‌کند؛ ادمین tenant فقط **چیدمان/visibility/required** را تنظیم می‌کند | ✅ **بهترین fit** — Denali registry = catalog؛ `tenant_config.wizard_template` = overlay |
| **Additive delta نه schema آزاد** (Kopra / enterprise B2B) | tenant نمی‌تواند نوع فیلد یا invariant validation را دور بزند | ✅ canonical + `validateCanonical` ثابت می‌ماند |
| **Versioned immutable config** | `configVersion` + migrate-on-read + audit on PUT | ✅ DEC-P9-005 / settings-config.service |
| **Visibility = UX؛ Authorization = server** | hide در UI ≠ اجازه write | ✅ CASL + API validation |
| **Anti-pattern: JSON form builder خام** (Form.io-style arbitrary fields) | سریع ولی EAV/query/validation hell | ❌ عمداً **نمی‌رویم** — مغایر canonical SoT |

**جمع‌بندی تحقیق:** استاندارد enterprise برای SaaS B2B = **Metadata-driven overlay روی registry ثابت**، نه form builder که فیلد نوع جدید بسازد. همان چیزی که doc 9.6 با نام `wizard-template-builder` و legacy `DenaliTemplateOrchestrator` + `_templateOverlay` پیش‌بینی کرده.

### وضعیت trunk امروز (شکاف)

| لایه | واقعیت | مشکل |
| ---- | ------ | ---- |
| `/tours/new` | `WorkspaceWizardHost` → کل `fieldRegistry` plugin | همیشه ~۶۰ فیلد Denali |
| Settings `tour-wizard-template` | v1: `seedLabel` + `sections` (basics/itinerary) | sections **wire نشده**؛ فقط seed → prefill عنوان |
| Denali `inactiveFieldGroups` | `[]` | Urban ازش استفاده می‌کند — Denali نه |
| `resolveDenaliRuleSetFromTemplate` | stub — overlay deferred | `_templateOverlay` در fixture هست، runtime نیست |

### آیا در **همه workspace** لازم است؟ — **بله، به‌صورت plugin capability**

| Workspace | نیاز | توضیح |
| --------- | ---- | ----- |
| **denali** | **بله — اولویت ۱** | ~۶۰ فیلد · legacy orchestrator · محصول اصلی |
| **starter** | **بله — قرارداد یکسان** | ویزارد کوچک‌تر؛ همان Settings module + empty-until-published |
| **urban** | **بله — defaults متفاوت** | الان `inactiveFieldGroups` **هاردکد** در plugin — باید tenant-configurable شود |
| **workspaceهای آینده** | **بله — از scaffold** | `workspace:create` باید settings module + wizard catalog را بیاورد |

**نه** کد جدا per workspace در `apps/web`، بلکه:

```text
workspace-sdk (قرارداد)
  └── WorkspacePlugin + operatorSettings module wizard_template
        ├── catalog: fieldRegistry (ثابت در plugin)
        ├── workspaceDefaults: inactiveFieldGroups / default steps
        └── tenant overlay: GET/PUT settings/config/wizard_template

platform-core (resolver)
  └── resolveWizardRenderPlan(plugin, tenantTemplate, ruleContext)
        = registry ∩ tenant picks ∩ rule matrix

apps/web (generic)
  └── WorkspaceWizardHost + settings wizard-template-builder UI
        └── pluginId از session — بدون if (denali) در host
```

همان الگوی plugin فعلی (finance، settings، tourList) — wizard template هم **سطح plugin**.

### قرارداد پیشنهادی `wizard_template` v2 (draft — قبل از doc PR)

```typescript
type WizardTemplatePayloadV2 = {
  published: boolean;           // false → /tours/new empty state
  configVersion: 2;
  steps: Array<{
    stepId: string;               // denali: denali_basic | denali_program | …
    label: string;
    enabled: boolean;
    fields: Array<{
      canonicalPath: string;      // MUST exist in plugin.fieldRegistry
      required?: boolean;         // overlay — cannot weaken server invariants
      hidden?: boolean;
      defaultValue?: string;
    }>;
  }>;
  seedLabel?: string;             // v1 compat
};
```

**قوانین governance:** (1) فقط paths در registry (2) Layer C غیرقابل انتخاب (3) rule matrix بعد از template compose (4) بدون published → empty + CTA Settings (5) Urban defaults در plugin، override در tenant.

### فازبندی (بدون gate)

| فاز | محدوده | خروجی |
| --- | ------ | ----- |
| **W0 Doc-first** | `SETTINGS-MODULE-REGISTRY` v2 · subphase 9.6 | payload v2 · plugin capability spec |
| **W1 Empty wizard** | `apps/web` | unpublished → empty + link Settings |
| **W2 Builder UI** | settings tour-wizard-template | field picker per step · save v2 |
| **W3 Resolver wire** | host + platform-core helper | filter render plan |
| **W4 API validation** | settings PUT + POST tours | catalog cross-check |
| **W5 Multi-workspace** | starter + urban manifests | همان route · defaults per plugin |
| **W6 Smoke** | SMK-P9-05 | ابتدا publish template، بعد create |

**وابستگی:** W0 قبل از `workspace-sdk` / `platform-core` / `apps/api`.

### Anti-goals

- Form.io-style arbitrary fields
- ۶۰ فیلد hardcoded در apps/web
- `if (pluginId === 'denali')` پراکنده
- 9.8 gate قبل از W1+W2 (مگر Architect YES)

### 2026-06-09 — Session 7 (Wizard W0–W3 — empty until published)

| Check | Result |
| ----- | ------ |
| Doc §3.14 wizard template builder | `SETTINGS-MODULE-REGISTRY.md` |
| W1 empty `/tours/new` | `wizard-template-gate-logic.ts` · empty state + CTA Settings |
| W2 publish toggle | `wizard-template-client.tsx` · `operator-wizard-template-publish` |
| W3 render filter | `WorkspaceWizardHost` · `allowedCanonicalPaths` |
| API v1.1 passthrough | `published` + `steps` in settings-config normalize |
| Unit tests | `wizard-template-gate.spec.ts` **5/5** |

**Next:** W2 field picker UI · W4 PUT catalog validation · W6 smoke re-verify · SMOKE-SCENARIO-MAP update

### 2026-06-09 — Session 8 (W2 field picker + W4 API validation)

| Check | Result |
| ----- | ------ |
| Field picker UI | catalog from plugin registry · checkbox per `canonicalPath` |
| API W4 | `SETTINGS_WIZARD_UNKNOWN_FIELD` · denali `title` bridge on starter |
| Routes fix | `parseWizardTemplatePayload` preserves `published` + `steps` |
| Unit tests | web catalog+gate **9/9** · API config **7/7** |

**Next:** W5 multi-workspace manifests · W6 smoke re-verify · drag/order field picker (optional)


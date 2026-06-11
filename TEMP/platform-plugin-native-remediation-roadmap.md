# نقشه اصلاح پروژه — Platform Plugin-Native (فازبندی ریز + بازخوانی اجباری)

> **وضعیت:** TEMP — بازنویسی 2026-06-08 · **فاز ۰ انجام شد** 2026-06-08  
> **هدف:** ارتقا از Product-Aware Trunk به Plugin Host — **بدون** دست زدن به `platform-core`  
> **قانون طلایی:** قبل از هر فاز → بازخوانی کد → سپس حداقل diff — نه بازنویسی کل فایل  
> **RFC رسمی:** [`docs/phase-10/workspace-host-contract-v2.md`](../docs/phase-10/workspace-host-contract-v2.md)

---

## اصول اجرا (برای جلوگیری از کد کثیف)

| # | اصل | ممنوع | مجاز |
|---|-----|--------|------|
| A1 | **Read before write** | شروع کد بدون خواندن فایل‌های مرجع فاز | چک‌لیست بازخوانی زیر هر فاز |
| A2 | **حداقل diff** | refactor بزرگ «بهتر شدن» بدون تسک | یک تسک = یک رفتار / یک فایل هدف |
| A3 | **Shim قبل از حذف** | حذف ناگهانی `urban/` یا `denali-finance/` | re-export → migrate → حذف در PR بعد |
| A4 | **تست قبل از merge** | تغییر relay بدون `denali-finance-outbox.integration` | همان spec فاز قبل سبز |
| A5 | **Doc-first** | تغییر `workspace-sdk` / `apps/api` بدون `docs/` | RFC/DEC قبل از کد protected |
| A6 | **بدون abstraction زودهنگام** | `PluginRegistryFactoryManager` | یک فایل `workspace-event-dispatcher.ts` کافی تا فاز ۳ |
| A7 | **platform-core ممنوع** | هر import/workspace logic در core | فقط `apps/api` host + `workspace-sdk` contract |
| A8 | **یک PR per sub-phase** | فاز ۱+۲+۳ در یک PR | `P1-S1`، `P1-S2` جدا |

**تأیید پایان هر sub-phase (Agent / Developer):**

```text
[ ] فایل‌های بازخوانی فاز خوانده شد
[ ] diff فقط محدوده تسک است (نه reformat کل پوشه)
[ ] rg/import-boundary/depcruise مرتبط اجرا یا دستی trace شد
[ ] تست‌های لیست‌شده سبز
[ ] هیچ فایل بدون استفاده / helper تک‌خطی اضافه نشد
```

---

## وضعیت فعلی — سه نشتی (مرجع سریع)

| ID | نشتی | فایل کانونی |
|----|------|-------------|
| L1 | Eager plugin registry | `apps/api/src/workspace/workspace-plugins.ts` |
| L2 | Closed bindings | `packages/workspace-sdk/src/plugin/workspace-type-binding.ts` |
| L3 | Outbox → denali-finance | `apps/api/src/outbox/outbox-relay.ts` L359–368 |
| L4 | HTTP hardcoded urban | `apps/api/src/app.ts` L101–127 |
| L5 | Product folders در trunk | ~~`apps/api/src/urban/`~~ **حذف** · `denali-finance/` = host infra (service/outbox) فقط — HTTP shims حذف |
| L6 | Web if/else plugin | `apps/web/src/wizard/load-workspace-plugin.ts` |

**Foundation سالم (دست نزن):** `packages/platform-core/`

---

## نمره هدف

| مرحله | Overall | Drop-in |
|-------|---------|---------|
| الان | 7/10 | 3/10 |
| پس از فاز ۱–۳ | 8.5/10 | 7/10 |
| پس از فاز ۴–۷ | **9.5+/10** | **9.5+/10** |

---

# فاز ۰ — قرارداد (بدون کد runtime)

## ۰.۰ — بازخوانی اجباری (قبل از هر doc/type)

**بخوان (به ترتیب):**

1. `packages/workspace-sdk/src/plugin/workspace-plugin.contract.ts`
2. `packages/workspace-sdk/src/plugin/workspace-type-binding.ts`
3. `apps/api/src/workspace/resolve-workspace-plugin.ts`
4. `apps/api/src/workspace/workspace-plugins.ts`
5. `docs/phase-3/phase-3-deferred-capabilities.md` — GAP-3.3-04
6. `docs/research/phase-7-workspace-hardening-research.md` — §3.3
7. `dependency-cruiser.config.js` — rules `apps-api-allowed-packages`, `platform-core-no-workspaces`

**خروجی بازخوانی (یادداشت ۵ خطی):**

- آیا `WorkspacePlugin` کافی است یا فقط manifest جانبی لازم است؟
- codegen در build یا runtime scan؟ (پیشنهاد: **codegen**)
- کدام فایل‌ها **نباید** در فاز ۰ لمس شوند؟

## تسک‌های ریز

| ID | تسک | خروجی | Done |
|----|-----|--------|------|
| P0-T01 | پیش‌نویس schema `workspace.manifest.json` | [`WORKSPACE-MANIFEST.schema.json`](../docs/phase-10/appendices/WORKSPACE-MANIFEST.schema.json) + RFC §4 | [x] |
| P0-T02 | جدول migration: فایل قدیم → فایل جدید → shim؟ | [`MIGRATION-MAP-PLUGIN-HOST.md`](../docs/phase-10/appendices/MIGRATION-MAP-PLUGIN-HOST.md) | [x] |
| P0-T03 | DEC پیشنهادی: build-time codegen policy | [`DEC-P10-001`](../docs/phase-10/appendices/IMPLEMENTATION-DECISIONS.md) | [x] |
| P0-T04 | لیست specهایی که نباید بشکنند | [`SPEC-PRESERVATION-MATRIX.md`](../docs/phase-10/appendices/SPEC-PRESERVATION-MATRIX.md) | [x] |
| P0-T05 | تأیید Architect: **شروع فاز ۱** | RFC §10 — در انتظار sign-off | [ ] |

**تست فاز ۰:** فقط doc — بدون تغییر runtime.

**خروجی فاز ۰ (انجام‌شده):**

- [`docs/phase-10/README.md`](../docs/phase-10/README.md)
- [`docs/phase-10/workspace-host-contract-v2.md`](../docs/phase-10/workspace-host-contract-v2.md)
- پیوست‌ها: schema، DEC، migration map، spec matrix

**یادداشت بازخوانی ۰.۰ (خلاصه):** `WorkspacePlugin` کافی است؛ manifest جانبی؛ codegen نه runtime scan؛ `platform-core` ممنوع.

---

# فاز ۱ — Event Architecture (خارج کردن denali از outbox relay)

> **هدف L3:** relay = transport only  
> **نمره هدف:** Event 5 → 8

## ۱.۰ — بازخوانی اجباری (قبل از خط کد)

**بخوان و trace کن:**

| # | فایل | چه چیزی را یادداشت کن |
|---|------|------------------------|
| 1 | `apps/api/src/outbox/outbox-relay.ts` | کل `publishClaimedOutboxRow`؛ خط 359–368 |
| 2 | `apps/api/src/denali-finance/process-denali-finance-outbox.ts` | `processDenaliFinanceTourCreatedRow`؛ وابستگی به denali plugin |
| 3 | `packages/workspaces/denali/src/finance/handlers/tour-created-ledger.ts` (یا `handleTourCreatedLedgerEvent` export) | منطق واقعی ledger |
| 4 | `apps/api/src/events/idempotent-domain-event-subscriber.ts` | الگوی subscribe موجود |
| 5 | `packages/platform-events` — `publishDomainEvent` / `subscribeDomainEvent` | آیا handler می‌تواند **بعد از** publish باشد؟ |
| 6 | `apps/api/test/denali-finance-outbox.integration.spec.ts` | assertionهای رفتاری |
| 7 | `apps/api/src/denali-finance/prisma-denali-outbox-writer.ts` | adapter — **احتمالاً در API می‌ماند** |

**سوالات بازخوانی (باید جواب داده شود قبل از کد):**

1. آیا finance handler **باید** داخل همان tick relay بعد از `publishDomainEvent` باشد یا subscriber کافی است؟
2. `tryClaimDenaliFinanceProcessedEvent` کجا باید بماند؟ (احتمال: همان `denali-finance-processed-log.ts`)
3. آیا جابجایی به subscriber رفتار idempotency را عوض می‌کند؟

**ممنوع در فاز ۱:**

- ساخت manifest کامل (فاز ۲)
- تغییر `workspace-plugins.ts`
- حذف پوشه `denali-finance/`
- abstract layer بیش از یک dispatcher

## ۱.۱ — Sub-phase S1: قرارداد handler (SDK یا API host)

| ID | تسک | فایل | Done |
|----|-----|------|------|
| P1-T01 | تعریف type minimal `WorkspaceOutboxPublishedRow` | `apps/api/src/workspace/workspace-outbox-row-context.ts` | [x] |
| P1-T02 | تعریف dispatcher (بدون interface اضافی — YAGNI فاز ۱) | `workspace-tour-created-dispatcher.ts` | [x] |
| P1-T03 | doc: «handler در plugin؛ adapter Prisma در API» | `docs/phase-10/subphases/10.1-outbox-side-effects.md` | [x] |

## ۱.۲ — Sub-phase S2: dispatcher در API (بدون حذف هنوز)

| ID | تسک | فایل | Done |
|----|-----|------|------|
| P1-T04 | ایجاد `workspace-tour-created-dispatcher.ts` — فراخوانی **همان** `processDenaliFinanceTourCreatedRow` | `apps/api/src/workspace/` | [x] |
| P1-T05 | در `outbox-relay.ts`: جایگزینی inline call با `dispatchTourCreatedOutboxSideEffects(row)` | `outbox-relay.ts` | [x] |
| P1-T06 | `rg processDenaliFinance outbox-relay` → صفر | — | [x] |
| P1-T07 | اجرای `denali-finance-outbox.integration.spec.ts` | — | [x] |

## ۱.۳ — Sub-phase S3: delegate به plugin (حذف import denali از dispatcher path)

| ID | تسک | فایل | Done |
|----|-----|------|------|
| P1-T08 | export ثابت handler از denali: `onTourCreatedFinance` wrapping `handleTourCreatedLedgerEvent` | `packages/workspaces/denali/src/finance/` | [x] (via `tour-created-finance-side-effect.ts` → `handleTourCreatedLedgerEvent`) |
| P1-T09 | dispatcher: resolve plugin by tenant `workspace_type` → invoke handler + inject `OutboxWriter` port | `workspace-tour-created-dispatcher.ts` | [x] |
| P1-T10 | `process-denali-finance-outbox.ts` نازک‌تر: فقط map row → call handler (یا deprecate تدریجی) | `denali-finance/` | [x] |
| P1-T11 | `rg "@app-tour/workspace-denali" apps/api/src/outbox` → **صفر** | — | [x] |
| P1-T12 | integration spec + `pre-commit:fast` | — | [x] |

**معیار پذیرش فاز ۱:**

```bash
rg "processDenaliFinance" apps/api/src/outbox/outbox-relay.ts   # → 0
rg "workspace-denali" apps/api/src/outbox/                       # → 0
# تست:
pnpm --filter @apps/api exec node --import tsx --test test/denali-finance-outbox.integration.spec.ts
```

---

# فاز ۲ — Manifest Discovery (جایگزین closed registry)

> **هدف L1 + L2**  
> **نمره هدف:** Runtime 6 → 8.5، Drop-in 3 → 7

## ۲.۰ — بازخوانی اجباری

| # | فایل | یادداشت |
|---|------|---------|
| 1 | `packages/workspace-sdk/src/plugin/workspace-type-binding.ts` | مصرف‌کنندگان bindings |
| 2 | `apps/api/src/workspace/workspace-plugins.ts` | eager imports |
| 3 | `apps/web/src/wizard/load-workspace-plugin.ts` | if branches |
| 4 | `apps/web/src/bootstrap/workspace-plugins.ts` | starter only |
| 5 | `apps/web/test/workspace-boundary.spec.ts` | allowlist lazy loaders |
| 6 | `dependency-cruiser.config.js` L192–199 | `apps-api-allowed-packages` |
| 7 | `packages/workspace-sdk/test/*binding*.spec.ts` | چه assert می‌شود |
| 8 | `pnpm-workspace.yaml` | glob workspaces |

**سوالات بازخوانی:**

1. آیا `DEFAULT_WORKSPACE_TYPE_BINDINGS` را **deprecate** می‌کنیم یا generated re-export؟ (پیشنهاد: generated + re-export برای سازگاری spec)
2. آیا web و api از **یک** generated file استفاده کنند؟
3. آیا `package.json` API هنوز به هر workspace dep نیاز دارد؟ (بله در monorepo تا dynamic external package)

**ممنوع:**

- runtime `fs.readdir` در prod بدون DEC
- حذف یک‌باره `workspace-plugins.ts` بدون shim re-export
- ویرایش `platform-core`

## ۲.۱ — Sub-phase S1: manifest per workspace

| ID | تسک | Done |
|----|-----|------|
| P2-T01 | `packages/workspaces/starter/workspace.manifest.json` | [x] |
| P2-T02 | `packages/workspaces/denali/workspace.manifest.json` | [x] |
| P2-T03 | `packages/workspaces/urban/workspace.manifest.json` | [x] |
| P2-T04 | JSON schema validation در script (ajv یا manual) | [x] (required-field check) |

## ۲.۲ — Sub-phase S2: codegen script

| ID | تسک | Done |
|----|-----|------|
| P2-T05 | `scripts/generate-workspace-registry.mjs` — scan `packages/workspaces/*/workspace.manifest.json` | [x] |
| P2-T06 | خروجی: `apps/api/src/workspace/workspace-plugin-registry.generated.ts` | [x] |
| P2-T07 | خروجی: `apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts` | [x] |
| P2-T08 | `package.json` root: `"generate:workspace-registry"` | [x] |
| P2-T09 | prebuild API: run codegen (یا دستی در CI — تصمیم P0) | [x] (`apps/api` prebuild) |

## ۲.۳ — Sub-phase S3: wiring بدون شکستن specs

| ID | تسک | Done |
|----|-----|------|
| P2-T10 | `workspace-plugins.ts` → delegate به generated (حذف import مستقیم سه plugin) | [x] |
| P2-T11 | `workspace-type-binding.ts` → `DEFAULT_*` از generated import یا merge | [x] |
| P2-T12 | `load-workspace-plugin.ts` → lookup از generated به‌جای if denali/urban | [x] |
| P2-T13 | همه `*binding*.spec.ts` + `resolve-workspace-plugin.spec.ts` سبز | [x] |
| P2-T14 | `pnpm run guard:import-boundary` | [x] |

## ۲.۴ — Sub-phase S4: depcruise سخت‌تر

| ID | تسک | Done |
|----|-----|------|
| P2-T15 | rule جدید: `apps-api-workspace-imports-only-via-registry` | [x] (depcruise + `guard-workspace-registry-imports`) |
| P2-T16 | به‌روز allowlist: حذف نیاز به اضافه کردن دستی هر workspace به ۳ rule | [x] (web generated loader; depcruise comment) |
| P2-T17 | تست مصنوعی: workspace جدید فقط manifest + package — codegen — بدون edit binding دستی | [x] (`workspace-manifest-codegen.contract.spec.ts`) |

**معیار پذیرش فاز ۲:**

```bash
rg "getDenaliWorkspacePlugin|getUrbanWorkspacePlugin" apps/api/src/workspace/workspace-plugins.ts  # → 0 (یا فقط generated)
pnpm run generate:workspace-registry
pnpm run guard:architecture
pnpm run test:changed
```

---

# فاز ۳ — HTTP Route Registrar (urban pilot)

> **هدف L4 + L5 (تأریخاً urban)**  
> **نمره هدف:** HTTP 4 → 7.5

## ۳.۰ — بازخوانی اجباری

| # | فایل |
|---|------|
| 1 | `apps/api/src/app.ts` — dispatch کامل |
| 2 | `apps/api/src/boot/lazy-route-handlers.ts` |
| 3 | `apps/api/src/urban/urban.routes.ts` |
| 4 | `apps/api/src/urban/urban-settings.routes.ts` |
| 5 | `apps/api/src/openapi/dispatch-routes.ts` |
| 6 | `apps/api/scripts/guard-openapi-dispatch-parity.mjs` |
| 7 | `apps/api/test/urban-catalog-registration.spec.ts` (نمونه behavioral) |
| 8 | `apps/api/src/tours/tours.routes.ts` — import از `urban/` (L6 مرتبط) |

**یادداشت وابستگی urban routes:**

- `resolveTenantContextFromRequest` / `tenant-kernel`
- `require-workspace-owner.ts` → `workspace-sdk` auth
- `tourStore` deps در catalog

**ممنوع:**

- انتقال یک‌جای ۱۷ فایل urban بدون re-export shim
- تغییر قرارداد HTTP urban (path/method/status) — فقط محل handler
- router framework جدید (Express/Fastify) — همان `createRequestListener`

## ۳.۱ — Sub-phase S1: contract HTTP

| ID | تسک | Done |
|----|-----|------|
| P3-T01 | type `WorkspaceHttpRoute` { method, path, handlerRef } در sdk یا api host | [x] (`workspace-http-types.ts`) |
| P3-T02 | type `WorkspaceHttpModule` — export list handlers | [x] (`urban-workspace-routes.ts`) |
| P3-T03 | doc mapping urban routes فعلی → manifest entries | [x] (`10.3-http-route-registrar.md`) |

## ۳.۲ — Sub-phase S2: registrar

| ID | تسک | Done |
|----|-----|------|
| P3-T04 | `apps/api/src/http/workspace-route-registrar.ts` — match pathname+method | [x] |
| P3-T05 | ثبت routes urban از manifest (اول hardcode list در registrar — سپس manifest) | [x] (`urban-workspace-routes.ts`; manifest `http` added) |
| P3-T06 | `app.ts`: block urban ifها → `registrar.tryDispatch()` | [x] |
| P3-T07 | lazy-route-handlers: urban handlers از همان module فعلی (هنوز در api) | [x] (unchanged) |
| P3-T08 | `urban-*` specs سبز | [x] (catalog + settings sampled) |

## ۳.۳ — Sub-phase S3: انتقال به workspace package

| ID | تسک | Done |
|----|-----|------|
| P3-T09 | `packages/workspaces/urban/src/http/routes.ts` — export handlers | [x] |
| P3-T10 | `apps/api/src/urban/*.ts` → re-export shim (یک PR) | [x] |
| P3-T11 | حذف تدریجی shim وقتی importها به workspace اشاره کنند | [x] |
| P3-T12 | `guard-openapi-dispatch-parity` → خواندن از manifest | [x] (`routes-manifest.ts` parity check) |
| P3-T13 | route جدید آزمایشی فقط در `workspaces/urban/src/http/` — بدون `app.ts` | [x] (`URBAN_HTTP_ROUTE_MANIFEST`) |

**معیار پذیرش فاز ۳:**

```bash
rg '"/urban/' apps/api/src/app.ts   # → 0 (فقط registrar)
pnpm --filter @apps/api exec node --import tsx --test test/urban-catalog-registration.spec.ts
```

---

# فاز ۴ — Product surface (finance + web loader)

> **نمره هدف:** HTTP 7.5 → 8.5، Drop-in 7 → 8

## ۴.۰ — بازخوانی اجباری

| # | فایل |
|---|------|
| 1 | `apps/api/src/denali-finance/finance.routes.ts` — آیا در `app.ts` wired است؟ |
| 2 | `apps/api/src/boot/lazy-finance-service.ts` |
| 3 | `apps/web/src/wizard/load-workspace-plugin.ts` |
| 4 | `apps/web/src/bootstrap/lazy-denali-plugin.ts` / `lazy-urban-plugin.ts` |
| 5 | `apps/web/test/workspace-boundary.spec.ts` |
| 6 | `apps/web/app/finance/` |
| 7 | `apps/api/src/tours/tours.routes.ts` — urban gate |
| 8 | `apps/api/src/canonical/canonical-tour.service.ts` — urban merge |

## تسک‌های ریز

| ID | تسک | Done |
|----|-----|------|
| P4-T01 | finance routes: registrar mount از denali manifest (حتی اگر handler هنوز api باشد) | [x] |
| P4-T02 | انتقال `finance.routes.ts` handlers به `packages/workspaces/denali/src/http/finance/` | [x] |
| P4-T03 | web: حذف `lazy-denali-plugin` جدا — generated `webEntry` از manifest | [x] |
| P4-T04 | `workspace-boundary.spec` → allowlist فقط `workspace-registry.generated` | [x] |
| P4-T05 | استخراج `urbanTourPatchTouchesPublishFields` به urban plugin hook (اختیاری — کاهش L6) | [x] |
| P4-T06 | `canonical-tour.service` urban merge → plugin `mergePatchData` hook | [x] |
| P4-T07 | تست finance + urban + denali smoke | [x] (finance-route-registrar · urban-tours-bypass-gate · workspace-tour-write-dispatch · workspace-boundary) |

---

# فاز ۵ — SDK product-neutral (مسیر ۹.۵+)

## ۵.۰ — بازخوانی اجباری

| # | فایل |
|---|------|
| 1 | `packages/workspace-sdk/src/auth/tenant-authz.ts` — `UrbanOwnerSurface` |
| 2 | `packages/workspace-sdk/src/plugin/workspace-type-id.ts` |
| 3 | `packages/workspace-sdk/src/public-api.ts` — re-exports |
| 4 | همه `rg "DENALI_|URBAN_" packages/workspace-sdk/src` |

## تسک‌های ریز

| ID | تسک | Done |
|----|-----|------|
| P5-T01 | انتقال `UrbanOwnerSurface` به `packages/workspaces/urban` | [x] |
| P5-T02 | SDK: generic `WorkspaceAuthSurface` string + helper | [x] |
| P5-T03 | حذف export ثابت‌های محصول از `public-api` (یا deprecated alias یک release) | [x] |
| P5-T04 | contract spec: `rg -i denali|urban packages/workspace-sdk/src` فقط در tests/docs | [x] |
| P5-T05 | `guard:architecture` + workspace-sdk tests | [x] |

---

# فاز ۶ — Data layer policy (مسیر ۹.۵+)

## ۶.۰ — بازخوانی اجباری

| # | فایل |
|---|------|
| 1 | `apps/api/prisma/schema.prisma` — `UrbanRegistration`, `Payment*` |
| 2 | `infra/sql/009_urban_product_delta.sql` |
| 3 | `infra/sql/008_finance_payments_delta.sql` |
| 4 | `apps/api/prisma/migrations/` — آخرین migration |
| 5 | `docs/phase-5/appendices/migrate-deploy-only.md` |

**تصمیم قبل از کد (DEC):**

- generic `registrations` table vs namespaced `urban_registrations` نگه‌داری
- finance tables: denali-only یا shared payments

## تسک‌های ریز

| ID | تسک | Done |
|----|-----|------|
| P6-T01 | DEC schema ownership per workspace | [x] (DEC-P10-006 doc only) |
| P6-T02 | adapter layer در API — repository interfaces generic | [ ] (deferred per DEC-P10-006) |
| P6-T03 | migration جدید (اگر لازم) — **بدون** breaking urban e2e | [ ] (deferred) |
| P6-T04 | `db:migrate:deploy` در dev | [ ] (deferred) |
| P6-T05 | RLS policies برای جدول جدید/تغییر یافته | [ ] (deferred) |

---

# فاز ۷ — Enforcement + DX (۹.۵+ نهایی)

## ۷.۰ — بازخوانی اجباری

| # | فایل |
|---|------|
| 1 | `dependency-cruiser.config.js` — کل forbidden |
| 2 | `scripts/guards/import-boundary-ast.mjs` |
| 3 | `scripts/guards/phase-9-guard.mjs` (اگر مرتبط) |
| 4 | `AGENTS.md` — دستورات verify |

## تسک‌های ریز

| ID | تسک | Done |
|----|-----|------|
| P7-T01 | `pnpm run workspace:create` scaffold (package + manifest + test stub) | [x] |
| P7-T02 | CI job: `generate:workspace-registry` + diff check (generated committed) | [x] |
| P7-T03 | guard: `rg "getDenali|getUrban" apps/api/src` → فقط generated | [x] |
| P7-T04 | guard: `rg "workspace-denali" apps/api/src/outbox` → 0 | [x] |
| P7-T05 | guard: `rg '"/urban/' apps/api/src/app.ts` → 0 | [x] |
| P7-T06 | drop-in smoke: workspace stub `climbing-club` در test/fixture بدون trunk edit | [x] |
| P7-T07 | per-tenant `enabledPlugins` در theme (اختیاری advanced) | [ ] |
| P7-T08 | promote TEMP → `docs/phase-10/` رسمی | [x] |

**معیار ۹.۵+ نهایی:**

| معیار | دستور / وضعیت |
|--------|----------------|
| trunk بدون import مستقیم workspace | depcruise + rg |
| outbox بدون محصول | rg outbox |
| app.ts بدون path محصول | rg app.ts |
| workspace جدید | package + manifest + codegen + tenant |
| SDK بدون constant محصول جدید | rg workspace-sdk/src |

---

## ترتیب اجرا + وابستگی

```text
P0 (doc)
 └─► P1-S1 → P1-S2 → P1-S3
      └─► P2-S1 → P2-S2 → P2-S3 → P2-S4
           └─► P3-S1 → P3-S2 → P3-S3
                └─► P4
                     └─► P5 → P6 → P7
```

**هر فلش = PR جدا ترجیحاً.**

---

## چک‌لیست لمس trunk — قبل / بعد کل برنامه

| workspace جدید (wizard-only) | الان | پس از P2 | پس از P7 |
|------------------------------|------|----------|----------|
| touch points | ~۱۵ | ~۴ | **~۲** |

---

## فایل‌های مرجع (branch فعلی)

| نقش | مسیر |
|-----|------|
| L1 | `apps/api/src/workspace/workspace-plugins.ts` |
| L2 | `packages/workspace-sdk/src/plugin/workspace-type-binding.ts` |
| L3 | `apps/api/src/outbox/outbox-relay.ts` |
| L4 | `apps/api/src/app.ts` |
| L5a | `apps/api/src/urban/` (۱۷ فایل) |
| L5b | `apps/api/src/denali-finance/` |
| Web | `apps/web/src/wizard/load-workspace-plugin.ts` |
| Events bus | `packages/platform-events` + `idempotent-domain-event-subscriber.ts` |
| Guards | `dependency-cruiser.config.js` |

---

## جمع‌بندی

- **قبل از هر فاز:** بخش «بازخوانی اجباری» + پاسخ سوالات — الزامی است.
- **هر تسک:** کوچک، قابل تست، بدون refactor اضافی.
- **۹.۵+** فقط با P5–P7 کامل + guards CI — نه با P1–۳ alone.

*TEMP — پس از تأیید Architect، محتوا به `docs/phase-10/` منتقل شود.*

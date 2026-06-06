# Phase 6 — Denali Workspace Port (Research)

```yaml
agent_load_tier: T3_human
non_authoritative_for_execution: true
sole_execution_entry: docs/phase-6/phase-6-agent-router.md
decisions_authoritative: docs/phase-6/appendices/IMPLEMENTATION-DECISIONS.md
legacy_port_source: legacy/packages/denali-domain/
reference_workspace: packages/workspaces/starter/
fail_if: "Agent implements Phase 6 from this research body instead of phase-6-agent-router.md + subphases/"
```

**نقش:** تحقیق معماری (بدون پیاده‌سازی) — ورودی برای عمق‌دهی subphaseها و تقویت `IMPLEMENTATION-DECISIONS`  
**تاریخ:** 2026-06-04  
**دامنه:** فازهای ۰–۵ (وضعیت trunk) + legacy Denali + الگوهای صنعت ۲۰۲۵–۲۰۲۶

> **عامل (T0):** فقط [`phase-6-agent-router.md`](../phase-6/phase-6-agent-router.md). این سند **غیراجرایی** است.  
> **خلاصه اجرایی (T0):** [`phase-6-denali-workspace-research.ai-exec.md`](phase-6-denali-workspace-research.ai-exec.md)

---

## خلاصه اجرایی

فاز ۶ اولین **workspace محصول** است: انتقال Denali از `legacy/packages/denali-domain/` (و UI مرتبط) به `packages/workspaces/denali` به‌عنوان `WorkspacePlugin` کامل، **بدون** PR ویژه Denali در `platform-core` یا لایه generic `apps/api`.

تحقیق صنعت و بازبینی legacy هر دو به یک نتیجه می‌رسند:

1. **Strangler Fig تدریجی** — نه big-bang؛ facade مسیریابی (`resolveWorkspacePluginForType`) + پرچم/tenant cutover + حذف مسیر legacy فقط پس از parity اثبات‌شده.
2. **مرز plugin سخت** — registry، rules، composites، finance hooks، و theme داخل `@app-tour/workspace-denali`؛ host فقط SDK قرارداد (`WorkspacePlugin`, canonical pipeline Phase 5).
3. **یک منبع حقیقت برای wizard** — canonical document (فاز ۰/۴/۵)؛ **تکرار نکنید** الگوی `DenaliWizardSyncContext` (RHF + canonical دوگانه).
4. **Finance از outbox مصرف شود** — الگوی `emit-finance-ledger-journal-outbox` در legacy؛ **نه** کپی کل `legacy/apps/api/src/modules/finance/**`.
5. **build-green ≠ بستن فاز** — MAP §12: contract spec + HTTP/e2e + forensic ≥ 8.

فاز ۵ هنوز بخشی SPEC_ONLY (5.3–5.5) است؛ فاز ۶ **می‌تواند** shell/registry/bootstrap را جلو ببرد، اما 6.4 و persistence/event parity به **outbox relay واقعی** وابسته‌اند — در نقشه ریسک ثبت شده است.

---

## بخش ۱ — فاز ۶ در بستر فازهای ۰–۵

### 1.1 آنچه trunk امروز تضمین می‌کند

| فاز   | آنچه برای Denali لازم است                                             | وضعیت trunk (2026-06-04)            |
| ----- | --------------------------------------------------------------------- | ----------------------------------- |
| **0** | canonical-only covenant؛ بدون import از `legacy/` در product          | فعال در AGENTS + guards             |
| **1** | `PlatformWizardEngine`, `WorkspacePlugin`, rule engine                | starter plugin از SDK               |
| **2** | `theme/tokens.css` ingress؛ renderer از platform-core                 | starter theme                       |
| **3** | `CanonicalTourService`، مسیر write واحد                               | starter hard-coded در validation    |
| **4** | RLS، tenant context، `TourCreated` in-process                         | Postgres اختیاری با `DATABASE_URL`  |
| **5** | JSONB canonical، plugin validation، outbox/projection/audit **طراحی** | 5.2 behavioral؛ 5.3–5.5 عمدتاً SPEC |

### 1.2 هدف فاز ۶ (از MAP §11)

```text
legacy/packages/denali-domain/  ──port──►  packages/workspaces/denali/
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
              field-registry            composites              finance hooks
              rules/generated           theme/tokens.css        (event consumers)
                    │                         │
                    └─────────────┬───────────┘
                                  ▼
              apps/api + apps/web: resolveWorkspacePluginForType("denali")
```

**خارج از scope فاز ۶:** urban workspace، silo routing (فاز ۷)، CDC/warehouse، OTel split کامل.

### 1.3 وابستگی به فاز ۵ (صریح)

| قابلیت Phase 5                        | مصرف Denali در Phase 6          | اگر 5.x ناقص باشد               |
| ------------------------------------- | ------------------------------- | ------------------------------- |
| `validateCanonical` + plugin registry | rules در plugin، engine در core | 6.2 بدون 5.2 پایدار = drift     |
| `projection_derivation_map` addendum  | لیست/فیلتر Denali-specific      | 6.2/6.6 parity ضعیف             |
| transactional `outbox_events` + relay | 6.4 finance handlers            | 6.4 = SPEC یا mock تا relay سبز |
| audit events                          | compliance hooks در plugin      | 6.5+ observability ناقص         |

**توصیه تحقیقاتی:** DAG رسمی `6.0 → 6.1 → 6.2 → {6.3 ∥ 6.4} → 6.5 → …` حفظ شود؛ برای 6.4 یک **adapter contract test** علیه outbox stub تا Phase 5.4 merge نشده block نشود (همانند DEC-P6-010).

---

## بخش ۲ — بازبینی forensic legacy

### 2.1 دارایی‌های قابل حمل (حفظ کنید)

| دارایی                        | مسیر legacy                                        | چرا ارزش دارد                                        |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| **Registry SoT + codegen**    | `denaliFieldRegistryData.ts`, `rules/generated/`   | یک منبع برای rules/schemas؛ جلوگیری از drift web/API |
| **Headless domain**           | `@repo/denali-domain` بدون React                   | همان الگوی `WorkspacePlugin` trunk                   |
| **Canonical ↔ form adapters** | `adapters/`, `projection/`                         | با `CanonicalDocument` trunk هم‌راستا                |
| **Template orchestration**    | `DenaliTemplateOrchestratorFactory`, overlay rules | محصولی؛ نه core                                      |
| **Finance outbox discipline** | `emit-finance-ledger-journal-outbox.ts`            | tenant mismatch tests؛ idempotent `domainEventId`    |
| **Structural guards**         | `denaliLegacySchemaGuard`, prune/strip             | جلوگیری از ghost keys در migration                   |

### 2.2 شکست‌هایی که **نباید** تکرار شوند

| #   | شکست legacy                           | شواهد                                              | قانون فاز ۶                   |
| --- | ------------------------------------- | -------------------------------------------------- | ----------------------------- |
| F1  | Denali در platform-core / API generic | `WorkspaceStrategyRegistry`, `denali_pilot` strips | DEC-P6-001                    |
| F2  | `import` runtime از `legacy/`         | coupling tests                                     | DEC-P6-008                    |
| F3  | دو SoT: RHF mirror + canonical        | `DenaliWizardSyncContext`                          | فاز ۰ covenant                |
| F4  | duplicate domain (web ∥ package)      | `legacy/apps/web/.../wizard/denali/`               | یک بار port به plugin         |
| F5  | generated artifact drift              | audit template/zod drift                           | 6.6 parity + CI codegen diff  |
| F6  | finance به‌عنوان monolith Nest در API | `modules/finance/**`                               | فقط hooks در plugin           |
| F7  | dual-write `trip_details` + canonical | map.md hotspots                                    | فقط `migrateCanonical` در 6.8 |
| F8  | probe به‌جای محصول                    | `DENALI_BREACH_PROBE`                              | جایگزین در 6.1                |

### 2.3 اولویت port (ترتیب پیشنهادی)

1. **6.1** — shell plugin (آینه `packages/workspaces/starter`)
2. **6.2** — domain: registry, rules, schemas, normalize, validation
3. **6.3** — composites + theme (بعد از 6.2 تا duplicate نشود)
4. **6.4** — finance event handlers (الگو، نه کل ماژول)
5. **6.5** — bootstrap api/web
6. **6.6** — smoke parity (`provision:denali`, `/tours/new` legacy reference)
7. **6.7** — MinIO photos (tenant-prefixed keys)
8. **6.8** — `migrateCanonical` برای `trip_details`

**منبع narrative:** [`legacy/map.md`](../../legacy/map.md) · [`docs/phase-1/appendices/denali-phase-6.md`](../phase-1/appendices/denali-phase-6.md)

---

## بخش ۳ — الگوهای صنعت ۲۰۲۵–۲۰۲۶

### 3.1 Plugin-first / multi-tenant workspace

| الگو                           | منبع                                                                                                        | کاربرد برای app-tour                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Microkernel + manifest**     | [Widget framework (Sujeet Jaiswal)](https://sujeet.pro/articles/widget-framework)                           | host = api/web + platform-core؛ plugin = denali manifest + capability list                                |
| **Tenant config → widget set** | همان                                                                                                        | `Tenant.workspaceType` → plugin id؛ feature flag per tenant                                               |
| **Isolation ladder**           | iframe / Shadow DOM / WASM                                                                                  | Denali = **first-party** → همان-origin ES module (مثل Paperclip v1)؛ WASM برای third-party بعداً (فاز ۷+) |
| **Capability tokens**          | [Safe plugin patterns](https://devtools.cloud/extending-claude-cowork-sdk-patterns-and-safe-plugin-extensi) | finance/network فقط از host API با audit log                                                              |
| **Per-team plugin config DB**  | [IBM MCP Context Forge #3751](https://github.com/IBM/mcp-context-forge/issues/3835)                         | الهام برای فاز ۷: override تیم‌محور؛ فاز ۶ = YAML/code registry کافی                                      |

**تصمیم creative ولی pragmatist:** Paperclip صریح می‌گوید governance و audit در **core** می‌ماند؛ plugin فقط capability اضافه می‌کند. app-tour همین را دارد: CASL + RLS در core؛ Denali فقط registry/rules/finance subscribe.

### 3.2 Strangler Fig برای port legacy → plugin

| گام | عمل                                                                                    | منبع                                                                                                                           |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Facade** — `resolveWorkspacePluginForType` با legacy pass-through برای denali نشده   | [AWS Strangler Fig](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html)         |
| 2   | **ACL** — adapter types legacy → `CanonicalDocument`؛ types legacy leak نکنند          | Fowler ACL                                                                                                                     |
| 3   | **Shadow read** — همان tour در starter vs denali validation output byte-compare در تست | [Go strangler playbook](https://dev.to/gabrielanhaia/strangler-fig-in-go-migrating-a-monolith-without-a-big-bang-rewrite-1b4k) |
| 4   | **Feature flag ramp** — 0% → internal tenants → % traffic                              | [Symfony strangler playbook](https://devtide.cy/insights/strangler-fig-pattern-for-symfony-monoliths)                          |
| 5   | **حذف مسیر legacy** همان sprint که flag 100%                                           | جلوگیری از dual maintenance                                                                                                    |

**خلاقانه برای CLI/monorepo:** الگوی «bundle plugin as dep در v2 سپس جدا در v3» ([DEV strangler for CLIs](https://dev.to/aman_kumar_bdd40f1b711c15/from-monolithic-clis-to-modular-plugins-applying-the-strangler-fig-pattern-3gok)) — در monorepo ما معادل: `workspace-denali` در `pnpm` workspace همیشه جدا؛ api فقط **dynamic import** در 6.5 نه copy-paste.

### 3.3 Transactional outbox و finance در مرز plugin

| اصل                                    | توضیح                                                        | منبع                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **یک bounded context برای شروع relay** | finance handlers فقط پس از Order/Tour aggregate پایدار       | [NILUS outbox + DDD](https://www.nilus.be/blog/transaction_outbox_pattern_in_event-driven_microservices/) |
| **رویداد دامنه صریح**                  | `TourCreated`, `RegistrationPaid` نه generic row CDC برای UI | توصیه NILUS                                                                                               |
| **relay جدا از HTTP**                  | MassTransit-style: API بدون publisher مستقیم                 | [NP Blog outbox production](https://www.npiontko.pro/2025/05/19/outbox-pattern)                           |
| **idempotent consumer**                | `domainEventId` dedupe در plugin                             | legacy spec + Michal Drozd                                                                                |
| **CDC اختیاری فاز بعد**                | Debezium برای analytics نه مسیر بحرانی 6.4                   | [Conduktor glossary](https://www.conduktor.io/glossary/outbox-pattern-for-reliable-event-publishing)      |

**برای 6.4:** handler در `packages/workspaces/denali/src/finance/` که به **همان** outbox table Phase 5 گوش می‌دهد (یا bus in-process تا relay آماده) — **ممنوع:** جدول ledger جدید در `apps/api`.

### 3.4 Registry-driven forms (wizard)

| رویکرد                                    | مناسب Denali؟                    | یادداشت                                                                     |
| ----------------------------------------- | -------------------------------- | --------------------------------------------------------------------------- |
| **Registry + codegen (وضع موجود legacy)** | **بله — ادامه**                  | از قبل `rules/generated`؛ جابجایی به build step trunk                       |
| **Runtime JSON → Zod hydrate**            | مکمل برای admin template builder | shadcn-form-designer model                                                  |
| **zod-to-form codegen**                   | فقط برای فرم‌های ساده admin      | [zod-to-form](https://zod.toform.dev/) — wizard محصول پیچیده‌تر از AutoForm |
| **RHF به‌عنوان SoT**                      | **خیر**                          | مغایر covenant                                                              |

**توصیه:** حفظ pipeline «registry data → generate rules/schemas → engine evaluate»؛ تست parity `legacy domain output === trunk plugin output` برای fixture tours.

### 3.5 Object storage (6.7 MinIO)

| اصل ۲۰۲۶                | پیاده‌سازی پیشنهادی                              |
| ----------------------- | ------------------------------------------------ |
| Prefix per tenant       | `s3://bucket/{tenantId}/tours/{tourId}/...`      |
| Pre-signed PUT از API   | core endpoint generic؛ policy از plugin metadata |
| Content-type + size cap | در plugin `uiHints` یا capability                |
| بدون public bucket      | signed GET کوتاه‌عمر                             |

(جزئیات env در [`phase-5/appendices/env-runtime-matrix.md`](../phase-5/appendices/env-runtime-matrix.md) و MAP §5 — فاز ۵ MinIO را به 6.7 defer کرده.)

---

## بخش ۴ — معماری پیشنهادی فاز ۶ (ترکیب خلاقانه + محافظه‌کار)

### 4.1 لایه‌بندی هدف

```text
┌──────────────────────────────────────────────────────────────────┐
│ Host (apps/api, apps/web)                                         │
│  resolveWorkspacePlugin(tenant.workspaceType)                     │
│  CanonicalTourService · CASL · RLS · generic MinIO presign       │
└────────────────────────────┬─────────────────────────────────────┘
                             │ WorkspacePlugin interface only
┌────────────────────────────▼─────────────────────────────────────┐
│ @app-tour/workspace-denali                                        │
│  getDenaliWorkspacePlugin()                                       │
│  fieldRegistry · rules · composites · theme/tokens.css            │
│  finance/ (outbox consumer adapters)                              │
│  migrateCanonical() hook for trip_details                       │
└────────────────────────────┬─────────────────────────────────────┘
                             │ uses (no reverse imports)
┌────────────────────────────▼─────────────────────────────────────┐
│ workspace-sdk · platform-core · design-tokens · ui-primitives      │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 «خلاقانه» ولی قابل تأیید

| ایده                              | توضیح                                                       | ریسک        | mitigation                                                  |
| --------------------------------- | ----------------------------------------------------------- | ----------- | ----------------------------------------------------------- |
| **Plugin contract manifest JSON** | `denali.plugin.manifest.json` برای guard: لیست exports مجاز | drift       | `phase-6.contract.spec.ts`                                  |
| **Golden tour fixtures**          | ۳–۵ canonical JSON از legacy audits → snapshot tests        | نگهداری     | versioned under `packages/workspaces/denali/test/fixtures/` |
| **Shadow validation mode**        | API flag: validate با starter و denali، log diff only       | perf        | فقط non-prod                                                |
| **Codegen در CI**                 | `pnpm run denali:codegen`؛ fail on dirty `generated/`       | UX dev      | pre-commit optional                                         |
| **Finance as pure functions**     | handlers بدون Nest؛ inject `OutboxReader` port              | testability | interface در plugin test                                    |

### 4.3 Anti-corruption layer (ACL) برای port

```typescript
// Conceptual — lives in packages/workspaces/denali/src/acl/
// legacy/types MUST NOT appear in apps/api

legacyTourShape → normalizeLegacyTripDetails() → CanonicalDocument
CanonicalDocument → buildDenaliCreateTourPayload() → API DTO (if any)
```

تمام mapping در **یک پوشه ACL**؛ PRهای خارج از ACL در 6.2 ممنوع.

---

## بخش ۵ — نقشه ریسک و پیش‌شرط‌ها

| ID      | ریسک                            | احتمال | اثر                 | mitigation                                        |
| ------- | ------------------------------- | ------ | ------------------- | ------------------------------------------------- |
| R-P6-01 | Phase 5.3–5.5 SPEC_ONLY         | بالا   | 6.4/6.6 blocked     | stub outbox + ledger contract tests؛ parallel 5.x |
| R-P6-02 | Duplicate web domain            | متوسط  | drift دائمی         | 6.2 قبل از 6.3؛ ممنوع copy web registry           |
| R-P6-03 | platform-core آلودگی            | متوسط  | نقض فاز ۱           | `denali-coupling.contract.spec` + phase-6 guard   |
| R-P6-04 | build-green = done              | بالا   | forensic fail       | verification matrix per subphase                  |
| R-P6-05 | `trip_details` dual-write برگشت | پایین  | data corruption     | فقط 6.8 migration؛ DEC-P6-007                     |
| R-P6-06 | Node < 24 در CI agent           | متوسط  | gate false negative | `check:node-engine`                               |

---

## بخش ۶ — منابع و گام بعدی

### 6.1 منابع وب (بازبینی 2026-06-04)

- Multi-tenant widget / plugin: [sujeet.pro widget framework](https://sujeet.pro/articles/widget-framework), [Paperclip PLUGIN_SPEC](https://github.com/paperclipai/paperclip/blob/master/doc/plugins/PLUGIN_SPEC.md)
- Strangler: [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html), [HLD Handbook](https://hld.handbook.academy/curriculum/architecture-patterns/strangler-fig/)
- Outbox: [NILUS](https://www.nilus.be/blog/transaction_outbox_pattern_in_event-driven_microservices/), [Michal Drozd dual-write](https://www.michal-drozd.com/en/blog/transactional-outbox/), [Conduktor](https://www.conduktor.io/glossary/outbox-pattern-for-reliable-event-publishing/)
- Forms: [zod-to-form](https://zod.toform.dev/) (مرجع برای admin ساده — نه جایگزین wizard Denali)

### 6.2 منابع repo

| سند / مسیر                                                                                                 | نقش         |
| ---------------------------------------------------------------------------------------------------------- | ----------- |
| [`docs/phase-6-denali-workspace.md`](../phase-6-denali-workspace.md)                                       | North star  |
| [`docs/phase-6/appendices/IMPLEMENTATION-DECISIONS.md`](../phase-6/appendices/IMPLEMENTATION-DECISIONS.md) | DEC-P6-\*   |
| [`docs/appendices/PLATFORM-CONTINUITY-0-6.md`](../appendices/PLATFORM-CONTINUITY-0-6.md)                   | پیوستگی ۰–۶ |
| [`legacy/map.md`](../../legacy/map.md)                                                                     | نقشه مهاجرت |
| [`packages/workspaces/starter`](../packages/workspaces/starter)                                            | الگوی shell |

### 6.3 گام بعدی (پس از تأیید — انجام‌شده 2026-06-04)

1. ✅ هر `6.x-subphase` — actions + REQ-P6 + verification (see `docs/phase-6/subphases/`)
2. ✅ [`industry-alignment-2026.md`](../phase-6/appendices/industry-alignment-2026.md)
3. ✅ [`verification-matrix.md`](../phase-6/audits/verification-matrix.md) · [`IMPLEMENTATION-TRUTH`](../phase-6/audits/IMPLEMENTATION-TRUTH.md)
4. **بعدی:** پیاده‌سازی کد از **6.0** — `pnpm run phase-6:guard` برای doc pack

---

**Architect, documentation status: Updated. Link to docs: `docs/research/phase-6-denali-workspace-research.md` (+ `.ai-exec.md`).**

# Field Exposure Decision Engine — Code-Ready Migration Task Plan

> هدف این فایل: تبدیل مسیر مهاجرت به تسک‌های کوچک قابل اجرا در کد.
> این سند طراحی جدید نیست؛ فقط مسیر اجرای کنترل‌شده از legacy delivery selection به `FieldExposureDecisionEngine` را به واحدهای کاری ریزتر می‌شکند.

---

## اصول ثابت

- رفتار production تغییر نمی‌کند مگر در فاز cutover.
- Telegram provider دست‌نخورده می‌ماند.
- Integration payload shape تا زمان cutover تغییر نمی‌کند.
- `FieldExposureDecisionEngine` باید pure، deterministic و بدون وابستگی به `apps/api` بماند.
- `eligibleFieldIds` و `candidateFieldIds` فقط مرحله‌به‌مرحله از منبع حقیقت خارج می‌شوند، نه ناگهانی.
- `deliverable` tag فعلا فقط برای seed/compatibility قابل استفاده است و نباید long-term runtime policy بماند.

---

## Phase A — Freeze & Stabilize

### A1 — Snapshot وضعیت فعلی shadow path
**هدف:** مطمئن شویم shadow فعلی بدون اثر روی production قابل اجراست.

**Files:**
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`
- `apps/api/src/exposure/compare-shadow-vs-legacy.ts`
- `apps/api/src/exposure/classify-shadow-drift.ts`
- `apps/api/src/exposure/infer-exposure-policy-hypothesis.ts`
- `apps/api/src/exposure/extract-observed-exposure-model.ts`

**کار:**
- مسیر فعلی `FIELD_EXPOSURE_DECISION_ENGINE_SHADOW` را مرور کن.
- مطمئن شو همه چیز پشت flag است.
- مطمئن شو همه‌ی خطاهای shadow با `try/catch` fail-open می‌شوند.

**Done:**
- با flag خاموش هیچ log مربوط به shadow تولید نمی‌شود.
- با flag روشن delivery همچنان enqueue می‌شود حتی اگر shadow خطا بدهد.

---

### A2 — تست عدم تغییر payload با shadow خاموش
**هدف:** اثبات کنیم production path بدون shadow تغییر نکرده است.

**Files:**
- `apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts`

**کار:**
- تست اضافه/تکمیل کن که با `FIELD_EXPOSURE_DECISION_ENGINE_SHADOW` خاموش، payload خروجی همان payload legacy است.
- assert روی این کلیدها:
  - `integrationDeliveryCandidateFieldIds`
  - `integrationDeliveryFieldIds`
  - `integrationDeliveryFieldValues`
  - `integrationDeliveryMessageTemplate`

**Done:**
- تست dispatch با shadow خاموش pass می‌شود.
- هیچ assertion جدیدی به engine وابسته نیست.

---

### A3 — تست fail-open بودن shadow
**هدف:** اگر engine یا observer خطا داد، dispatch نشکند.

**Files:**
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`
- `apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts`

**کار:**
- dependency injection حداقلی یا mock مناسب برای ایجاد خطا در shadow path آماده کن.
- تست کن job همچنان enqueue می‌شود.

**Done:**
- در صورت throw در shadow، `enqueueIntegrationDeliveryJob` همچنان صدا زده می‌شود.
- log warning تولید می‌شود.

---

### A4 — تثبیت public exports موتور
**هدف:** مسیر import برای engine پایدار شود.

**Files:**
- `packages/platform-core/src/exposure/index.ts`
- `packages/platform-core/src/index.ts`
- `packages/platform-core/test/unit/field-policy/public-api.spec.ts`

**کار:**
- assert کن `resolveFieldExposureDecision` و `normalizeIntegrationEventType` از root export در دسترس هستند.

**Done:**
- public API test برای exposure exports اضافه و pass می‌شود.

---

## Phase B — Parity Gate Activation

### B1 — افزودن aggregate parity result
**هدف:** علاوه بر log per-field، برای هر dispatch یک نتیجه‌ی aggregate داشته باشیم.

**Files:**
- `apps/api/src/exposure/compare-shadow-vs-legacy.ts`
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`

**کار:**
- `ShadowParityReport` همین حالا `matches` و `mismatchCount` دارد؛ آن را در log aggregate استفاده کن.
- log جدید یا تکمیل‌شده:
  - `event: "field_exposure.shadow_parity_summary"`
  - `matches`
  - `mismatchCount`
  - `fieldCount`

**Done:**
- برای هر dispatch shadow-enabled، دقیقا یک summary log تولید می‌شود.
- production payload تغییر نمی‌کند.

---

### B2 — ثبت metric برای mismatch count
**هدف:** parity به gate قابل مشاهده تبدیل شود.

**Files:**
- `apps/api/src/observability/metrics.ts`
- `apps/api/src/observability/metrics.spec.ts`
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`

**کار:**
- از الگوی metricهای موجود استفاده کن.
- metric پیشنهادی: `field_exposure_engine_shadow_mismatch_total`
- labels محدود:
  - `tenant_id`
  - `event_type`
  - `surface`

**Done:**
- وقتی mismatchCount > 0 است، metric increment می‌شود.
- cardinality کنترل شده است.
- تست metrics pass می‌شود.

---

### B3 — تست mismatchهای comparator
**هدف:** comparator به عنوان parity gate قابل اعتماد شود.

**Files:**
- `apps/api/src/exposure/compare-shadow-vs-legacy.spec.ts`

**کار:**
- پوشش این حالت‌ها را کامل کن:
  - `FIELD_MISSING`
  - `FIELD_EXTRA`
  - `STATE_MISMATCH`
  - no mismatch
  - deterministic ordering by `fieldId`

**Done:**
- خروجی comparator پایدار و قابل snapshot/assert است.

---

### B4 — تعریف شرط خروج عملیاتی parity
**هدف:** مرحله parity بدون اثر runtime، معیار cutover بعدی را بسازد.

**Files:**
- `docs/architecture/field-exposure-system.md`
- `TEMP/field-exposure-engine-migration-plan.md`

**کار:**
- در docs ثبت کن که Phase B فقط observational است.
- شرط خروج: mismatch rate برای scope انتخاب‌شده مشخص و triaged شده باشد.

**Done:**
- docs می‌گوید parity gate چه چیزی را اندازه می‌گیرد و چه چیزی را تغییر نمی‌دهد.

---

## Phase C — Engine Becomes Decision Source (Non-Blocking)

### C1 — افزودن registry existence check به engine
**هدف:** engine از skeleton خارج شود، اما هنوز production را تغییر ندهد.

**Files:**
- `packages/platform-core/src/exposure/types.ts`
- `packages/platform-core/src/exposure/field-exposure-decision-engine.ts`
- `packages/platform-core/test/unit/exposure/field-exposure-decision-engine.spec.ts`

**کار:**
- به input snapshot حداقل registry fields اضافه کن.
- اگر `fieldId` در registry نبود:
  - state = `blocked`
  - reasonChain شامل `registry:missing`
- اگر موجود بود، مسیر فعلی ادامه پیدا کند.

**Done:**
- unregistered field تست دارد و `blocked` می‌شود.
- هیچ import از `apps/api` اضافه نشده است.

---

### C2 — افزودن FieldPolicy lower-bound به engine
**هدف:** engine Field Policy را به عنوان lower bound اعمال کند.

**Files:**
- `packages/platform-core/src/exposure/field-exposure-decision-engine.ts`
- `packages/platform-core/src/exposure/types.ts`
- `packages/platform-core/test/unit/exposure/field-exposure-decision-engine.spec.ts`

**کار:**
- engine از snapshot آماده‌ی FieldPolicy استفاده کند.
- اگر FieldPolicy field را `hidden` کرد، engine نتواند `visible` برگرداند.
- mapping اولیه:
  - FieldPolicy `hidden` -> Exposure `hidden`
  - FieldPolicy `visible|required|readonly` -> فعلا اجازه ادامه به `visible`

**Done:**
- FieldPolicy hidden تست دارد.
- engine همچنان pure است.

---

### C3 — تبدیل ExposureIntent به محدودکننده غیر-authoritative
**هدف:** intent در engine لحاظ شود ولی هنوز delivery را تغییر ندهد.

**Files:**
- `packages/platform-core/src/exposure/types.ts`
- `packages/platform-core/src/exposure/field-exposure-decision-engine.ts`
- `apps/api/src/exposure/exposure-intent-delivery-selection.ts`
- `packages/platform-core/test/unit/exposure/field-exposure-decision-engine.spec.ts`

**کار:**
- `disabled` -> `hidden`
- `inherit_profile` -> بدون تغییر
- `override_fields` فقط اگر field در selected list نبود -> `hidden`

**Done:**
- intent disabled و override tests اضافه شوند.
- legacy delivery هنوز `deliveryPolicy.eligibleFieldIds` را استفاده می‌کند.

---

### C4 — ساخت API adapter برای engine input
**هدف:** ساخت snapshotها از سیستم موجود در یک نقطه متمرکز شود.

**Files:**
- `apps/api/src/exposure/build-field-exposure-engine-input.ts` (new)
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`
- `apps/api/src/exposure/build-field-exposure-engine-input.spec.ts`

**کار:**
- از plugin registry snapshot بساز.
- از plugin fieldPolicy snapshot بساز.
- trigger را normalize کن.
- audience فعلا `external_channel` بماند.
- surface همان مقدار opaque فعلی بماند.

**Done:**
- dispatch دیگر snapshot construction را inline انجام نمی‌دهد.
- رفتار log/shadow تغییر نمی‌کند.

---

### C5 — ثبت engine decision در audit metadata بدون استفاده runtime
**هدف:** engine خروجی authoritative-intent metadata بدهد، نه selector runtime.

**Files:**
- `apps/api/src/exposure/resolve-exposure-decision.ts`
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`
- `apps/api/src/exposure/resolve-exposure-decision.spec.ts`

**کار:**
- decisionهای engine را در metadata/audit قرار بده.
- legacy selected ids همچنان selector واقعی باشند.

**Done:**
- job payload selector هنوز legacy است.
- audit metadata engine را دارد.

---

## Phase D — Remove Legacy Field Selection Dependency

### D1 — تولید exposedFieldIds از engine decisions
**هدف:** engine خروجی قابل مصرف برای selector بدهد.

**Files:**
- `apps/api/src/exposure/resolve-exposure-decision.ts`
- `packages/platform-core/src/exposure/types.ts`
- `apps/api/src/exposure/resolve-exposure-decision.spec.ts`

**کار:**
- از تصمیم‌های per-field، `engineSelectedFieldIds` بساز.
- mapping:
  - `visible` -> include
  - `redacted` -> include only if formatter supports placeholder-safe redaction
  - `summary_only` -> فعلا exclude یا explicit compatibility decision
  - `hidden|blocked` -> exclude

**Done:**
- خروجی engine-selected field ids تست دارد.
- هنوز delivery از آن استفاده نمی‌کند مگر flag cutover.

---

### D2 — اضافه کردن selector switch در dispatch
**هدف:** انتخاب field ids بین legacy و engine controlled شود.

**Files:**
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`
- `apps/api/src/exposure/exposure-runtime-mode.ts`
- `apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts`

**کار:**
- mode فعلی را توسعه بده یا از mode موجود استفاده کن.
- در `shadow/parity/non_blocking` selector = legacy.
- در `cutover` selector = engine.
- rollback با env/config به legacy برگردد.

**Done:**
- تست دارد که shadow mode legacy را استفاده می‌کند.
- تست دارد که cutover mode engine ids را استفاده می‌کند.

---

### D3 — enrichment را از selector انتخاب‌شده تغذیه کن
**هدف:** field values از selector فعال بیاید.

**Files:**
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`
- `apps/api/src/integrations/application/enrich-canonical-delivery-payload.ts`
- `apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts`

**کار:**
- `enrichCanonicalDeliveryPayload()` به جای `deliveryPolicy.eligibleFieldIds`، selected ids فعال را بگیرد.
- legacy path هنوز برای rollback محاسبه شود تا زمانی که Phase E برسد.

**Done:**
- در cutover، enriched values از engine ids می‌آید.
- در shadow، enriched values از legacy ids می‌آید.

---

### D4 — payload compatibility در cutover
**هدف:** Telegram formatter بدون تغییر کار کند.

**Files:**
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`
- `apps/api/src/integrations/platform/format-integration-delivery-message.ts`
- `apps/api/src/integrations/platform/format-integration-delivery-message.spec.ts`

**کار:**
- حتی در cutover، payload keys سازگار باقی بمانند تا worker/provider نشکند.
- `integrationDeliveryFieldIds` می‌تواند engine-selected ids باشد.
- template redaction behavior بدون تغییر بماند.

**Done:**
- formatter tests pass.
- provider adapter تغییر نکرده است.

---

### D5 — accepted mismatch list برای cutover scope
**هدف:** cutover فقط روی scope کنترل‌شده انجام شود.

**Files:**
- `apps/api/src/exposure/compare-shadow-vs-legacy.ts`
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`
- `docs/architecture/field-exposure-system.md`

**کار:**
- برای scope اولیه مثلا `workspaceType=denali`, `eventType=TourCreated`, `surface=telegram` معیار پذیرش ثبت کن.
- mismatchهای پذیرفته‌شده مستند شوند.

**Done:**
- cutover فقط برای scope مشخص فعال می‌شود.
- mismatch خارج از scope باعث برگشت به legacy می‌شود.

---

## Phase E — Cleanup / Removal

### E1 — حذف runtime dependency به `resolveDeliveryFieldPolicy`
**هدف:** legacy selector از active path خارج شود.

**Files:**
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`
- `apps/api/src/integrations/application/resolve-delivery-field-policy.ts`
- `apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts`

**کار:**
- بعد از rollback window، dispatch دیگر برای selection به `resolveDeliveryFieldPolicy` وابسته نباشد.
- اگر هنوز برای audit لازم است، فقط در compatibility adapter باقی بماند.

**Done:**
- active dispatch selector فقط engine است.

---

### E2 — حذف runtime نقش `candidateFieldIds` / `eligibleFieldIds`
**هدف:** این مفاهیم از selector runtime حذف شوند.

**Files:**
- `apps/api/src/integrations/application/dispatch-integration-domain-event.ts`
- `apps/api/src/integrations/platform/format-integration-delivery-message.ts`
- `apps/api/src/integrations/application/dispatch-integration-domain-event.spec.ts`

**کار:**
- اگر keyها برای compatibility payload باقی می‌مانند، منبع‌شان engine-selected ids باشد.
- دیگر هیچ decision runtime بر اساس candidate/eligible legacy نباشد.

**Done:**
- سرچ repo نشان می‌دهد active selector از این دو مفهوم استفاده نمی‌کند.

---

### E3 — retire کردن observability موقت
**هدف:** stack مشاهده‌گری shadow بعد از cutover تمیز شود.

**Files:**
- `apps/api/src/exposure/compare-shadow-vs-legacy.ts`
- `apps/api/src/exposure/classify-shadow-drift.ts`
- `apps/api/src/exposure/infer-exposure-policy-hypothesis.ts`
- `apps/api/src/exposure/extract-observed-exposure-model.ts`
- `apps/api/src/exposure/field-exposure-shadow-diagnostics.ts`
- `apps/api/src/exposure/shadow-exposure-resolver.ts`
- `apps/api/src/exposure/shadow-delivery-field-parity.ts`
- `apps/api/src/exposure/shadow-rendered-delivery-parity.ts`
- `apps/api/src/observability/metrics.ts`

**کار:**
- اگر دیگر نیاز نیست، حذف کن.
- اگر برای audit بعد cutover لازم است، فقط metrics پایدار را نگه دار.

**Done:**
- runtime logs دیگر drift/hypothesis/model temporary تولید نمی‌کند.

---

### E4 — حذف runtime reliance به `deliverable` tag
**هدف:** `deliverable` از policy runtime خارج شود.

**Files:**
- `apps/api/src/exposure/exposure-field-catalog.ts`
- `apps/api/src/exposure/resolve-registry-seeded-exposure-profile.ts`
- `apps/api/src/exposure/resolve-persisted-exposure-profile.ts`

**کار:**
- `deliverable` فقط seed/migration source بماند.
- runtime decisions از persisted profile + engine بیاید.

**Done:**
- engine runtime برای expose/hide به tag وابسته نیست.
- docs این retirement را ثبت می‌کند.

---

## Verification Fast Path

برای هر فاز، اول static inspection و تست‌های هدفمند:

```bash
pnpm --filter @app-tour/platform-core exec node --import tsx --test test/unit/exposure/field-exposure-decision-engine.spec.ts
pnpm --filter @apps/api exec node --import tsx --test src/exposure/compare-shadow-vs-legacy.spec.ts
pnpm --filter @apps/api exec node --import tsx --test src/integrations/application/dispatch-integration-domain-event.spec.ts
```

برای guard عمومی، مسیر سبک:

```bash
pnpm run pre-commit:fast && pnpm run guard:import-boundary
```

Full gates فقط با تایید صریح.

---

## DONE Definition

مهاجرت کامل است وقتی:

- `FieldExposureDecisionEngine` تنها selector runtime برای exposed fields باشد.
- `dispatchIntegrationDomainEvent()` برای selection به legacy `eligibleFieldIds` / `candidateFieldIds` وابسته نباشد.
- `deliverable` tag دیگر runtime exposure behavior را تعیین نکند.
- Integration فقط routing، enrichment، enqueue، formatting، credentials، retries و provider delivery انجام دهد.
- Telegram output برای cutover scope پذیرفته‌شده behavior-compatible بماند.
- shadow/parity/drift/hypothesis/model extraction از runtime حذف یا خاموش شده باشد.
- تست‌ها ثابت کنند حذف legacy selector رفتار پذیرفته‌شده production را نمی‌شکند.


### Phase B closure status (2026-06-28)

- B1 aggregate `field_exposure.shadow_parity_summary` — complete
- B2 metric `field_exposure_engine_shadow_mismatch_total` with `tenant_id`, `event_type`, `surface` — complete
- B3 comparator coverage (`FIELD_MISSING`, `FIELD_EXTRA`, `STATE_MISMATCH`, ordering) — complete
- B4 observational-only exit criteria + triage gate documented — complete
- Contract: `apps/api/test/field-exposure-phase-b-parity-gate.contract.spec.ts`


### Phase C closure status (2026-06-28)

- C1 registry existence check — complete (`hidden` + `registry_check:missing`)
- C2 FieldPolicy lower bound — complete
- C3 ExposureIntent constraints — complete (`disabled`->`blocked`, `override_fields`->`hidden`, `inherit_profile` no-op)
- C4 `build-field-exposure-engine-input.ts` adapter — complete
- Contract: `apps/api/test/field-exposure-phase-c-engine.contract.spec.ts`


### Phase D closure status (2026-06-28)

- D1 engineSelectedFieldIds projection — complete (audit in shadow + cutover)
- D2 selector switch shadow/cutover — complete
- D3 enrichment from active selector — complete
- D4 payload compatibility keys — complete (formatter unchanged)
- D5 accepted scope module — complete (`accepted-engine-cutover-scope.ts`)
- Contract: `apps/api/test/field-exposure-phase-d-selector.contract.spec.ts`


### Phase E closure status (2026-06-28)

- E1 cutover selector engine-only — complete (`resolveDeliveryFieldPolicy` definitions-only)
- E2 cutover compatibility keys engine-sourced — complete
- E3 legacy mirror + forward shadow observability skipped in cutover — complete
- E4 deliverable tag bypass in cutover via `useEngineCatalogForCandidates` — complete
- Contract: `apps/api/test/field-exposure-phase-e-cleanup.contract.spec.ts`


## Migration DONE (engineering) — 2026-06-28

All phases A–E closed. Aggregator contract: `apps/api/test/field-exposure-engine-migration-done.contract.spec.ts`

Production cutover remains scoped to `denali` / `TourCreated` / `telegram` with `FIELD_EXPOSURE_RUNTIME_MODE=cutover`.
Rollback: `FIELD_EXPOSURE_RUNTIME_MODE=shadow`.

# گزارش Gap — Tour Profile Parity (فاز ۰)

**وضعیت:** تکمیل شده (تحلیل diff، بدون تغییر رفتار کد)  
**تاریخ:** 2026-05-16  
**منبع الزامات:** [`prompt.md`](../../prompt.md)  
**برنامهٔ اجرا:** [`tour-profile-execution-roadmap.md`](./tour-profile-execution-roadmap.md)  

---

## خلاصهٔ اجرایی

تحلیل diff بین **profileRules (web)**، **API `createTour`**، **API `updateTour` (PATCH)** و **Edit RBAC** انجام شد.

| محور | وضعیت کلی |
|------|-----------|
| **Submit-required (۴ مسیر wizard)** | هم‌تراز بین web، `@repo/types` و API **فقط روی POST create** — تست‌های parity موجود |
| **Edit-only required (mountain)** | عمدی در descriptor؛ در wizard submit نیست — **شکاف product/P1** |
| **PATCH submit-required** | ✅ هنگام `lifecycle_status → OPEN` — `assertProfileRequiredFieldsForPublish` (فاز ۱، 2026-05-16) |
| **PATCH field-level RBAC** | ✅ `total_capacity` → leader+ (`TOUR_PATCH_FIELD_RULES`); سایر فیلدها هنوز **P1** |
| **Lifecycle OPEN** | create و PATCH نامتقارن — **P1** |
| **Capability model** | CASL درشت (`Tour` update) — **فاز ۳** |

**اولین PR پیشنهادی (فاز ۱):** اعمال `assertProfileRequiredFieldsForSubmit` (یا معادل PATCH) هنگام transition به `OPEN` یا قبل از persist نهایی draft — قبل از field-level RBAC.

---

## منابع تحلیل‌شده

| لایه | مسیرهای کلیدی |
|------|----------------|
| Web wizard rules | `apps/web/src/features/tours/wizard/profileRules/rules.ts`, `validation.ts`, `fieldGroups.ts` |
| Web Edit RBAC | `apps/web/src/features/tours/config/editFieldRbac.ts`, `editCoreFieldConfig.ts`, `tripDetailsFieldConfig.ts` |
| Types (قرارداد) | `packages/types/src/tour-profile-submit-required.ts`, `tour-form-profile-descriptors.ts` |
| API create | `apps/api/src/modules/tours/tours.service.ts` (`createTour`), `utils/assert-profile-required-fields-for-submit.ts` |
| API PATCH | `apps/api/src/modules/tours/tours.service.ts` (`updateTour`), `utils/assert-create-tour-invariants.ts` |
| Lifecycle | `apps/api/src/modules/tours/policies/tour-lifecycle.policy.ts` |
| CASL / نقش | `apps/api/src/modules/tours/tours.controller.ts`, `packages/shared/rbac/ability.factory.ts` |
| تست‌های parity موجود | `submit-required-parity.spec.ts`, `parity-with-server.spec.ts`, `assert-profile-required-fields-for-submit.spec.ts` |

---

## ماتریس submit-required per profile (بدون شکاف در create)

الگوریتم مشترک: `getRequiredSubmitFieldPathsForProfile` در `@repo/types`؛ web از `requiredFieldsForProfile`؛ API از `assertProfileRequiredFieldsForSubmit` (فقط create).

| Profile | `inactiveFieldGroups` | مسیرهای required در submit |
|---------|------------------------|----------------------------|
| `general` | — | هر ۴: title, basePrice, itinerary.days, primaryTransportMode |
| `mountain_outdoor` | — | هر ۴ (+ ۴ `recommended` در wizard، non-blocking) |
| `nature_trip` | — | هر ۴ |
| `cultural_tour` | — | هر ۴ |
| `urban_event` | itinerary, participation, logistics؛ capacity redundant | فقط `overview.title` |
| `cinema_event` | itinerary, participation؛ capacity redundant | `overview.title`, `logistics.primaryTransportMode` |

**نگاشت wizard path → DTO (create):**

| Wizard path | فیلد DTO |
|-------------|----------|
| `overview.title` | `dto.title` |
| `pricing.basePrice` | `dto.cost_context.totalCost` |
| `itinerary.days` | `tripDetails.itinerary.segmentActivities` یا `dayPlans` (غیرخالی) |
| `logistics.primaryTransportMode` | `tripDetails.logistics.primaryTransportMode` |

**تأیید parity:** `apps/web/src/features/tours/wizard/profileRules/submit-required-parity.spec.ts` — برای هر `TOUR_FORM_PROFILE_VALUES` web === types.

---

## ۱. required-field gaps

| # | Gap | Web | API create | API PATCH | اولویت | اقدام پیشنهادی |
|---|-----|-----|------------|-----------|--------|----------------|
| R1 | **`assertProfileRequiredFieldsForSubmit` فقط POST** | `validateForSubmit` در wizard | ✅ بعد از strip | ✅ PATCH→OPEN پس از merge (`assertProfileRequiredFieldsForPublish`) | ~~P0~~ **بسته** | — |
| R2 | **Edit descriptor `required` ≠ wizard submit** | ۴ مسیر wizard + Edit presets جدا | publish: هر دو enforce | publish | ~~P1~~ **بسته** | `getEditRequiredTripDetailsPathsForProfile` + `assertEditRequiredTripDetailsForPublish` |
| R3 | **`MOUNTAIN_OUTDOOR_EDIT_PRESETS` required** | Edit UI + API publish | ✅ هنگام OPEN | ✅ | ~~P1~~ **بسته** | همان R2 |
| R4 | **`pricing.basePrice` vs `cost_context.totalCost`** | نام متفاوت | mapping در assert | همان در PATCH اگر R1 حل شود | P2 | مستند در types؛ تست mapping موجود |
| R5 | **Zod schema vs profileRules** | هر دو در wizard | class-validator روی DTO | PATCH merge | P2 | regression: تغییر rules بدون schema → drift |
| R6 | **`recommended` در wizard** | non-blocking submit | API ignore | — | P2 | by design؛ فقط UI badge |

### Appendix — Edit-only required (`mountain_outdoor`)

از `packages/types/src/tour-form-profile-descriptors.ts` → `MOUNTAIN_OUTDOOR_EDIT_PRESETS`:

| Field id | requiredness |
|----------|--------------|
| `participation.minimumAge` | required |
| `overview.difficultyLevel` | required |
| `participation.gearRequiredIds` | required |
| `logistics.meetingPoint` | required |
| `logistics.departureDate` | required |
| `participation.technicalSkillRequired` | recommended |
| `logistics.returnDate` | recommended |
| `logistics.transportationNotes` | recommended |
| `logistics.groupSizeMin` | recommended |
| `logistics.groupSizeMax` | recommended |

این مسیرها در `BASE_FIELD_RULES` wizard **نیستند** (عمدی — `rules.ts`).

---

## ۲. PATCH field holes

### ۲.۱ نقش‌ها در API (endpoint-level)

| نقش | POST create | PATCH update | CASL |
|-----|-------------|--------------|------|
| Owner / Admin | ✅ | ✅ | `manage all` / `update Tour` |
| Leader | ✅ | ✅ | `create`, `update` on `Tour` |
| Member | ❌ | ❌ | فقط `read Tour` |
| Viewer | ❌ | ❌ | read only |

مرجع: `tours.controller.ts` — `@Roles` روی create/patch: Owner, Admin, Leader.

**نتیجه:** شکاف «member PATCH می‌زند» در **endpoint فعلی وجود ندارد** — Edit RBAC برای member **defense-in-depth UI** است. شکاف واقعی: **Leader/Admin بدون field-level ACL** و **بدون submit-required روی PATCH**.

### ۲.۲ جدول holes

| # | فیلد / رفتار | Edit UI (نقش) | API PATCH | اولویت | اقدام پیشنهادی |
|---|--------------|---------------|-----------|--------|----------------|
| P1 | `core.totalCapacity`, `core.capacity` | `minRoleForEdit: leader` (`editCoreFieldConfig.ts`) | Leader+ می‌تواند `total_capacity` بفرستد — **هم‌تراز** برای نقش‌های مجاز | P2 | نگه‌داری؛ اگر member روزی PATCH گرفت → `assertPatchFieldPolicy` |
| P2 | **`total_capacity`** | `minRoleForEdit: leader` | ✅ `assertPatchFieldsAllowedForWorkspaceRole` + `TOUR_PATCH_FIELD_RULES` | ~~P0~~ **بسته (فاز ۲)** | گسترش `TOUR_PATCH_FIELD_RULES` برای فیلدهای بعدی |
| P2b | **سایر فیلدهای `UpdateTourDto`** | trip-details: بدون `role` در matrix | Leader PATCH سایر کلیدها | **P1** | افزودن rules به `tour-patch-field-policy.ts` |
| P3 | **tripDetails urban/cinema** | گروه‌های hidden در wizard | pre-strip روی کلیدهای patch + post-assert | ~~P1~~ **بسته (فاز ۲ اسلایس ۲)** | تست‌های unit در `assert-create-tour-invariants.spec.ts` |
| P4 | **`transportModes` روی urban** | root hidden | `requiresEmptyRootTransportModes` + pre-strip | P1 | parity-with-server موجود؛ تست PATCH اضافه |
| P5 | **`formProfile` / snapshot** | — | strip همیشه؛ snapshot refresh پشت `TOURS_REFRESH_FORM_PROFILE_SNAPSHOT_ON_PATCH` | P2 | مستند rollout flag |
| P6 | **`cost_context`, `lifecycle_status`, …** | Edit matrix پراکنده | بدون role filter | **P1** | map به capability `tour.update.core` در فاز ۳ |

### ۲.۳ خط لوله PATCH (مرجع)

```
updateTour
  → load FOR UPDATE
  → total_capacity >= acceptedCount
  → lifecycle: OPEN → assertTourIsPublishable + assertValidLifecycleTransition
  → merge fields
  → (tripDetails|transportModes) → pre-strip fragment → strip → assertTripDetailsForFormProfile
  → mountain gate
  → save
```

**غایب:** `assertProfileRequiredFieldsForSubmit`.

---

## ۳. capability candidates (فاز ۳)

امروز: `@CheckAbilities` + `ability.can(action, "Tour")` درشت؛ بدون field granularity.

| # | رفتار فعلی | محل | capability پیشنهادی | فاز |
|---|------------|-----|---------------------|-----|
| C1 | create tour | `ability.factory` | `tour.create` → CASL `create Tour` | ✅ فاز ۳ |
| C2 | PATCH tour | `update Tour` | `tour.update` | ✅ فاز ۳ |
| C3 | PATCH core fields | `assert-patch-field-policy` | `tour.update.core` → CASL `update TourCore` | ✅ فاز ۳ |
| C4 | PATCH tripDetails | service | `tour.update.tripDetails` → CASL `update TourTripDetails` | ✅ فاز ۳ |
| C5 | OPEN transition | lifecycle policy | `tour.publish` → CASL `publish Tour` | ✅ فاز ۳ |
| C6 | Settings themes | settings controllers | `settings.themes.manage` → CASL `manage Settings` | ✅ جدول؛ wire در اسلایس ۲ |
| C7 | Registration staff mutations | registrations module | `registration.staff.mutate` | ۳ |
| C8 | Member read settings lists | `grantMemberActive` → `read Settings` | `settings.read` | ۳ |

**قانون prompt:** feature جدید = capability یا module — نه `WorkspaceRole` ششم.

---

## ۴. transition gaps (create vs PATCH vs OPEN)

### ۴.۱ ماتریس lifecycle

```
DRAFT  → OPEN | CANCELLED
OPEN   → CLOSED | CANCELLED
CLOSED → CANCELLED
```

### ۴.۲ جدول شکاف‌ها

| # | سناریو | create (`createTour`) | PATCH (`updateTour`) | Wizard | اولویت | اقدام |
|---|---------|----------------------|----------------------|--------|--------|--------|
| T1 | **OPEN مستقیم** | `assertTourStateReadyForOpenOnCreate` (بدون DRAFT gate) | `assertTourPublishableBeforePatch` + post-merge gate | submit validation | ~~P1~~ **بسته (فاز ۴)** | `tours-lifecycle-transitions.spec.ts` |
| T2 | **submit-required** | ✅ `assertProfileRequiredFieldsForSubmit` | ✅ PATCH→OPEN | ✅ submit | ~~P0~~ **بسته** | — |
| T3 | **Readiness OPEN** | title + capacity>0 + durationDays اختیاری | همان + draft gate | — | P2 | aligned در `assertTourOpenReadiness` |
| T4 | **CLOSED/CANCELLED** | فقط DRAFT\|OPEN در create DTO | همه در PATCH DTO | — | P2 | by design |
| T5 | **ثبت‌نام** | — | — | — | P2 | `assertTourIsOpenForRegistration` جدا |

### ۴.۳ تست‌های پیشنهادی (فاز ۴)

| تست | فایل پیشنهادی |
|-----|----------------|
| create DRAFT → PATCH OPEN بدون title | `tours-lifecycle-transitions.spec.ts` (جدید) |
| create OPEN مستقیم urban (title only) | موجود در smoke |
| PATCH phantom participation urban | API invariant spec |

---

## ۵. اولویت‌بندی تجمیعی

| اولویت | شناسه‌ها | تعداد |
|--------|----------|--------|
| **P0** | — | ۰ |
| **بسته (فاز ۲)** | P2 (`total_capacity`) | ۱ |
| **بسته (فاز ۱)** | R1, T2 | ۲ |
| **P1** | R2, R3, P3, P4, P6, T1 | ۶ |
| **P2** | R4, R5, R6, P1, P5, T3, T4, T5 | ۸ |

---

## ۶. آنچه عمداً شکاف نیست

| موضوع | دلیل |
|--------|------|
| Submit-required web ↔ types ↔ API create | تست parity سبز |
| Strip urban/cinema wizard ↔ server | `parity-with-server.spec.ts` |
| Member PATCH tour | endpoint اجازه نمی‌دهد |
| `recommended` در submit | tier طراحی شده — non-blocking |
| حذف CASL/RBAC | خارج از scope — فقط extend |

---

## ۷. گام‌های بعدی (فاز ۱–۴) — بسته‌شده

| فاز | وضعیت | تحویل |
|-----|--------|--------|
| ۱ | ✅ | submit-required + edit-required publish (R2/R3) |
| ۲ | ✅ | PATCH field RBAC + phantom urban/cinema tests |
| ۳ | ✅ | `capabilities.ts` + `assert-tour-mutation-abilities` |
| ۴ | ✅ | lifecycle transitions + web parity spec |

---

## ۸. فاز ۵ — Policy & Capability Consolidation (2026-05-16)

| اسلایس | وضعیت | تحویل |
|--------|--------|--------|
| 5.1 | ✅ | `capability-registry.ts`, `resolveEffectiveCapabilities`, hydrate از `user_tenants.labels` در `AuthMiddleware`, `GET /auth/membership-ability-context`, mirror در `@repo/shared-contracts` |
| 5.2 | ✅ | `apps/api/.../tour-patch-field-policy.ts` (همه کلیدهای DTO) |
| 5.3 | ✅ | `assert-tour-patch-write-pipeline.ts` + `assert-tour-create-write-pipeline.ts` در controller |
| 5.5 | ⏳ | `tenant_capabilities` DB، RegionalLeader — آینده |

**Pipeline منجمد (PATCH):** `RolesGuard` / `@CheckAbilities` → `assertTourPatchWritePreMerge` → invariants در `updateTour` → save.

**شکاف باقی‌مانده:** ~~ستون `user_tenants.capabilities`~~ → grants در `membership_metadata.capabilities` (migration `1777595300000`).

---

## ۹. فاز ۶–۹ — Regional, governance, drift (2026-05-16)

| اسلایس | وضعیت | تحویل |
|--------|--------|--------|
| 6.1 | ✅ | Admin UI `user-capabilities-card.tsx` (checkbox + regions) |
| 6.2 | ✅ | `PATCH …/workspaces/:tenantId/users/:userId/capabilities`, `assert-capability-assignable.ts` |
| 6.3 | ✅ | Regional list/detail + `updateTour` / destination PATCH guard |
| 6.4 | ✅ | `PATCH …/settings/modules`, tenant module gate in `evaluate-require-capabilities` |
| 7.1–7.2 | ✅ | `run-tour-governance.mjs`, CI job `tour-rbac-parity` |
| 7.3 | ✅ | Nightly workflow + optional Slack webhook step |
| 8.1 | ✅ | `tour-trip-details-sensitive-paths.ts`, `assert-sensitive-trip-details-patch.ts` |
| 8.2 | ⏳ | JWT capability snapshot — اختیاری (ALS preferred) |
| 8.3 | ✅ | `@RequireCapability` on reconciliation, admin payments, settings regions mutations |
| 8.4 | ✅ | `MARKETING_LABEL_CAPABILITY_ALIASES` |
| 9.1 | ✅ | Governance bundle (`check-tour-rbac-parity`, audit registry, unit tests) |
| 9.2 | ✅ | Slack alert step (skips when secret unset) |
| 9.3–9.4 | ✅ | Registry + این گزارش + `RBAC-SECURITY-COVERAGE.md` |

---

*گزارش فاز ۰؛ فاز ۱–۹ در کد منعکس شده است (8.2 اختیاری).*

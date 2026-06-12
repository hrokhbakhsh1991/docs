# اختلاف‌ها و کمبودهای ویزارد / تمپلیت ستینگ (Trunk vs Legacy)

> فقط شکاف‌ها — بدون برنامه اصلاح.  
> آخرین بررسی: 2026-06-11 (بازبینی پنجم — الگوهای Enterprise + شکاف‌های قابل افزودن)

---

## ۱. ناسازگاری workspace در dev/smoke — **بسته (Phase 11.0 · DEC-P11-001 · 2026-06-11)**

| موضوع | وضعیت پس از 11.0 |
|-------|------------------|
| `OPERATOR_SMOKE_E2E_SEED=1` + memory | API و web هر دو **`denali`** — override `starter` حذف شد |
| `GET /settings/modules` | manifest کامل denali (`API-9.6-02` به‌روز) |
| Hub `/settings` | کارت equipment/locations/themes دیده می‌شود |
| کاتالوگ smoke | `bootstrapOperatorSmokeCatalogIfNeeded` + `db:seed` |
| doc | `docs/phase-11/subphases/11.0-smoke-workspace-alignment.md` |

**تاریخچه (قبل از 11.0):** API عمداً `starter` برمی‌گرداند در حالی که web ویزارد Denali بود — split-brain.

---

## ۲. زنجیره Settings → Wizard (کاتالوگ‌های مرجع)

مدل: **تمپلیت ویزارد** فیلد را روشن می‌کند؛ **ماژول ستینگ** گزینه‌ها را تأمین می‌کند. هر دو لازم است.

### تجهیزات (`equipment` → `participants.gearItems`)

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| ماژول در hub (denali واقعی) | ✅ | ✅ در manifest — **مگر** smoke/starter (§۱) |
| Seed داده در smoke | — | **ندارد** — `equipmentStore` خالی تا CRUD دستی |
| فیلد `compatibleCategories` | فیلتر بر اساس دسته تور | **ندارد** — فقط `category` تکی روی entity |
| فیلتر در ویزارد | فقط تجهیزات سازگار با `category` تور | همه `isActive` (در عمل همه ردیف‌های store) |
| انتخاب stale بعد از حذف از کاتالوگ | hint + نگه‌داشتن انتخاب | ندارد |
| `isActive` روی equipment row | داشت | **ندارد** — حذف = پاک شدن از store |

### تم‌ها (`tour_themes` → `program.themeIds`)

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| ماژول در hub | ✅ | همان محدودیت smoke §۱ |
| فیلتر در ویزارد | `formProfile` / دسته تور | فقط `isActive` |
| فیلد `formProfile` روی `TourThemeResource` | داشت | **در type/API نیست** |
| sanitize UUID نامعتبر در submit | داشت | ندارد |

### مکان‌ها (`locations` → `destinationId`, gathering, start point)

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| ماژول در hub | ✅ | همان محدودیت smoke §۱ |
| تور event → لیست مقصد خالی | داشت | تأیید نشده |
| sanitize `destinationId` stale | داشت | ندارد |

### زبان راهنما (`guide_languages`)

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| CRUD در Settings | ✅ | ✅ (مگر smoke §۱) |
| مصرف در ویزارد | در registry ویزارد نبود | **هنوز نیست** — `localGuideName` متن آزاد است |

### presetها (`tour_presets` / `tour_presets_advanced`)

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| prefill ویزارد از preset | — | CRUD/config هست؛ **اتصال به `/tours/new` نیست** |

### تمپلیت ویزارد (`tour_wizard_template`)

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| فیلد در ویزارد بدون publish | — | `published: false` → ویزارد خالی (INV-WIZ-003) |
| فیلد در تمپلیت ولی کاتالوگ خالی | composite پیام empty | همان — **بدون لینک به Settings برای پر کردن کاتالوگ** وقتی §۱ فعال است |

---

## ۳. انتخاب راهنما / لیدر در ویزارد (`leaderUserIds`)

فیلد: composite `denali.leader-user-ids` · مسیر canonical `leaderUserIds` · در `denaliFullWizardTemplate` هست.

| موضوع | Legacy (رفتار مورد انتظار مشتری) | Trunk |
|-------|-----------------------------------|-------|
| منبع داده | roster تیم workspace | `GET /api/users?role=all&tab=active` |
| پارامتر وضعیت | فیلتر اعضای فعال | **`tab=active` نادیده گرفته می‌شود** — API فقط `status=active` می‌فهمد؛ پیش‌فرض `status=all` (شامل معطل‌ها ممکن است) |
| فیلتر کاندید لیدر | راهنمای قابل انتخاب / نقش‌های مجاز | `isSelectableLeader === true` **یا** `role === admin` **یا** `role === owner` |
| برچسب سفارشی در rewards (`labels[]`) — مثلاً «admin» | — | **در فیلتر لیدر استفاده نمی‌شود** |
| Toggle «راهنمای قابل انتخاب تور» (`isSelectableLeader`) در rewards مالک | باید در multiselect باشد | در فیلتر هست — **اگر** API users جواب دهد |
| عضو با `role=member` + فقط برچسب «admin» بدون toggle | — | **در لیست لیدر نیست** |
| UI multiselect | — | لیست checkbox — بدون نمایش badge/برچسب‌های rewards در کنار نام |
| دسترسی API users | roster برای نقش‌های مجاز | **owner-only** (DEC-P9-018) — از `/tours/new` با session مالک باید کار کند؛ خطای 403 → لیست خالی |
| fallback وقتی فیلتر خالی است | — | `leaders.length === 0` → **همه** `items` نشان داده می‌شوند (رفتار غیرمنتظره) |

**شکاف UX مشخص‌شده:** کاربری که مالک در rewards برچسب (مثلاً admin) زده ولی `isSelectableLeader` را روشن نکرده و نقش RBAC او member است → در multiselect لیدر ویزارد **ظاهر نمی‌شود**.

---

## ۴. استپ‌ها و جریان submit

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| استپ `review` | UI کامل بازبینی و ثبت | در `stepIds` هست؛ در تمپلیت و render plan **نیست** |
| دکمه نهایی | استپ `review` | آخرین استپ تمپلیت (`denali_legal`) |
| خلاصه validation + read-back | `DenaliReviewStep` | ندارد |

---

## ۵. Publish (draft / active)

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| `publishStatus` | UI در review | `settingsSurface: "review"` — از palette تمپلیت حذف |
| انتخاب draft/active | دارد | ندارد |
| publish readiness / guard | دارد | ندارد |

---

## ۶. تأیید ادمین و تایید خودکار قله

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| `requiresManualAdminApproval` | checkbox + نمایش در review | در تمپلیت؛ primitive boolean |
| `participants.minRequiredPeaks` | Select ۰–۴ + شرط mountaineering ∧ approval | input عددی آزاد |
| شرط نمایش peak field | predicate در domain | در domain هست |
| `autoAcceptRegistrations` / placement با `userPastPeaksCount` | API registration | در `apps/api` **یافت نشد** |

---

## ۷. Submit و canonical

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| payload create کامل | projection کامل | `create-tour.server.ts` عمدتاً فقط `title` |
| sanitize refs کاتالوگ | دارد | ندارد |
| `TourWizardDraft` type | RHF mirror | shape starter در type؛ runtime canonical مسطح |

---

## ۸. تمپلیت ستینگ — builder

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| گروه‌بندی section در builder | section-groups | checkbox per path |
| overlay visibility به rule-set | `fieldRulesOverlay` | `resolveDenaliRuleSetFromTemplate` noop |
| `stepOverrides` | skip/insert | فقط `enabled` + ترتیب |

---

## ۹. Draft و staging

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| draft-engine + debounce | دارد | مدل متفاوت (`TourWizardDraft` + session عکس) |
| staging tour برای آپلود عکس | دارد | session جدا — parity کامل تأیید نشده |

---

## ۱۰. فیلدهای Layer C (خارج palette تمپلیت)

| فیلد | Legacy | Trunk |
|------|--------|-------|
| `publishStatus` | UI review | excluded |
| `meetingPoint`, `startPointLocationText` | deprecated | excluded |
| `pricing.paymentMode` | implicit | excluded |

---

## ۱۱. فایل‌های مرجع (برای ردیابی)

| حوزه | مسیر |
|------|------|
| split workspace smoke | `apps/api/src/tenant/resolve-workspace-type.ts` · `apps/web/src/tenant/tenant-kernel.ts` |
| لیست ماژول‌های settings | `apps/api/src/settings/settings.service.ts` · `packages/workspace-sdk/src/reference/starter-settings.manifest.ts` |
| manifest denali | `packages/workspaces/denali/src/settings/denali-settings.manifest.ts` |
| gear ویزارد | `apps/web/src/wizard/denali/denali-gear-field.tsx` |
| leaders ویزارد | `apps/web/src/wizard/denali/denali-leader-user-ids-field.tsx` |
| rewards → leader | `apps/web/src/features/users/users-rewards-logic.ts` · `apps/api/src/identity/users.service.ts` |
| تمپلیت کامل | `packages/workspaces/denali/src/settings/denaliFullWizardTemplate.ts` |
| تست smoke modules | `apps/api/test/settings-modules.spec.ts` (`API-9.6-02`) |

---

## ۱۲. شرط‌ها، لینک فیلدها، و برخورد جفت‌فیلدی (بازبینی سوم)

مدل Legacy: **ماتریس (category × duration)** + **قوانین زمینه‌ای (contextual)** + **invariantها** + **composite anchor**.  
Trunk دو لایه موازی دارد که ممکن است از هم جدا شوند.

### ۱۲.۱ دو موتور شرط (ریسک drift)

| لایه | مسیر | چه چیزی را اعمال می‌کند |
|------|------|-------------------------|
| **A — plan filter** | `applyDenaliConditionalFieldRules` → `evaluateFormFieldRule` | فقط **فیلدهای anchor** داخل `RenderStepPlan` (مسیرهایی که `shouldRenderDenaliRegistryField` true) |
| **B — composite داخلی** | `denali-transport-logic.ts`، `denali-pricing-payment-field.tsx`، … | منطق تکراری/جزئی داخل ویجت؛ **بدون** `DenaliUIContextOptions` |

مسیرهای وابسته composite (`DENALI_COMPOSITE_DEPENDENT_PATHS`) هرگز در plan نیستند → لایه A روی آن‌ها **اعمال نمی‌شود**؛ فقط لایه B (اگر پیاده شده) یا همیشه نمایش داخل composite.

---

### ۱۲.۲ جدول لینک‌های ثبت‌شده در registry (جفت ماشه → وابسته)

| ماشه (watch) | فیلد وابسته | نوع rule | Legacy/domain | Trunk UI |
|--------------|-------------|----------|---------------|----------|
| `requiresLocalGuide` | `localGuideName` | `whenTruthy` | ✅ | لایه A روی primitive جدا — **باید** کار کند |
| `requiresManualAdminApproval` ∧ دسته mountain | `participants.minRequiredPeaks` | `peakExperienceVisible` | ✅ | لایه A روی anchor composite؛ UI عددی آزاد (نه Select ۰–۴) — §۶ |
| `pricing.requiresPayment` | `pricing.basePricePerPerson` | `whenTruthy` (+ required) | ✅ | لایه B در `denali-pricing-payment` — **هم‌خوان** |
| `transport.mode` | `transportCost`, `allowPersonalCar`, … | `transport*` | ✅ | لایه B در composite — **ناهم‌خوان برای dong** (زیر) |
| `transport.mode` + `allowPersonalCar` | `dongAmount`, `adminCapacityApproval` | `transportDong*` / `transportAdminCapacity*` | ✅ | `adminCapacity` درست؛ **`dongAmount` نادرست** |
| `category` × `duration` (matrix) | `peakHeight`, `itinerary`, `endDateTime`, hiking, logistics | tags / `cellOverrides` | ✅ | لایه A روی anchorها؛ زیرفیلدهای composite **بدون** فیلتر لایه A |
| `workspaceFormProfile` / تم | `tripDetails.overview.customServiceLabels` | `capability: canDefineCustomServices` | ✅ | Web **هرگز** profile را به rule engine نمی‌دهد — §۱۲.۴ |
| `basicInfo.tourType` (هر مقدار truthy) | `nonAttendanceDetails` | `whenTruthy` | — | در `denaliFullWizardTemplate` **نیست** |
| `destinationId` (کاتالوگ) | `tripDetails.overview.peakHeight` | prefill در `notes` registry | ✅ | `denali-destination-field.tsx` **فقط** select — بدون prefill ارتفاع |

---

### ۱۲.۳ اختلاف‌های تأییدشده (جفت‌فیلدی)

#### الف) حمل‌ونقل: `allowPersonalCar` × `mode` → `dongAmount`

| | Domain (`denali-transport-rules.ts`) | Web (`denali-transport-logic.ts` + composite) |
|---|--------------------------------------|-----------------------------------------------|
| dong وقتی `shared_cars` | ✅ | ✅ |
| dong وقتی `bus|minibus|train` **و** `allowPersonalCar=true` | ✅ visible **و** required | ✅ dong وقتی `allowPersonalCar=true` (`isDenaliDongAmountVisible(mode, allowPersonalCar)`) — 2026-06-11 |

**Observable:** اتوبوس + خودرو شخصی مجاز → Legacy dong می‌خواهد؛ Trunk فقط checkbox ظرفیت ادمین را نشان می‌دهد.

`adminCapacityApproval` در web با domain **هم‌خوان** است (mode + allowPersonalCar).

#### ب) قیمت: `requiresPayment` → `basePricePerPerson`

هم‌خوان در composite. فیلد وابسته در plan جدا نیست (dependent path) — فقط لایه B.

#### ج) تأیید ادمین × نوع کوهنوردی → `minRequiredPeaks`

Domain (`isPeakExperienceVisible`): `mountain_*` ∧ `requiresManualAdminApproval`.

- لایه A فیلد را از plan حذف می‌کند وقتی شرط برقرار نیست (تست node: approval off → visible false).
- **جابه‌جایی استپ:** ماشه در `denali_basic`، فیلد در `denali_pricing` — وابستگی cross-step فقط از طریق adapter فرم کار می‌کند.
- UI: input عددی بدون محدوده ۰–۴.

#### د) راهنمای محلی: `requiresLocalGuide` → `localGuideName`

Domain درست؛ هر دو primitive جدا در تمپلیت — لایه A.

#### ه) شرکت‌کنندگان: ماتریس mountain × composite `pricing-participants`

| فیلد | nature_day (domain) | UI composite |
|------|---------------------|--------------|
| `participants.minimumAge` (anchor) | hidden | کل composite مخفی می‌شود ✅ |
| `participants.fitnessLevel` و سایر mountain-only | hidden | داخل composite — اگر anchor visible باشد همه زیرفیلدها رندر می‌شوند |
| `participants.nationalIdRequired` | **visible** (tag `core`) | **هیچ UI ندارد** — در `DENALI_COMPOSITE_DEPENDENT_PATHS` است ولی `denali-pricing-participants-field.tsx` آن را رندر نمی‌کند؛ anchor مخفی = دسترسی به nationalId هم از بین می‌رود |

**شکاف ترکیبی:** `nationalIdRequired` برای تور غیرکوهستانی باید مستقل بماند؛ تمپلیت آن را جدا لیست کرده ولی anchor/composite اجازه نمایش جدا نمی‌دهد.

#### و) `destinationId` → `peakHeight`

Registry: «prefilled from destination catalog». Web: بدون wire؛ اپراتور باید دستی وارد کند حتی اگر مقصد در Settings ارتفاع داشته باشد.

#### ز) `customServiceLabels` × capability پروفایل workspace

- Rule: `capability: canDefineCustomServices`.
- بدون `workspaceFormProfile` در `evaluateDenaliContextualRule`: حالت visibility → **`true`** (خط ۷۹–۸۰ `denaliContextualRules.ts`)؛ سپس ماتریس `hidden: true` پیش‌فرض آن را می‌بندد.
- با پروفایل واقعی: web **profile را پاس نمی‌دهد** → parity با Legacy workspaceهای pilot/full **قطعی نیست**.
- Composite `denali-custom-services` خودش capability چک نمی‌کند؛ فقط به حذف از plan وابسته است.

---

### ۱۲.۴ `DenaliUIContextOptions` در web

`evaluateFormFieldRule` / `applyDenaliConditionalFieldRules` **هیچ** `mainThemeFormProfile` یا `workspaceFormProfile` به domain نمی‌فرستند.

تأثیر: قوانین `capability`، فیلتر تم بر اساس `formProfile`، و هر شرط وابسته به پروفایل workspace/theme **در ویزارد web تضمین‌شده نیست**.

---

### ۱۲.۵ `structuralInvariant` / ghost state

بسیاری فیلدها `structuralInvariant: { kind: "clearWhenNotVisible" }` دارند (مثلاً `peakHeight`, `dongAmount`, `minRequiredPeaks`).

- Registry به `denaliInvariantEngine.ts` ارجاع می‌دهد.
- **`denaliInvariantEngine.ts` روی trunk یافت نشد** → وقتی فیلد مخفی می‌شود، مقدار قبلی در `TourWizardDraft` **پاک نمی‌شود** (مثلاً dong بعد از عوض کردن mode، peak بعد از خاموش کردن approval).

Legacy: normalize قبل از submit این ghostها را می‌زد.

---

### ۱۲.۶ تمپلیت × شرط (overlay بی‌اثر)

`fieldRulesOverlay` در settings تمپلیت → `resolveDenaliRuleSetFromTemplate` **noop**.

اپراتور نمی‌تواند از builder شرط/visibility فیلد را نسبت به Legacy overlay تغییر دهد؛ فقط enable/disable مسیر در تمپلیت.

---

### ۱۲.۷ خلاصه اولویت observable (شرطی)

1. **Bus + خودرو شخصی → dong** — domain می‌خواهد، UI نه.
2. **`nationalIdRequired`** — domain برای non-mountain visible، UI اصلاً نیست.
3. **Ghost values** — بدون invariant engine بعد از toggle شرط‌ها.
4. **Profile/capability** — بدون `DenaliUIContextOptions` در web.
5. **Destination → peakHeight prefill** — لینک کاتالوگ قطع.
6. **Composite dependents** — fitness/insurance وقتی anchor visible است برای همه categoryها یکجا نشان داده می‌شوند (اگر cellOverride anchor را visible بگذارد).

---

### ۱۲.۸ فایل‌های مرجع (شرطی)

| موضوع | مسیر |
|-------|------|
| فیلتر plan | `apps/web/src/wizard/denali/denali-wizard-conditional-logic.ts` |
| adapter draft→form | `apps/web/src/wizard/denali/denali-draft-form-adapter.ts` |
| evaluate تک‌فیلد | `packages/workspaces/denali/src/rules/evaluateFormRules.ts` |
| contextual rules | `packages/workspaces/denali/src/rules/denaliContextualRules.ts` · `predicates.ts` |
| transport domain | `packages/workspaces/denali/src/types/legacy/denali-transport-rules.ts` |
| transport web (drift) | `apps/web/src/wizard/denali/denali-transport-logic.ts` |
| composite anchors | `packages/workspaces/denali/src/composites/denali-composite-anchors.ts` |
| registry links | `packages/workspaces/denali/src/field-registry/denaliFieldRegistryData.ts` |
| overlay noop | `packages/workspaces/denali/src/normalize/resolveRuleModel.ts` |


---

## ۱۳. قابلیت‌های UX پیشرفته Legacy که روی Trunk نیست

تمرکز: **پیش‌نویس آنلاین**، **کپی از تور**، **ادامه پیشرفت**، **ارور هندلینگ با پرش به فیلد**، **ویرایش کامل**.

### ۱۳.۱ پیش‌نویس آنلاین (draft-engine)

| قابلیت | Legacy | Trunk |
|--------|--------|-------|
| پکیج `@repo/draft-engine` | `legacy/packages/draft-engine` — debounce، OCC، conflict | **وجود ندارد** در `packages/` |
| ذخیره سرور | `PATCH /api/workspaces/:id/draft-engine/denali-create` (`draft_snapshots` + `draft_events`) | **ندارد** — فقط `wizard-drafts/` در MinIO برای **عکس** قبل از create |
| React hook | `useDraftEngine` + `createDenaliDraftAdapter` | `useState(emptyTourWizardDraft)` — **RAM فقط** |
| debounce آنلاین | پیش‌فرض ۵۰۰ms؛ هر edit → sync | ندارد |
| وضعیت sync UI | `draftState.status` (`IDLE`/`SYNCING`/`ERROR`) + `DenaliWizardSyncProvider` | ندارد |
| conflict 409 | `REFETCH_REAPPLY` + merge | ندارد |
| retry / clear | `retryDraft()`، `clearDraft()` بعد از submit موفق | ندارد |
| snapshot محتوا | `{ form, currentStepIndex, registryLayoutVersion }` | ندارد |
| normalize قبل از sync | `denaliDraftOrchestrator.prepareDraftForSync` + `sanitizeDenaliWizardDraftSnapshot` | ندارد |
| بازگشت بعد از refresh | draft از سرور hydrate می‌شود | **همه چیز از بین می‌رود** |
| تغییر workspace | reset + draft جدا per workspace | session بدون persist |

**Observable:** اپراتور Legacy وسط ویزارد تب را ببندد و برگردد → ادامه همان استپ و فیلدها؛ Trunk از صفر.

---

### ۱۳.۲ ادامه پیشرفت (progress / resume)

| قابلیت | Legacy | Trunk |
|--------|--------|-------|
| نوار پیشرفت استپ | دارد (`WorkspaceTourWizard` + step list) | دارد (`WizardStepShell`) — **فقط UI** |
| `currentStepIndex` persist | در draft snapshot سرور | `useState(0)` در `workspace-wizard-host` — **با refresh صفر** |
| sync استپ با draft | `useEffect` روی `draftState.data.currentStepIndex` | ندارد |
| block ناوبری هنگام sync | `navLocked` / `stepBusy` | فقط `disabled` روی دکمه submit |
| resume معنادار | بله (draft + step) | خیر |

---

### ۱۳.۳ کپی / duplicate از تور موجود

| قابلیت | Legacy | Trunk |
|--------|--------|-------|
| دکمه Duplicate در لیست | `router.push(/tours/new?clone=:id)` | `tour-card.tsx` لینک `?clone=` — **همان الگو** |
| خواندن `?clone=` در ویزارد | `GET /api/tours/:id` → `transformTourToDenaliWizardValues` (تست integration: pre-fill عنوان) | `new-tour-wizard-client.tsx` **`useSearchParams` / `clone` ندارد** — query **نادیده** |
| transform canonical → فرم | `legacy/.../clone/transformTourToDenaliWizardValues.ts` (~۴۰۰+ خط) | **ندارد** |
| فیلتر gear stale | against active equipment catalog | ندارد |
| remint عکس/itinerary | Safe-Remint در clone | ندارد |
| عنوان `(Copy)` | در clone DTO | ندارد |
| API server-side clone | `POST /api/v2/tours/clone/:sourceTourId` (deep clone + idempotency) | **ندارد** در `apps/api` |
| تست قرارداد | `WEB-9.3-04` فقط **URL** duplicate را چک می‌کند — نه hydrate | |

**شکاف UX:** دکمه «کپی» در لیست تورها هست ولی ویزارد خالی باز می‌شود (مثل تور جدید).

---

### ۱۳.۴ ویرایش تور (edit wizard)

| قابلیت | Legacy | Trunk |
|--------|--------|-------|
| صفحه edit | `DenaliTourEditForm` — همه استپ‌های ویزارد (بدون review) + RHF | `tour-edit-page-client.tsx` — **فقط patch عنوان** |
| hydrate از tour | `transformTourToDenaliWizardValues(..., { mode: "clone" })` | `GET /api/tours/:id` برای نمایش؛ **بدون** بازنویسی ویزارد |
| submit edit | projection کامل + patch intent | `buildTourTitlePatch` |
| catalog sanitize on edit | `useDenaliEditCatalogSanitize` | ندارد |

---

### ۱۳.۵ استپ Review + validation پیشرفته

| قابلیت | Legacy | Trunk |
|--------|--------|-------|
| استپ `review` | `DenaliReviewStep` + خلاصه read-back | §۴ — نیست |
| لیست خطاها در review | `DenaliReviewValidationSummary` — گروه‌بندی per step | ندارد |
| کلیک خطا → پرش | `onFocusField(stepId, formPath)` → `setCurrentStep` + `focusDenaliWizardField` | ندارد |
| submit gate | `evaluateDenaliWizardSubmitGate` (Zod + publish readiness) | ندارد |
| publish readiness | `getDenaliWizardPublishReadinessIssuesForTargetStatus` | ندارد |
| خطای API → فیلد | `handleDenaliWizardValidationApiError` + `apply-api-validation-errors` | `createTourAction` → پیام generic (`submit.errorGeneric`) |
| validation هر استپ «بعدی» | `applyDenaliWizardStepValidation` + `scrollTourFormToFirstError` | `WizardStepShell` — **Next بدون validate** |
| scroll به اولین خطا | `scrollTourFormToFirstError` + `flattenDenaliFormErrors` | ندارد |

---

### ۱۳.۶ نقشه فوکوس فیلد (error → DOM)

Legacy: `denaliWizardFieldFocus.ts` — `DENALI_FIELD_FOCUS_SELECTORS` برای هر `formPath` + `data-field-path` / `data-testid` روی کنترل‌ها؛ هایلایت `data-denali-focus`.

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| `data-field-path` روی inputها | دارد (FormField / composites) | **جستجو در `apps/web`: صفر** |
| `focusDenaliWizardField` | scroll + focus ring + `.focus()` | ندارد |
| `focusDenaliSubmitValidationError` | اولین issue → step + field | ندارد |
| integration تست فوکوس | `DenaliStepFocusBridge.integration.test.tsx` | ندارد |

بدون این لایه، حتی اگر validation اضافه شود، **پرش دقیق به فیلد خطادار** ممکن نیست.

---

### ۱۳.۷ سایر قابلیت‌های مرتبط (create flow)

| قابلیت | Legacy | Trunk |
|--------|--------|-------|
| RHF + resolver canonical | `createDenaliCanonicalWizardResolver` | draft مسطح + `setCanonicalStringValue` |
| `prepareDenaliSubmitArtifact` | sanitize catalog refs قبل از POST | ندارد (§۷) |
| staging tour برای عکس | lazy `stagingTourId` در `DenaliCanonicalContext` | `wizardSessionId` + MinIO — partial (§۹) |
| Clear all / reset فرم | `handleClearAll` + `clearDraft` | ندارد |
| Factory instantiate | `POST .../tour-wizard-template/instantiate` → baseline form | seed label + field overlays فقط |
| Sentry روی draft hydrate | `reportDenaliDraftError` | ندارد |

---

### ۱۳.۸ خلاصه اولویت observable

1. **`?clone=` مرده** — UI لیست لینک می‌دهد، ویزارد hydrate نمی‌کند.
2. **بدون draft آنلاین** — refresh = از دست رفتن کار + استپ.
3. **بدون review / error focus** — submit خطا فقط یک `<p role="alert">` کلی.
4. **Next بدون validation** — اپراتور تا آخر می‌رود بدون gate per-step.
5. **edit = فقط title** — نه ویزارد کامل Legacy.

---

### ۱۳.۹ فایل‌های مرجع

| موضوع | Legacy | Trunk |
|-------|--------|-------|
| draft engine | `legacy/packages/draft-engine/` | — |
| wizard orchestrator | `legacy/.../WorkspaceTourWizard.tsx` | `apps/web/app/tours/new/new-tour-wizard-client.tsx` |
| draft adapter | `legacy/.../drafts/denali-adapter.ts` | — |
| clone transform | `legacy/.../clone/transformTourToDenaliWizardValues.ts` | — |
| review + errors | `legacy/.../DenaliReviewStep.tsx` · `DenaliReviewValidationSummary.tsx` | — |
| field focus | `legacy/.../denaliWizardFieldFocus.ts` | — |
| duplicate UI | `legacy/.../tours-list-view.tsx` | `apps/web/app/(app)/tours/tour-card.tsx` |
| edit wizard | `legacy/.../DenaliTourEditForm.tsx` | `apps/web/app/(app)/tours/[id]/edit/tour-edit-page-client.tsx` |
| step shell | — | `apps/web/src/wizard/wizard-step-shell.tsx` |
| تست URL clone | — | `apps/web/test/tours-list.spec.ts` (`WEB-9.3-04`) |


---

## ۱۴. الگوهای Enterprise / حرفه‌ای (صنعت + SaaS) — آنچه می‌توانیم داشته باشیم و الان نداریم

> منبع: مقایسه Trunk/Legacy با الگوهای رایج در **CMS publishing** (Capell Publishing Studio)، **workflow/approval SaaS** (Velt، Palmyra، FlowCore)، **فرم‌های enterprise** (Formstack، Jotform، Exsited)، و **نرم‌افزار tour-operator** (Beebus، TourTools، TourTek، TripBuilder).  
> موارد هم‌پوشان با §۱۳ (draft آنلاین، clone، review focus) فقط bullet کوتاه + ارجاع.

### ۱۴.۱ ماتریس خلاصه (الان در Trunk)

| دسته | نمونه قابلیت حرفه‌ای | Trunk | Legacy (مرجع) |
|------|----------------------|-------|----------------|
| Persistence | autosave + resume + OCC | ❌ §۱۳ | ✅ draft-engine |
| Copy / template | duplicate tour + preset | ❌ §۱۳ | ✅ transform + preset |
| Validation UX | per-step + review + focus field | ❌ §۱۳ | ✅ |
| Publishing | draft/active + readiness + schedule | ❌ §۴–۵ | partial (بدون schedule) |
| Collaboration | comment روی فیلد + assign reviewer | ❌ | ❌ |
| Versioning | diff نسخه‌ها + rollback | ❌ | ❌ |
| Quality meter | درصد تکمیل محتوا | ❌ | ✅ `DenaliWizardContentQualityHeader` |
| Analytics | drop-off / زمان تکمیل | ❌ | ❌ |
| Governance | audit trail تغییرات فیلد ویزارد | ❌ | ❌ (settings audit جدا) |
| Integrations | webhook / PDF proposal / channel | ❌ | ❌ |

---

### ۱۴.۲ Publishing و governance (الگوی CMS / editorial)

قابلیت‌هایی که در **Publishing Studio**، **Filestage**، و **approval SaaS** استاندارد است:

| # | قابلیت | توضیح کوتاه | وضعیت ما |
|---|--------|------------|----------|
| 1 | **Release workspace** | چند تغییر هم‌زمان → preview/compare → publish اتمی | نداریم |
| 2 | **Scheduled publish** | انتشار در زمان مشخص + unpublish/embargo | نداریم |
| 3 | **Compare با live** | diff قبل از publish (فیلدبه‌فیلد) | نداریم |
| 4 | **Version history + rollback** | بازگشت به نسخه published قبلی | نداریم (فقط `rowVersion` تور در API؛ UI نیست) |
| 5 | **Review assignment** | assign reviewer، submit/approve/reject/request-changes | نداریم (فقط `requiresManualAdminApproval` روی تور — §۶) |
| 6 | **Field-level comments** | کامنت روی همان فیلد/بخش، نه چت عمومی | نداریم |
| 7 | **Stale draft management** | هشدار پیش‌نویس کهنه + prune/TTL | نداریم |
| 8 | **Dry-run validation** | «اگر الان publish کنی» بدون commit | نداریم (domain readiness در Legacy بود؛ UI نبود) |
| 9 | **Customer-facing preview** | پیش‌نمایش صفحه عمومی رزرو قبل از active | نداریم (فقط map/photo preview جزئی) |
| 10 | **Block publish until approved** | gate سرور: بدون approval → 403 | نداریم |

**ارزش برای tour-ops:** اپراتور مثل redakteur محتوا کار کند — نه فقط «فرم پر کن و بزن».

---

### ۱۴.۳ Workflow و audit (الگوی enterprise BPM)

| # | قابلیت | الگوی صنعت | وضعیت ما |
|---|--------|-----------|----------|
| 11 | **State machine صریح** | DRAFT → IN_REVIEW → APPROVED → PUBLISHED | نداریم (وضعیت تور ساده؛ بدون workflow استپ) |
| 12 | **Immutable audit trail** | هر transition: who/when/from/to + payload diff | `settings` audit داریم؛ **ویزارد/tour field audit نداریم** |
| 13 | **Field-level amend on approve** | approver فقط بعضی فیلدها را عوض می‌کند + log | نداریم |
| 14 | **Parallel approval branches** | چند نقش هم‌زمان (مالی + عملیات) | نداریم |
| 15 | **Idempotency-Key روی create** | submit دوباره = همان تور (نه duplicate) | Legacy clone API داشت؛ Trunk create **ندارد** |
| 16 | **Notification routing** | email/Slack وقتی review لازم است | نداریم |

---

### ۱۴.۴ UX فرم حرفه‌ای (فراتر از §۱۳)

| # | قابلیت | الگوی صنعت | وضعیت ما |
|---|--------|-----------|----------|
| 17 | **Content quality / completion %** | progressbar وزن‌دار از registry (`denaliFieldCompletionWeights`) | domain هست؛ **Web هدر ندارد** (Legacy: `calculateCompletionPercentage`) |
| 18 | **Per-step validation gate** | «بعدی» فقط وقتی استپ valid | Legacy ✅؛ Trunk Next **بدون چک** §۱۳ |
| 19 | **Save draft صریح + Continue later** | دکمه + ایمیل/token امن | نداریم |
| 20 | **Cross-device resume** | draft به user وابسته (نه فقط session) | نداریم |
| 21 | **Conflict UI** | «نسخه دیگری ذخیره شده» + merge | Legacy draft-engine؛ Trunk ندارد |
| 22 | **Keyboard shortcuts** | jump step، save، focus next error | نداریم |
| 23 | **Stable layout on conditional** | جلوگیری از jump وقتی فیلد ظاهر می‌شود | تأیید نشده؛ compositeها ممکن است layout shift دهند |
| 24 | **Wizard analytics** | drop-off per step، median time | نداریم |
| 25 | **Abandonment recovery** | یادآوری «پیش‌نویس ناتمام» | نداریم |
| 26 | **Encrypted draft at rest** | PII در پیش‌نویس (کد ملی، تماس) | نداریم |
| 27 | **Optimistic submit + rollback** | UI فوری + undo اگر API fail | نداریم |

---

### ۱۴.۵ Tour-operator / محصول (الگوی Beebus، TourTools، TripBuilder)

| # | قابلیت | الگوی صنعت | وضعیت ما |
|---|--------|-----------|----------|
| 28 | **Duplicate برای فصل/منطقه** | کپی + bulk edit تاریخ/قیمت | دکمه duplicate §۱۳ **بدون hydrate** |
| 29 | **Preset / product factory** | تمپلیت تور از catalog تنظیمات | `tour_presets` CRUD هست؛ **اتصال ویزارد نیست** §۲ |
| 30 | **Multi-departure از یک ویزارد** | چند تاریخ خروج از یک تعریف | نداریم |
| 31 | **Margin / pricing guard** | هشدار حاشیه قبل از publish | نداریم |
| 32 | **Proposal PDF / share link** | خروجی برای مشتری B2B | نداریم |
| 33 | **Supplier/component inventory** | پرواز/هتل/فعالیت در package | خارج از scope فعلی؛ **ویزارد تک‌محصول تور** |
| 34 | **Operational checklist پس از publish** | manifest، تجهیز، pre-departure | نداریم (bookings/finance جدا) |
| 35 | **Translation module** | چندزبانه محتوای تور در ویزارد | i18n UI داریم؛ **محتوای چند locale در یک تور** نداریم |
| 36 | **Channel publish** | publish به OTA/B2B از یک داشبورد | نداریم |

---

### ۱۴.۶ Builder / platform (برای تمپلیت و rules — حرفه‌ای‌تر)

| # | قابلیت | الگوی صنعت | وضعیت ما |
|---|--------|-----------|----------|
| 37 | **Visual rule debugger** | «اگر category=X چه فیلدی دیده می‌شود؟» | نداریم |
| 38 | **Section-groups در builder** | گروه‌بندی منطقی فیلدها | §۸ — checkbox تخت |
| 39 | **Field-level RBAC در runtime** | member فقط بعضی فیلدها را edit کند | CASL کل ویزارد؛ **نه per-field** |
| 40 | **Template versioning + migrate** | upgrade تمپلیت بدون شکستن draft | `fieldRulesOverlay` noop §۱۲ |
| 41 | **Simulation mode** | اپراتور بدون save واقعی تست کند | نداریم |
| 42 | **Import/export canonical** | JSON/CSV برای مهاجرت | نداریم |
| 43 | **AI assist** (2025+ trend) | prefill توضیحات، SEO، خلاصه برنامه | نداریم |
| 44 | **Duplicate detection** | «تور مشابه از قبل وجود دارد» | نداریم |

---

### ۱۴.۷ آنچه در domain/package هست ولی در Web نیست (low-hanging برای حرفه‌ای‌تر شدن)

| دارایی Trunk | استفاده احتمالی enterprise |
|--------------|---------------------------|
| `denaliFieldCompletionWeights` | هدر «کیفیت محتوا %» + gate نرم publish |
| `evaluateFormFieldRule` / publish readiness (domain) | review step + لینک خطا (§۱۳) |
| `settings` audit trail | الگو برای **tour wizard change log** |
| `rowVersion` + optimistic locking API | edit wizard با conflict banner |
| `workspace-plugin` validation pipeline | یکسان‌سازی client/server قبل از submit |
| MinIO `wizard-drafts/` | پایه media؛ نه جایگزین draft فرم |

---

### ۱۴.۸ اولویت‌بندی پیشنهادی (فقط شکاف — بدون فازبندی اجرا)

**Tier A — پایه حرفه‌ای (بیشترین حس «محصول جدی»):**
1. draft آنلاین + resume (§۱۳)  
2. clone/preset hydrate (§۱۳ + §۲)  
3. review + validation + focus field (§۱۳)  
4. completion % + publish readiness UI (§۱۴.۴ #17 + §۵)  

**Tier B — تمایز enterprise:**
5. scheduled publish + preview عمومی (#۲، #۹)  
6. version compare/rollback (#۳، #۴)  
7. wizard field audit (#۱۲)  
8. idempotent create (#۱۵)  

**Tier C — tour-ops / scale:**
9. multi-departure (#۳۰)  
10. proposal PDF (#۳۲)  
11. analytics abandonment (#۲۴)  
12. collaborative review (#۵، #۶)  

---

### ۱۴.۹ منابع خارجی (برای ردیابی)

| حوزه | مرجع |
|------|------|
| Editorial / schedule | [Capell Publishing Studio](https://docs.capell.app/packages/publishing-studio/) |
| Approval + audit SaaS | [Velt — Review States](https://velt.dev/blog/adding-review-states-to-your-app) |
| Workflow + immutable history | [FlowCore](https://github.com/matfurrier/flowcoreapp) · [Palmyra approval](https://www.palmyra.dev/docs/tutorial/backend/advanced/approval-workflow/) |
| Multi-step draft best practices | [Webeyez — Laravel multi-step](https://webeyez.com/insights/guides/laravel-multi-step-form-guide) |
| Form enterprise (logic + RBAC) | [Exsited Forms Logic](https://www.exsited.com/forms-logic) |
| Tour-operator patterns | [Beebus tour operators](https://beebus.com/solutions/tour-operators) · [Altexsoft tour software overview](https://www.altexsoft.com/blog/tour-operator-software/) |
| Completion / analytics forms | [Agents for Forms — conditional logic guide](https://agentsforforms.com/blog/a-practical-guide-to-form-builder-with-conditional-logic/) |


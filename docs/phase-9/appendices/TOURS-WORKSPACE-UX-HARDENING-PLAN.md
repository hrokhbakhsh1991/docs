# TOURS-WORKSPACE-UX-HARDENING — پلن فازبندی پیاده‌سازی

```yaml
doc_id: TOURS-WORKSPACE-UX-HARDENING
version: "2026-08-12-v4"
status: COMPLETE
kickoff: "دو لیست شروع — isolation (I-01…I-10) + wave-1 execution checklist"
architect_ack: "2026-08-12 — implement wave-1 from chat"
closed: "2026-08-12 — H0–H5 + H4b + I-06/I-07/I-08 + shared finance cache"
subphase: "9.3+ / post-COMPLETE"
authority: >
  TOURS-WORKSPACE-COMPLETE.md · TOURS-WORKSPACE-UX-CRITIQUE.md ·
  BOOKINGS-OPS-UX.md · FINANCE-OPS-UX.md
prerequisite: Tour Workspace phases 0–5 Done (COMPLETE §10)
mode: doc-first then code; no full gate without Architect YES
```

> **هدف:** Workspace را از «lobby + wiring کامل» به **خانهٔ قابل‌اعتماد و عمل‌پذیر یک تور** نزدیک کنیم — بدون شکستن قفل‌های TW-C (Edit≠ops، بدون Finance hub دوم، بدون assignment خودرو).

---

## دو لیست شروع (Architect kickoff)

### لیست ۱ — مرز ایزولاسیون (host vs Denali)

قفل پیشنهادی تک‌لید؛ تا ACK نشود کد بزرگ موج ۱ روی فرض اشتباه نرود.

| # | مورد | الان | باید بماند / بشود | Owner لایه |
| - | ---- | ---- | ----------------- | ---------- |
| I-01 | UI Tour Workspace در `apps/web` (نه `packages/workspaces/denali`) | host-owned | **قفل:** host surface مشترک tours؛ دنالی فقط capability می‌دهد | `apps/web` |
| I-02 | روشن‌شدن تب Finance | `financeNav` / `ensureFinanceRouteAllowed(pluginId)` | **قفل:** بدون hardcode `pluginId === "denali"` | web + denali plugin capability |
| I-03 | Ops approve/reject chrome | `RegistrationOps` manifest via `pluginId` | **قفل:** همان مسیر capability | web + denali manifest |
| I-04 | لیبل transport / wizard | `pluginId` + workspace-sdk translator | **قفل:** بدون import مستقیم پکیج denali | web + sdk |
| I-05 | `tourId` روی outstanding / collections / receipts | finance-core / http additive | **قفل:** پلتفرمی بماند؛ fork دنالی ممنوع | finance-core / finance-http |
| I-06 | دانش canonical path (`details.tripDetails.transportModes`) داخل `features/tours` | **DONE** — thin adapter `tour-canonical-transport-modes.ts` (single SoT path; no denali package import) | **قفل:** adapter/manifest host-side؛ بدون import پکیج denali | `features/tours` |
| I-07 | Extract `bookings-command-center-shell` از god-file | **DONE** — `features/bookings/bookings-command-center-shell.tsx`; app route re-exports | **قفل موج تمیزی:** extract نازک props→features؛ flag-hell بیشتر ممنوع | `features/bookings` |
| I-08 | Import `app/bookings` از registrations client | **DONE** — registrations + waitlist import shell from `@/features/bookings/...` | **قفل:** فقط از `features/bookings` | web layering |
| I-09 | Workspace برای Urban/starter | همان routeها اگر tours داشته باشند | **قفل محصول:** IA مشترک؛ Finance فقط اگر `financeNav` | product |
| I-10 | Vehicle assignment / publish در Workspace / Finance hub دوم | out of scope | **قفل:** خارج می‌ماند | — |

**خلاصه I:** ایزولاسیون = **capability-gated host**، نه پکیج دنالی. تمیزی = extract shell + ممنوعیت نشت canonical بیشتر.

---

### لیست ۲ — کار اجرایی موج ۱ (اولویت پیاده‌سازی)

ترتیب اجباری؛ تیک بعد از Done هر فاز.

#### H0 — Docs (اول، بدون کد محصول)
- [x] I-01…I-10 را Architect ACK کند (این بخش → `LOCKED`)
- [x] H-01…H-08 را تأیید کند
- [x] COMPLETE: § hardening (KPI source، click targets، `N+`، triad، CTA trim)
- [x] CRITIQUE: map نقد → فاز H*
- [x] UX.md: یک خط drift-fix (Registrations = embed)

#### H1 — Trust + actionable chrome
- [x] Ops counts فقط از list `total` (pending/waitlisted/approved) — نه tourChips
- [x] Fail ≠ نمایش خاموش `0`
- [x] KPI ops/money کلیک‌پذیر → تب متناظر
- [x] Badge روی subnav (count>0)
- [x] `reloadWorkspaceChrome()` برای children
- [x] (تمیزی) extract نازک embed shell → `features/bookings/bookings-command-center-shell` (I-07)
- [x] تست `tours-workspace.spec.ts`

#### H2 — Waitlist
- [x] نمایش ظرفیت از projection
- [x] confirm/هشدار اگر ظرفیت پر
- [x] ستون `paymentStatus`
- [x] لینک جزئیات (workspace یا CC `bookingId`)
- [x] بعد از approve/reject → reload chrome
- [x] تست منطق ظرفیت

#### H3 — Finance + CTA
- [x] Rollup expected / collected / remaining
- [x] Receipts KPI با `hasMore` → `N` یا `N+`
- [x] مسیر اصلی بدون اجباری بودن client-filter outstanding
- [x] CTA trim (یک hub secondary؛ Register/CC تکراری حذف)
- [x] بومی‌سازی status رسید
- [x] تست helpers + i18n fa/en

#### H4 — Shell polish
- [x] عرض یکدست تب‌ها
- [x] Skeleton به‌جای `Suspense fallback={null}`
- [x] RTL فلش برگشت
- [x] بنر نقش غیر admin
- [x] کاهش نویز زیرعنوان

#### خارج موج ۱ (لیست جدا)
- [x] H4b Waitlist = embed `status=waitlisted` (+ capacity strip)
- [x] H5: گروه/شمارش intake + ستون payment (بدون assignment؛ list scalars — بدون N+1)
- [x] H5-T3 additive transport scalars on list (`transportKind` + `personalCarOccupants`; BK-SAFE-01 — no intake blob)
- [x] H5-T4 transport roster uses list scalars (no N+1 hydrate on main path)
- [x] I-06 thin canonical transport-modes adapter in `features/tours`
- [x] I-07 extract `bookings-command-center-shell` (+ I-08 workspace imports from features)
- [x] Shared header↔Finance tab fetch cache (`tour-workspace-finance-fetch-cache`)

---

## 0. تصمیم‌های قفل‌شده برای این موج

| ID | Decision |
| -- | -------- |
| H-01 | Ops KPI فقط از **tour-scoped list totals** (`GET /api/bookings?tourId&status&limit=1` → `total`) — نه `tourChips` summary سراسری |
| H-02 | KPI هدر و badge ساب‌نو **قابل‌کلیک**اند و به تب/فیلتر متناظر می‌روند |
| H-03 | بعد از mutation در Waitlist (و بعداً embed اگر لازم)، KPI هدر **رفرش** می‌شود |
| H-04 | شمارندهٔ رسید با `hasMore` صادق است (`N` یا `N+`) — هرگز `items.length` خام به‌عنوان کل مطلق وقتی صفحه پر است |
| H-05 | Rollup مالی: **expected (`invoiceTotalMinor`) · collected · remaining** هر سه نمایش داده شوند |
| H-06 | CTA فرار: حداکثر **یک** secondary «Open in hub» per سطح (هدر یا تب، نه هر دو Register/CC تکراری) |
| H-07 | Waitlist = Bookings embed with `lockedStatus=waitlisted` + capacity strip (H4b) |
| H-08 | خارج از scope: vehicle assignment، publish در Workspace، Finance hub کامل inline، endpoint summary جدید مگر perf بعداً ثابت کند لازم است |

---

## نقشهٔ فازها

```text
H0 Spec lock (docs)
 → H1 Trust + actionable header/subnav
 → H2 Waitlist parity (capacity + payment + refresh)
 → H3 Finance honesty (rollup triad + receipts hasMore + CTA trim)
 → H4 Shell polish (width, skeleton, RTL, role banner) + optional Waitlist-as-embed
 → H5 Transport wave-2 (group/count/payment column; projection API optional)
```

هر فاز: **docs touch (اگر قرارداد عوض شد) → کد → تست هدفمند → fast-track پیشنهادی (نه اجرای خودکار full gate).**

---

## Phase H0 — Spec lock (فقط docs)

**هدف:** قفل کردن قرارداد UX قبل از PR کد.

### Tasks

| ID | Task | Artifact | Done when |
| -- | ---- | -------- | --------- |
| H0-T1 | این سند را `status: PLANNED` نگه دار؛ جدول H-01…H-08 را با Architect تأیید کن | این فایل | Architect ACK در chat یا تغییر status → `LOCKED` |
| H0-T2 | بخش «UX hardening» به [`TOURS-WORKSPACE-COMPLETE.md`](./TOURS-WORKSPACE-COMPLETE.md) اضافه کن: KPI source، click targets، receipt `N+`، rollup triad، CTA trim | COMPLETE | § جدید + cross-link |
| H0-T3 | در [`TOURS-WORKSPACE-UX-CRITIQUE.md`](./TOURS-WORKSPACE-UX-CRITIQUE.md) وضعیت موج را `Addressed by HARDENING plan` برای آیتم‌های موج ۱ علامت بزن | CRITIQUE | جدول mapping نقد→فاز |
| H0-T4 | در [`TOURS-WORKSPACE-UX.md`](./TOURS-WORKSPACE-UX.md) یک خط drift-fix: Registrations = embed (نه جدول pending R3) | UX.md | جملهٔ pointer به COMPLETE |

**خروجی:** بدون ambiguity برای H1+.

**Verify:** review docs only — بدون کد.

---

## Phase H1 — Trust + actionable chrome (هدر / ساب‌نو)

**هدف:** اعداد قابل‌اعتماد + مسیر دیدن→عمل بدون حدس تب.

### Tasks

| ID | Task | Files (expected) | Done when |
| -- | ---- | ---------------- | --------- |
| H1-T1 | helper یکدست: `fetchTourWorkspaceOpsCounts(tourId)` → `{ pending, waitlisted, approved }` فقط از list `total` با `status=pending|waitlisted|approved` | `tour-workspace-header-logic.ts` (+ spec) | unit: سه query shape + parse total |
| H1-T2 | حذف وابستگی KPI pending به `resolveTourChipPendingCount` / summary chips در layout | `tour-workspace-layout-client.tsx` | دیگر `/api/bookings/summary` برای pending workspace لازم نیست (مگر بعداً برای چیز دیگر) |
| H1-T3 | حالت خطا vs صفر: اگر fetch fail → UI error/degraded، نه `0` خاموش | layout + i18n `tours.workspace.errors` | تست منطق یا assert در helper |
| H1-T4 | KPI ops کلیک‌پذیر: pending→registrations (اختیاری preset filter)، waitlisted→`/workspace/waitlist`، approved→transport یا registrations با status approved (در COMPLETE قفل شود — **پیشنهاد پیش‌فرض:** approved → transport) | layout + COMPLETE H0 | لینک/دکمه + test id |
| H1-T5 | Money KPI کلیک‌پذیر → `/workspace/finance` | layout | test id |
| H1-T6 | Badge شمارنده روی subnav (pending/waitlist/receipts حداقل) | `tour-workspace-logic.ts` types + layout nav render + i18n | badge فقط وقتی count>0 یا همیشه با ۰ — در H0 قفل: **نشان بده وقتی >0** |
| H1-T7 | API رفرش هدر: `reloadWorkspaceChrome()` قابل صدا از children (context ساده یا callback prop از layout) | layout + context کوچک در `features/tours/` | Waitlist در H2 وصل می‌شود |
| H1-T8 | تست: `tours-workspace.spec.ts` — ops query builders، click href helpers، failure≠0 policy | `apps/web/test/tours-workspace.spec.ts` | سبز |

**Non-goals H1:** تغییر embed CC؛ Waitlist capacity؛ Finance rollup triad.

**Verify (پیشنهادی):**  
`cd apps/web && node --import tsx --test test/tours-workspace.spec.ts`

---

## Phase H2 — Waitlist parity (ظرفیت + زمینه + رفرش)

**هدف:** approve از Waitlist دیگر «POST کور» نباشد.

### Tasks

| ID | Task | Files | Done when |
| -- | ---- | ----- | --------- |
| H2-T1 | نمایش باقیمانده ظرفیت در هدر کارت Waitlist (`accepted/capacity` یا open) از tour projection — fetch تور یا prop از parent | `tour-workspace-waitlist-client.tsx` | متن ظرفیت可见 |
| H2-T2 | قبل از approve: اگر capacity محدود و `accepted >= capacity` → confirm یا block با پیام (قفل H0: **confirm با هشدار** نه silent) | waitlist client + i18n | مسیر overbook آگاهانه |
| H2-T3 | ستون `paymentStatus` در جدول (reuse label bookings اگر هست) | waitlist + i18n table | ستون در DOM/test id |
| H2-T4 | لینک/دکمه «باز کردن در ثبت‌نام‌ها» یا deep focus: `/tours/{id}/workspace` با query داخلی اگر پشتیبانی شد؛ در غیر این صورت لینک به CC `bookingId` | waitlist | حداقل یک مسیر جزئیات |
| H2-T5 | پس از approve/reject موفق → صدا زدن `reloadWorkspaceChrome()` از H1-T7 | waitlist + context | KPI هدر عوض می‌شود بدون F5 |
| H2-T6 | هم‌تراز ایمنی: disable دوکلید همزمان؛ پیام خطای approve واضح (نه فقط HTTP code خام اگر map دارید) | waitlist | UX پایدار |
| H2-T7 | تست منطق ظرفیت + i18n keys؛ در صورت امکان تست خالص helper `canApproveAgainstCapacity` | `tour-workspace-waitlist-logic.ts` + spec | سبز |

**Non-goals H2:** bulk approve waitlist؛ جایگزینی کامل تب با embed (→ H4b).

**Verify:** tours-workspace spec + بازرسی دستی approve روی تور با ظرفیت پر.

---

## Phase H3 — Finance honesty + CTA trim

**هدف:** تب/هدر مالی قابل‌اعتماد و کمتر «فرار به hub».

### Tasks

| ID | Task | Files | Done when |
| -- | ---- | ----- | --------- |
| H3-T1 | Rollup UI: سه متریک expected / collected / remaining از `pickTourCollectionRollup` | `tour-workspace-finance-client.tsx` + i18n | هر سه label |
| H3-T2 | هدر money: همان triad مختصر یا remaining + لینک؛ receipts با `hasMore` → نمایش `formatCountMaybeMore(n, hasMore)` | layout + finance helper | unit helper |
| H3-T3 | helper `formatCountMaybeMore` / `readPendingReceiptsKpi` مشترک هدر و تب | `tour-workspace-finance-logic.ts` | spec |
| H3-T4 | وقتی `withFinanceTourQuery` زده شده، **بردار** `filterTourOutstandingRows` از مسیر اصلی (یا فقط debug assert) تا دوباره به فیلتر client وابسته نشویم | finance client | کد مسیر اصلی بدون filter اجباری |
| H3-T5 | CTA trim: در تب Finance یک دکمهٔ ثانویه «Open Finance hub»؛ payments/receipts به‌صورت لینک متنی زیر صف یا یک منوی «More» — نه سه outline هم‌وزن | finance client | visual hierarchy |
| H3-T6 | هدر Workspace: حذف تکرار — Register فقط در یک جا (پیشنهاد: هدر نگه؛ از پنل registrations بردار **یا** برعکس — قفل H0: **هدر نگه، پنل registrations فقط اگر canRegister و empty**) | registrations client + layout | یک Register primary |
| H3-T7 | Open Command Center: فقط یک secondary در هدر؛ از پنل registrations حذف یا به لینک متنی «Advanced» تقلیل | registrations client | مطابق H-06 |
| H3-T8 | بومی‌سازی badge وضعیت رسید (map به `finance`/`tours.workspace.finance` status labels) | finance client + messages | بدون raw enum در UI fa |
| H3-T9 | تست finance helpers + i18n keys en/fa | spec + messages | سبز |

**Non-goals H3:** embed کامل `finance-receipts-panel` review UI (موج اختیاری بعداً)؛ payments list inline.

**Verify:** tours-workspace spec؛ بازرسی fa labels.

---

## Phase H4 — Shell polish (+ اختیاری Waitlist embed)

**هدف:** یک محصول به‌نظر برسد؛ نقش و اسکلتون درست.

### Tasks (الزامی)

| ID | Task | Files | Done when |
| -- | ---- | ----- | --------- |
| H4-T1 | عرض یکدست: همه تب‌ها همان max-width strategy (پیشنهاد: `max-w-none` برای همه وقتی ops؛ یا `max-w-6xl` مشترک — قفل H0) | layout | پرش layout بین تب‌ها کم |
| H4-T2 | `Suspense` fallback Skeleton برای registrations embed | registrations client | نه `null` |
| H4-T3 | RTL: آیکون برگشت به لیست تورها | layout | fa درست حس می‌شود |
| H4-T4 | بنر نقش غیر admin/owner: «فقط مشاهده / اکشن محدود» | layout یا per-tab | i18n |
| H4-T5 | کاهش نویز زیرعنوان «Tour workspace» زیر عنوان تور (کوتاه‌تر یا حذف) | layout + i18n | خلوت‌تر |
| H4-T6 | تست‌های regression chrome + snapshot test ids | spec | سبز |

### Tasks (اختیاری H4b — Architect YES جدا)

| ID | Task | Notes |
| -- | ---- | ----- |
| H4b-T1 | Waitlist tab محتوا = `BookingsPageClient` با `lockedTourId` + initial `status=waitlisted` + `embedded` | جایگزین جدول thin |
| H4b-T2 | نگه داشتن route `/workspace/waitlist` برای deep link | فقط swap client |
| H4b-T3 | حذف duplicate approve path جدول | بعد از embed |

**Verify H4:** tours-workspace spec.  
**Verify H4b:** دستی + spec وضعیت waitlisted preset.

---

## Phase H5 — Transport wave-2 (بعد از موج ۱)

**هدف:** تب حمل برای روز حرکت مفیدتر — هنوز بدون assignment.

### Tasks

| ID | Task | Files / API | Done when |
| -- | ---- | ----------- | --------- |
| H5-T1 | گروه یا شمارش per `transportMode` از intake | transport logic + UI | شمارنده‌ها بالای جدول |
| H5-T2 | ستون `paymentStatus` کنار intake | transport client | دیده می‌شود |
| H5-T3 | additive list scalars `transportKind` + `personalCarOccupants` روی `GET /bookings` (نه blob `registrationIntake` — BK-SAFE-01) | `apps/api` bookings + contracts + OpenAPI + **docs first** | list بدون N+1 detail |
| H5-T4 | حذف `hydrateTransportRosterIntake` از مسیر اصلی Workspace transport | transport client | یک fetch list |
| H5-T5 | تست transport grouping helpers | spec | سبز |

**Non-goals H5:** vehicle/driver assignment؛ print/PDF رسمی (می‌تواند H5+ جدا باشد).

---

## ترتیب PR پیشنهادی

| PR | Phase | عنوان پیشنهادی |
| -- | ----- | -------------- |
| 1 | H0 | docs: Workspace UX hardening contract |
| 2 | H1 | fix(web): trusted actionable workspace KPIs |
| 3 | H2 | fix(web): waitlist capacity + payment + chrome refresh |
| 4 | H3 | fix(web): finance rollup honesty + CTA trim |
| 5 | H4 | fix(web): workspace shell polish |
| 6 | H4b | feat(web): waitlist as bookings embed (optional) |
| 7 | H5 | feat: transport grouping (+ optional API intake on list) |

هر PR کد: جملهٔ `Updating documentation for this change` + لینک COMPLETE/HARDENING؛ verification با تست هدفمند / `pre-commit:fast` — **نه** `phase-*:gate` بدون YES.

---

## ماتریس نقد → فاز

| نقد (خلاصه) | فاز |
| ------------ | --- |
| pending از chip / ۰ کاذب / منابع ناهمگون | H1 |
| KPI غیرقابل‌کلیک / بدون badge | H1 |
| KPI stale بعد از mutation | H1+H2 |
| Waitlist بدون ظرفیت/payment | H2 |
| مسیر دوگانه Waitlist vs embed | H2 سپس H4b اختیاری |
| receipts کم‌شماری limit=50 | H3 |
| rollup ناقص / CTA فرار زیاد | H3 |
| عرض / skeleton / RTL / نقش | H4 |
| Transport N+1 / گروه mode | H5 |
| Vehicle assignment / publish / hub دوم | **خارج** |

---

## Definition of Done (موج ۱ = H0…H4 الزامی + تمیزی قفل‌شده)

- [x] H-01…H-07 در UI قابل مشاهده‌اند
- [x] `tours-workspace.spec.ts` سبز
- [x] COMPLETE + این پلن به‌روز و cross-link
- [x] هیچ endpoint جدید اجباری برای موج ۱
- [x] H4b / H5 (شامل H5-T3/T4 scalars) + I-06/I-07/I-08 + shared finance cache بسته شدند

---

## خارج از پلن (عمداً)

- تخصیص وسیله/راننده
- publish/unpublish داخل Workspace
- duplicate کامل `/finance` داخل تب
- realtime websocket برای KPI
- endpoint جدید `GET /bookings/summary?tourId=` مگر بعداً perf

---

## Cross-refs

- [`TOURS-WORKSPACE-COMPLETE.md`](./TOURS-WORKSPACE-COMPLETE.md)
- [`TOURS-WORKSPACE-UX-CRITIQUE.md`](./TOURS-WORKSPACE-UX-CRITIQUE.md)
- [`TOURS-WORKSPACE-UX.md`](./TOURS-WORKSPACE-UX.md)
- [`BOOKINGS-OPS-UX.md`](./BOOKINGS-OPS-UX.md)
- [`FINANCE-OPS-UX.md`](./FINANCE-OPS-UX.md)

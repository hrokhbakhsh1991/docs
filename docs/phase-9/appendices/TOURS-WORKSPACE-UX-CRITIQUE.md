# TOURS-WORKSPACE-UX-CRITIQUE — نقد نقادانهٔ Tour Workspace (Denali)

```yaml
doc_id: TOURS-WORKSPACE-UX-CRITIQUE
version: "2026-08-12-v2"
status: ADDRESSED
subphase: "9.3+"
surfaces:
  - (app)/tours/[id]/workspace
  - …/waitlist · …/transport · …/finance
authority: >
  TOURS-WORKSPACE-COMPLETE.md · TOURS-WORKSPACE-UX.md ·
  BOOKINGS-OPS-UX.md · FINANCE-OPS-UX.md
method: >
  Static UX audit of shipped shell + tab clients (layout, registrations embed,
  waitlist, transport, finance) against locked IA and operator job-to-be-done.
```

> **Verdict (original audit):** مسیر فنی پلن (فاز ۰–۵) بسته شده بود، ولی تجربهٔ اپراتور هنوز lobby بود.

> **Closure (2026-08-12):** موج [`TOURS-WORKSPACE-UX-HARDENING-PLAN.md`](./TOURS-WORKSPACE-UX-HARDENING-PLAN.md) با status **`COMPLETE`** بسته شد (H0–H5 + H4b + I-06/I-07/I-08 + shared finance cache). یافته‌های P0/P1 موج سخت‌سازی **Addressed**؛ P1-8 overview میانی و vehicle assignment عمداً خارج از scope می‌مانند.

---

## 1. Job-to-be-done (معیار نقد)

اپراتور دنالی وقتی Workspace را باز می‌کند باید در یک نگاه بفهمد:

1. آیا ظرفیت/صف تأیید سالم است؟
2. چه کسی را باید همین الان تأیید/رد کند؟
3. پول این تور کجاست (بدهی / رسید معوق)؟
4. حمل‌ونقل مهمان‌ها برای روز حرکت آماده است؟

و **بدون ترک context** بتواند عمل کند.

نقد زیر بر همین چهار سؤال است، نه روی «آیا API wired است».

---

## 2. خلاصهٔ شدت

| Severity | Count | معنی |
| -------- | ----- | ---- |
| **P0 — جریان شکسته / گمراه‌کننده** | 4 | اپراتور اشتباه می‌فهمد یا کار اصلی را نمی‌تواند کامل کند |
| **P1 — اصطکاک جدی** | 8 | کار می‌کند ولی کند، تکراری، یا دوگانه است |
| **P2 — polish / بدهی UX** | 6 | کیفیت، دسترس‌پذیری، یکپارچگی بصری |

---

## 3. یافته‌های P0

### P0-1 — سه پارادایم UI در یک «خانه»

| تب | الگوی واقعی |
| -- | ----------- |
| Registrations | Embed کامل Bookings Command Center |
| Waitlist / Transport | جدول thin + اکشن محدود |
| Finance | کارت rollup + لیست لینک‌دار (بدون mutation پول) |

**مشکل:** اپراتور برای یک تور سه مدل ذهنی یاد می‌گیرد. Waitlist شبیه «نسخهٔ ضعیف Registrations» است؛ Finance شبیه «داشبورد خلاصهٔ Finance hub». حس Workspace = ترکیب، نه ترکیبِ یکپارچه.

**اثر:** اعتماد به تب پیش‌فرض؛ فرار به `/bookings` و `/finance` حتی وقتی داخل Workspace هستند.

---

### P0-2 — Workspace هنوز lobby خروج است، نه home

CTAهای فرار در یک viewport:

- Header: Edit · Register · **Open Command Center** · **Open Finance**
- Registrations: Register دوباره + **Open Command Center** دوباره
- Finance: Open payments hub · Open receipts queue · Open full Finance hub
- Empty waitlist/transport: لینک به CC

**مشکل:** پیام ضمنی محصول: «اینجا کامل نیست؛ برو جای اصلی.» این با هدف COMPLETE («یک tour home») در تضاد است.

**اثر:** عمق استفاده از Workspace پایین می‌ماند؛ embed Registrations ارزشش را از دست می‌دهد چون chrome اطراف فریاد می‌زند «خارج شو».

---

### P0-3 — KPI هدر غیرقابل‌عمل (look-only)

شمارنده‌های pending / waitlisted / approved و money (balance due / pending receipts) **کلیک نمی‌شوند**، فیلتر تب را عوض نمی‌کنند، و بعد از approve/reject روی waitlist **رفرش نمی‌شوند**.

**مشکل:** «تصمیم در یک نگاه» بدون مسیر عمل = تزیین. اپراتور عدد را می‌بیند، بعد باید دستی subnav را حدس بزند.

**اثر:** حلقهٔ تصمیم شکسته: دیدن → عمل → تأیید نتیجه.

---

### P0-4 — Waitlist بدون ظرفیت و بدون زمینهٔ پول/جزئیات

COMPLETE صریحاً می‌گوید باقیماندهٔ ظرفیت هنگام approve وقتی projection هست نشان داده شود — در کلاینت فعلی approve یک `POST` خام است؛ هیچ تأیید ظرفیت، هیچ payment status، هیچ inspection/drill-in.

**مشکل:** حساس‌ترین عمل ops (پر کردن صندلی از waitlist) در ضعیف‌ترین سطح UX انجام می‌شود، در حالی که همان عمل داخل Registrations embed با CC غنی‌تر است.

**اثر:** ریسک overbook ادراکی + اجبار به پرش بین تب‌ها برای «دیدن جزئیات مهمان».

---

## 4. یافته‌های P1

### P1-1 — ناسازگاری دادهٔ KPIها

- `pending` از `/api/bookings/summary` + chip تور
- `waitlisted` / `approved` از list `total` جدا
- fallback `approved` به `projection.acceptedCount`
- خطاها اغلب به `0` می‌رسند (ساکت)

اپراتور نمی‌فهمد عدد «صفر واقعی» است یا «fetch شکست».

---

### P1-2 — دوباره‌کاری fetch مالی (هدر + تب Finance)

Layout برای money KPIs همان `tour-collections` + `pending receipts` را می‌گیرد که تب Finance دوباره می‌گیرد. علاوه بر هزینه:

- لحظه‌ای ناهمگام بودن اعداد بین هدر و تب
- حس «دو منبع حقیقت» برای یک تور

---

### P1-3 — Finance tab نیمه‌کاره نسبت به شغل پول

طبق COMPLETE: rollup باید expected / collected / balance due را پوشش دهد. UI الان عمدتاً **balance due** + تعداد outstanding/receipts است؛ collected/expected در کارت‌ها نیست.

صف‌ها:

- Outstanding → فقط لینک commercial meaning (خوب)
- Receipts → **بدون review/approve در محل** (escape به hub)
- Payments → **فقط deep-link** (هیچ صف tour-scoped در تب نیست)

**جمع:** تب Finance بیشتر «آینهٔ read» است تا ایستگاه کار پول تور.

---

### P1-4 — Transport بن‌بست عملیاتی

- فقط read-only
- assignment عمداً deferred (قابل قبول به‌عنوان scope)
- ولی حتی **ویرایش intake** / گروه‌بندی بر اساس mode / شمارش per-mode نیست
- hydrate N+1 → roster دیر پر می‌شود؛ ستون intake ممکن است لحظه‌ای خالی/`—` باشد

برای روز حرکت، تب «حمل» باید حداقل «چه کسی با چه وسیله‌ای» را سریع و قابل چاپ/فیلتر کند — الان جدول ساده است.

---

### P1-5 — Subnav بدون badge

تب‌ها شمارنده ندارند. اپراتور باید به هدر نگاه کند، بعد تب را انتخاب کند. الگوی رایج ops (badge روی Waitlist / Finance) غایب است.

---

### P1-6 — عرض ناهمگون

Registrations `max-w-none`؛ بقیه `max-w-5xl`. پرش بین تب‌ها layout می‌پرد؛ CC عریض در کنار جداول باریک حس «دو محصول» می‌دهد.

---

### P1-7 — تکرار Register CTA + نقش‌ها مبهم

Register در هدر و دوباره در پنل Registrations. نقش غیر admin/owner: Register مخفی است ولی Workspace باز است؛ راهنمای خالی برای «چه کاری می‌توانم بکنم؟» ضعیف است.

---

### P1-8 — بدون overview / landing سبک

ورود پیش‌فرض = embed CC کامل. برای «سلامت تور در ۱۰ ثانیه» باید از روی هدر + اسکرول CC عبور کرد. هیچ سطح خلاصهٔ میانی (مثلاً ۳ کارت عمل‌فوری: pending approvals · waitlist · receipts) بالای تب‌ها نیست — هدر نزدیک است ولی غیرقابل‌کلیک (P0-3).

---

## 5. یافته‌های P2

| ID | موضوع |
| -- | ----- |
| P2-1 | `Suspense fallback={null}` روی embed → فلاش خالی |
| P2-2 | `ArrowLeft` ثابت؛ در RTL فارسی جهت برگشت ممکن است غلط حس شود |
| P2-3 | وضعیت publish فقط badge؛ publish/unpublish از Workspace نیست (باید Edit) — برای ops روزانه اصطکاک کوچک |
| P2-4 | Empty finance فقط متن؛ پیشنهاد عمل (مثلاً «ثبت پرداخت دستی در hub») کم‌رنگ |
| P2-5 | Drift سندی: `TOURS-WORKSPACE-UX.md` هنوز زبان R3 «جدول pending» دارد؛ COMPLETE می‌گوید embed — منبع حقیقت دوگانه برای خواننده |
| P2-6 | Receipts در finance status خام انگلیسی/کدگونه (`Badge` با `row.status`) بدون برچسب انسانی یکدست با Finance hub |

---

## 6. نقشهٔ جریان فعلی (مشکل‌محور)

```text
List → Workspace
         ├─ Header KPIs (read-only, ممکن است stale)
         ├─ CTA escape → Bookings CC / Finance hub / Edit / Register
         ├─ Registrations → full CC embed (+ escape دوباره)
         ├─ Waitlist → thin approve/reject (بدون ظرفیت/جزئیات)
         ├─ Transport → read-only (+ کندی hydrate)
         └─ Finance → read queues (+ escape به hub برای mutation)
```

حلقهٔ ایده‌آل COMPLETE:

```text
List → Workspace (act in place) → Case/detail فقط وقتی لازم
```

---

## 7. اولویت پیشنهادی رفع (اگر پلن ادامه ساخته شود)

نه commitment اجرا — فقط ترتیب ارزش UX:

1. **قابل‌عمل کردن KPI + badge روی subnav** + رفرش بعد از mutation (بستن P0-3 / P1-5)
2. **کاهش escape CTA**؛ یک secondary «Open in hub» کافی است (P0-2)
3. **Waitlist را به سطح CC نزدیک کن** یا همان embed با `status=waitlisted` قفل‌شده (P0-4 / P0-1)
4. **Finance:** triad rollup + review رسید در محل یا حداقل deep-link مستقیم به صف review همان registration (P1-3)
5. **Transport:** projection intake روی list + گروه/شمارش per mode (P1-4)
6. یکسان‌سازی عرض و اسکلتون (P1-6 / P2-1)

---

## 8. آنچه خوب است (برای تعادل نقد)

- قفل IA درست است: Edit ≠ ops؛ Finance case per registration؛ finance tab capability-gated
- Registrations embed با `lockedTourId` / `embedded` / `opsActions` جهت درستی دارد
- Deep-link دوطرفه Workspace ↔ CC (وقتی tourId هست) پایه‌گذاری شده
- Server `tourId` روی outstanding/collections بعد از hardening قابل اتکاتر از فیلتر client روی `limit=50` است
- i18n fa/en برای shell و finance tab وجود دارد

این‌ها foundation هستند؛ نقد بالا روی **کمال تجربه** است نه انکار پیشرفت.

---

## 9. Cross-refs

- Spec کامل: [`TOURS-WORKSPACE-COMPLETE.md`](./TOURS-WORKSPACE-COMPLETE.md)
- Baseline R3: [`TOURS-WORKSPACE-UX.md`](./TOURS-WORKSPACE-UX.md)
- Bookings: [`BOOKINGS-OPS-UX.md`](./BOOKINGS-OPS-UX.md)
- Finance: [`FINANCE-OPS-UX.md`](./FINANCE-OPS-UX.md)

---

## 10. وضعیت نسبت به پلن فازبندی

| لایه | وضعیت |
| ---- | ----- |
| Delivery phases 0–5 | Done (فنی) |
| UX hardening H0–H5 / H4b / I-06…I-08 | **COMPLETE** — [`TOURS-WORKSPACE-UX-HARDENING-PLAN.md`](./TOURS-WORKSPACE-UX-HARDENING-PLAN.md) |
| UX critique (این سند) | **ADDRESSED** — P0/P1 موج سخت‌سازی بسته؛ P1-8 overview میانی اختیاری آینده |
| Deferred محصولی | Vehicle/driver assignment · publish در Workspace · Finance hub دوم (عمدی / H-08) |

### ماتریس نقد → بسته شدن

| نقد | فاز | وضعیت |
| ---- | ---- | ------ |
| P0-3 / P1-1 / P1-5 KPI + badge | H1 | Done |
| P0-2 / P1-7 CTA فرار | H3 | Done |
| P0-4 Waitlist | H2 + H4b | Done |
| P1-2 duplicate finance fetch | shared cache | Done |
| P1-3 finance triad / receipts honesty | H3 | Done (review inline = non-goal) |
| P1-4 transport N+1 / counts | H5-T3/T4 | Done |
| P1-6 / P2-1…P2-2 / P2-6 shell | H4 | Done |
| P2-5 doc drift | H0 + COMPLETE/UX | Done |
| P1-8 overview landing | — | Deferred (هدر KPI کافی اعلام شد) |
| Vehicle assignment | — | Out of scope |

# Local purchase-flow evidence — 2026-10-03

این فایل فقط شواهد اجرای واقعی مرورگر در محیط Local است. تست source یا fixture قدیمی به‌تنهایی closure محسوب نمی‌شود.

## Runtime

- Source HEAD: `0fa60d472964ad24ce70549c24762718e9684944`
- Branch: `codex/local-staging-fixes-pr`
- API: `http://127.0.0.1:3001/health` → `{"status":"ok","service":"@apps/api","checks":{"database":{"status":"ok"}}}`
- Admin: `http://admin.denali.localhost:3000`
- Portal: `http://denali.portal.localhost:3003`
- QA identity: `+15550001001` / OTP `1234`
- Dirty file خارج از این تست و دست‌نخورده باقی ماند: `docs/phase-19/architecture-truth-drift-report.json`

## Matrix

| سناریو | Fixture / شناسه | نتیجه | شواهد |
|---|---|---|---|
| ثبت‌نام Portal در تور پولی با approval خودکار | Tour `00000000-0000-4000-8000-000000000226`; registration `543e7b1f-51d5-42a5-b5fd-14d87f250456` | **PASS** | فرم Portal پیام «درخواست ثبت شد» نشان داد؛ POST ثبت‌نام با status `201` ثبت شد. |
| Portal List بعد از ثبت‌نام پولی | همان registration | **PASS** | Portal List رکورد را با متن «تأیید شده برای خودم، برای نهایی‌شدن پرداخت لازم است» و مبلغ `۲٬۵۰۰٬۰۰۰ تومان` نشان داد. |
| Admin operational list برای همان رکورد | همان registration | **PASS** | Admin رکورد را با `تأییدشده` و `پرداخت‌نشده (رزرو)`، ظرفیت `۲/۱۰۰` و همان شناسهٔ کوتاه‌شده نشان داد. |
| Admin detail و تفکیک وضعیت مالی | همان registration | **PASS** | متن «ثبت‌نام تأیید شده — پیگیری پرداخت در تب «پیگیری پرداخت»» دیده شد؛ registration state و payment state جدا بودند. |
| تب Finance برای همان رکورد | همان registration | **PASS** | Finance رکورد را با ماندهٔ `۲٬۵۰۰٬۰۰۰ تومان` و وضعیت `پرداخت‌نشده` نشان داد؛ قبل از mutation یک آیتم در «منتظر پرداخت» دیده شد. |
| نهایی‌سازی حضور با پرداخت باز | همان registration | **PASS** | دکمهٔ Admin نیازمند تأیید دوم بود؛ سپس `POST /api/bookings/543e7b1f-51d5-42a5-b5fd-14d87f250456/finalize-with-open-payment` با HTTP `200` انجام شد. «نهایی‌شده برای حضور» از ۱ به ۲ رسید، دکمه‌های نهایی‌سازی حذف شدند و بدهی/مهلت پرداخت باقی ماند. |
| فهرست نهایی قبل از پرداخت | همان registration | **PASS** | Admin/AX در تب فهرست نهایی ردیف را با «نهایی؛ پرداخت باز»، «پرداخت‌نشده» و مبلغ `۲٬۵۰۰٬۰۰۰ تومان` نشان داد؛ ردیف در final roster بود. |
| ثبت پرداخت کامل بعد از نهایی‌سازی | همان registration | **PASS** | دکمهٔ `ثبت مبلغ واریزشده` اجرا شد؛ `POST /api/finance/prepayments` با HTTP `201` ثبت شد. پس از reload: «منتظر پرداخت ۰»، «نهایی‌شده برای حضور ۲» و پیام «همه‌چیز برای این تور تسویه است». |
| Portal Detail بعد از پرداخت | همان registration | **PASS** | Portal با عنوان «سفر شما نهایی شده است»، متن «پرداخت شما تأیید شده»، و labelهای «ثبت‌نام: تأیید شده / رسید: تأیید شده» نمایش داده شد؛ مبلغ قابل‌استرداد نیز نمایش داده شد. |
| Portal Detail برای نهایی‌شده با پرداخت باز | registration `6b0b0656-4d97-4a15-bea3-ad422973db47` | **PASS** | عنوان «ثبت‌نام شما نهایی شده است»؛ متن «پرداخت باقی مانده و همچنان قابل پیگیری است»؛ مانده بدهی `۲٬۵۰۰٬۰۰۰ تومان`؛ فرم ارسال رسید و کد پیگیری فعال؛ `ثبت‌نام: تأیید شده / رسید: ارسال نشده`. |
| ثبت receipt متنی در Portal | registration `6b0b0656-4d97-4a15-bea3-ad422973db47` | **PASS** | متن «پرداخت کامل آزمایشی QA» ثبت شد؛ پس از ارسال، UI به «فیش ارسال شد / منتظر تأیید ادمین» و `رسید: در انتظار بررسی` تغییر کرد؛ finalization و بدهی حفظ شدند. |
| approve receipt در Admin | همان registration | **PASS** | Admin در صف رسیدها رکورد را نشان داد؛ دکمهٔ تأیید اجرا شد و API `PATCH /api/finance/receipts/1a19000d-f6f4-4228-b750-c0cdbec573f9/review` با HTTP `200` برگشت؛ صف به «فیشی در انتظار بررسی نیست» و پیام «تأیید شد — پرداخت‌شده. مانده ۰» تغییر کرد. |
| Portal بعد از approve receipt | همان registration | **PASS** | پس از توقف Admin و اجرای مجدد Portal، detail با «سفر شما نهایی شده است»، «پرداخت شما تأیید شده»، `ثبت‌نام: تأیید شده / رسید: تأیید شده` نمایش داده شد؛ finalization حفظ شد و صفحه دیگر فرم پرداخت نشان نداد. |
| حفظ finalization بعد از پرداخت و خروج از outstanding | همان registration | **PASS** | بعد از پرداخت، Finance خالی و final roster همچنان ۲ بود؛ یعنی بدهی حذف شد ولی نهایی‌بودن حضور حفظ شد. |
| Portal List برای free | registration `f39383e0-d51f-4a26-b8ad-f3ffd411fe81` | **PASS** | لیست Portal متن «ثبت‌نام نهایی شده؛ پرداخت لازم نیست» نشان داد و label رایگان/بدون پرداخت را از وضعیت مالی جدا نگه داشت. |
| Portal Detail برای free — بازتولید اولیه | همان registration | **FAIL → FIXED** | قبل از patch صفحهٔ انگلیسی `Something went wrong / Try again` نمایش داد و Retry هم بی‌اثر بود. علت عملیاتی: خطای optional catalog detail در SSR به global error می‌رسید. |
| Portal Detail برای free — بعد از patch | همان registration | **PASS** | بعد از fallback محدود در `apps/portal/app/me/registrations/[id]/page.tsx`، صفحه با عنوان «ثبت‌نام شما نهایی شده است»، متن «نیازی به پرداخت نیست»، و `رسید: لازم نیست` باز شد؛ console error/warn ثبت نشد. |
| waitlist/capacity، duplicate race، group pricing، export و redaction | fixtureهای موجود | **UNVERIFIED** | این موارد در این اجرای مرورگر انجام نشدند؛ source/fixture proof جایگزین browser proof نیست. |

## Console / network notes

- Portal بعد از ثبت واقعی، خطای console سطح `error/warn` قابل مشاهده نداشت.
- API لاگ `POST /api/catalog/registrations 201` را ثبت کرد.
- API و BFF چند درخواست با زمان بالا داشتند؛ نمونهٔ pricing حدود ۴۰ ثانیه و registration حدود ۴۲ ثانیه طول کشید.
- در ثبت پرداخت، Admin ابتدا دکمه را در حالت «در حال ثبت…» نگه داشت؛ لاگ سرور نشان داد mutation موفق بوده (`POST /api/finance/prepayments 201`) اما UI تا reload stale ماند. بعد از reload وضعیت صحیح شد؛ این یک finding مستقل UX/cache است و PASS محصول مالی پس از reload محسوب می‌شود، نه proof به‌روزرسانی فوری UI.
- پس از رفتن به صفحات سنگین، processهای Next dev از دسترس خارج شدند؛ این یک blocker محیطی برای اجرای کامل Portal و ماتریس‌های بعدی است، نه PASS آن سناریوها.
- تست focused Portal بعد از patch: ۲۵ تست، ۲۵ سبز (`portal-member-registrations.spec.ts`, `fetch-catalog-tour.spec.ts`, `portal-payment-deadline.spec.ts`). این source proof است و جای browser proof سناریوهای باقی‌مانده را نمی‌گیرد.
- تست focused Workspace/Finance/Waitlist source: ۷۱ تست، ۷۱ سبز؛ این تست‌ها قرارداد roster و payment-follow-up را پوشش می‌دهند، اما mutation واقعی promotion با projection مالی را پوشش نمی‌دهند و با browser failure بالا override نمی‌شوند.

## Closure

- وضعیت کلی full purchase flow: **باز / بسته‌نشده**.
- مسیر پولی Admin تا انتها در همین sweep PASS شد: ثبت‌نام → تأیید/بدهی → نهایی‌سازی با پرداخت باز → ورود به final roster → ثبت پرداخت → خروج از outstanding با حفظ finalization.
- closure کامل هنوز صادر نمی‌شود: ماتریس‌های waitlist/duplicate/group/redaction/export هنوز browser proof ندارند.
- مسیر free detail، نهایی‌سازی با پرداخت باز، receipt متنی Portal، approve رسید در Admin و حفظ finalization بعد از approve اکنون browser PASS هستند؛ ماتریس‌های waitlist/duplicate/group/redaction/export هنوز browser proof ندارند.

## Waitlist browser check (local Admin)

- Fixture: `QA local waitlist capacity one` (`tourId=00000000-0000-4000-8000-000000000229`)
- Runtime URL: `http://admin.denali.localhost:3000/bookings?status=waitlisted&tourId=00000000-0000-4000-8000-000000000229`
- Observed: filter `در لیست انتظار` is applied; list shows ۲ results, both with `ظرفیت: ۱/۱`, `در لیست انتظار`, and `پرداخت‌نشده (رزرو)`.
- Observed gap: the selected Waitlist detail panel exposes only `رد ثبت‌نام` and `لغو رزرو`; no visible promotion/approve action is present, although the panel text says the operator can approve or reject.
- Result: **UNVERIFIED for the paid-promotion scenario**. The selected row did not expose the action in this global-list view; the later Workspace view did expose it and the mutation was executed there. This view is not sufficient to close the action for every surface.
- Source correlation: `BookingInspectionDetails` receives `showPromoteWaitlistWithCapacityIncrease`; the runtime omission means the parent guard (`showPromoteWaitlistWithCapacityIncrease` / capacity guard) evaluates false for this selected full-capacity row, or the current runtime bundle does not include the intended action. This needs a bounded source/runtime follow-up before closure.

### Waitlist promotion mutation

- Fixture: same tour; selected registration `9bc1d12d-4c68-40f2-83d6-a114d8619f11` (`QA Waitlist Promotion Candidate 1790955022840`)
- Workspace UI showed the action `افزایش ظرفیت و انتقال به پیگیری پرداخت`.
- Mutation: `POST /api/bookings/9bc1d12d-4c68-40f2-83d6-a114d8619f11/promote-waitlist-with-capacity-increase` → HTTP `200`.
- Immediate UI result: success notice `ظرفیت افزایش یافت؛ ثبت‌نام به تأییدشده و پیگیری پرداخت منتقل شد`; capacity changed from `۱/۱` to `۲/۲`; Waitlist count changed from ۲ to ۱; final roster count changed from ۱ to ۲.
- Result: **PASS for the free-tour mechanics; UNVERIFIED for paid-tour financial follow-up**. The fixture is `QA local waitlist capacity one`, and the selected row plus the other approved rows in the same tour are explicitly shown as `بدون نیاز به پرداخت`. Therefore the observed `منتظر پرداخت ۰` is consistent with this free fixture and is not evidence of a financial-projection bug.
- Source correlation: the promotion service calls `repository.approveWithOutbox` and does not itself waive payment; it preserves the booking's existing financial state. A separate paid fixture is required before deciding whether promotion incorrectly changes an unpaid/partial booking to waived.
- Required next check: repeat the same Workspace mutation on a genuinely paid tour and verify the promoted row remains `پرداخت‌نشده`/`پرداخت جزئی`, keeps its debt/deadline, and appears in Finance follow-up. Until that run is captured, the paid promotion scenario remains **UNVERIFIED**, not FAIL.

### Paid-tour promotion follow-up

- Fixture: `Denali paid auto booking` (`tourId=00000000-0000-4000-8000-000000000223`); selected waitlisted registration `202120e5-ba9a-446a-b287-d7e00c68925f`, `QA Duplicate Browser`.
- Before mutation: Workspace Waitlist showed `در لیست انتظار`, `پرداخت‌نشده (رزرو)`, capacity `۱۰۰/۱۰۰`; the action `افزایش ظرفیت و انتقال به پیگیری پرداخت` was visible.
- Mutation: `POST /api/bookings/202120e5-ba9a-446a-b287-d7e00c68925f/promote-waitlist-with-capacity-increase` → HTTP `200`.
- After mutation: capacity became `۱۰۱/۱۰۱`; Waitlist count became `۰`; success notice said `ظرفیت افزایش یافت؛ ثبت‌نام به تأییدشده و پیگیری پرداخت منتقل شد`; Finance count became `۶`.
- Finance projection: `QA Duplicate Browser` appeared in payment follow-up with `۲٬۵۰۰٬۰۰۰ تومان` and `پرداخت‌نشده`; no free/waived label was shown.
- Result: **PASS** for paid promotion → payment follow-up. The earlier free-fixture observation is corrected and is not a product bug.

## Additional source gates

- Workspace operational roster, waitlist labels, payment-follow-up logic and export contract: **30/30 PASS**.
- Web exposure redaction/UI contracts: **12/12 PASS**.
- Portal duplicate E2E file: **NOT RUN as an E2E test**; direct `node --test` execution is invalid for this Playwright file (`test.describe.configure()` outside the Playwright runner). It is not a product failure and still needs the package's official Playwright command/browser fixture.
- Final-roster Excel browser export: **PASS**; Admin showed `فایل Excel آماده و دانلود شد` after exporting the final roster. The page also states that settled and outstanding people are separated into different sheets.
- Duplicate browser probe (`denali-multi-guest-partial-duplicate.spec.ts`) with the official Playwright runner and `PW_CHANNEL=chrome`: **FAIL/UNVERIFIED** before the duplicate submit step. The browser reached `Something went wrong` on the authenticated registration page and never exposed `[data-public-registration-intake][data-registration-ready]`; therefore no duplicate result was produced. This is a real browser-flow blocker requiring root-cause investigation, not a passing source test.
- Commercial pricing source contracts: **12/12 PASS** across Portal/API focused specs; Denali journey, transport/dong and due-breakdown contracts: **29/29 PASS**. These remain source proof only; member/guest multi-participant browser proof is still open.
- Admin Exposure Playwright smoke was attempted with the official config but all 3 tests stopped before launch because that config does not honor the system Chrome override and the Playwright bundled Chromium is absent. Result: **UNVERIFIED / environment runner blocker**, not product FAIL; source Exposure contracts remain `12/12 PASS`.

### Duplicate/partial browser recheck

- The first duplicate probe was blocked by an invalid fixture national ID (`1234567890`); the browser correctly stopped on client-side checksum validation before any registration POST. The probe fixture was corrected locally to use checksum-valid shared ID `1000000001`.
- Re-run with the official Playwright runner and `PW_CHANNEL=chrome`: authentication and intake hydration reached the local portal, but the test then timed out while waiting for `data-registration-ready` during the session-resume transition. A second run reached the ten-guest form, but after submit no `data-denali-submit-results` appeared within 90 seconds.
- API logs confirm OTP/session endpoints were successful (`200`); no clean duplicate outcome (`201` + `409`) was captured. Result: **UNVERIFIED / browser flow still open**, not a product PASS. The fixture change is test-only and has not been committed.
- A third run forced the smoke server and Playwright to use the same canonical `operator.portal.localhost` host. It reached the ten-guest form and the submit button, but the UI showed the generic `خطایی رخ داد. دوباره تلاش کنید.` alert and still produced no per-card result block before the 90-second assertion timeout. This keeps the scenario **UNVERIFIED** and narrows the next investigation to submit response/timeout handling.
- A subsequent same-host rerun regressed to the earlier `در حال بررسی ورود شما…` / missing `data-registration-ready` state before intake. The variability itself is evidence that the browser probe is not stable enough for closure; no duplicate result is claimed.
- Representative multi-guest probe (`add 2 → remove to 1 → submit`) reached the real intake, submitted one `other` participant successfully, and API logged `POST /denali/registrations` HTTP `201`. The follow-up `/me` assertion could not be completed because `portal.operator.localhost:3003` refused the connection after the success navigation; therefore submit is a browser PASS, but Portal post-submit projection/badge remains **UNVERIFIED**.
- The same representative multi-guest probe was rerun against a local production build (same canonical host, system Chrome). It completed end-to-end: OTP/auth, add 2 guests, remove to 1, real `POST /denali/registrations` HTTP `201`, success screen, navigation to `/me`, and `data-portal-member-registrant-other-badge` visible. Result: **PASS**. The earlier connection refusal is isolated to the dev/HMR runtime and does not reproduce in the production build.

### Admin production payment-follow-up recheck

- `TC-BOOK-05` was rerun against the local Admin production build (`next start`), with only Admin + API running and system Chrome selected.
- Fixture: approved paid booking with an obligation of `500000`; the test records a partial manual payment of `100000`.
- Observed: `POST /finance/prepayments` → HTTP `201`; the workspace action result banner appeared; the recorded prepayment amount was `100000`; the booking remained `paymentStatus=partial`; the test passed.
- The first attempt used the full `500000` amount and correctly moved the booking out of the outstanding list, which made the row-scoped banner disappear. That was a test-fixture mismatch, not evidence that the payment mutation failed. The test fixture/assertion were corrected to exercise partial payment.
- Result: **PASS** for Admin approved → partial manual payment → payment-follow-up state. Screenshot capture remains unavailable because `/opt/cursor/artifacts` does not exist in this environment.

### Admin production finalization cancellation / Waitlist promotion

- Browser test `TC-BOOK-07` ran against the local Admin production build with only Admin + API active.
- Fixture: seeded the real public `/denali/registrations` path until tour `00000000-0000-4000-8000-000000000220` reached capacity; the next registration returned `status=waitlisted`.
- The first approved booking was finalized with open payment: `POST /bookings/{id}/finalize-with-open-payment` → HTTP `200`; API confirmed `status=approved`, `paymentStatus=unpaid`, `finalizationStatus=finalized`.
- Cancellation was performed through the Admin browser confirmation flow: `POST /bookings/{id}/cancel` → HTTP `200`; cancelled booking API state became `cancelled`.
- Side effect: the oldest Waitlist booking became `status=approved`, retained `paymentStatus=unpaid`, and remained `finalizationStatus=not_final`.
- Result: **PASS** for final unpaid cancellation → seat release → Waitlist promotion. This closes the previously open browser scenario for this lifecycle.

### Portal production concurrent duplicate race

- The official Portal Playwright probe ran against the local Portal production build with only Portal + API active.
- After real OTP/session authentication, two simultaneous authenticated `POST /api/catalog/registrations` requests were sent with the same guest identity and distinct idempotency keys.
- Result: exactly one HTTP `201` and one HTTP `409`; Playwright test passed.
- Result: **PASS** for the real concurrent duplicate API race through the Portal BFF.
- The duplicate/partial probe was also rerun with the official Playwright runner against the local production build. It reached the ten-guest intake, submitted, and rendered `[data-denali-submit-results]` with a visible `[data-denali-submit-result-error]`. Result: **PASS for partial-failure UI**. The probe does not currently assert or capture the exact per-request `201`/`409` pair, so backend duplicate-race closure remains **UNVERIFIED** despite the UI result.
- The duplicate probe was tightened to capture registration response statuses and rerun against the local production build. It passed with both `201` and `409` responses present, alongside the partial-failure result UI. Result: **PASS** for the sequential duplicate/partial path; concurrent-submit race is still a separate scenario and remains **UNVERIFIED**.

### Additional lifecycle source gate

- Denali lifecycle, operational roster, pricing summary, cancellation policy, and roster semantics focused tests: **40/40 PASS**. This covers approved unpaid vs finalized unpaid, partial/paid/waived projections, waitlist capacity semantics, cancellation eligibility, and participant pricing. It is source proof only; it does not replace browser evidence for the remaining live mutations.

### Admin browser command-center recheck

- The Admin command-center browser suite was first blocked by its config ignoring system Chrome and by an incorrect default PostgreSQL port (`5432` vs the local `5434`). The config was corrected to honor `PW_CHANNEL`; the rerun used the local `5434` database and only the Admin frontend.
- `TC-BOOK-01` manual create → pending/unpaid: **PASS** after allowing the real slow list hydration (the initial 5-second assertion was too short; API creation was HTTP `201`).
- `TC-BOOK-02` guest register → approve/payment required: **PASS** in the suite; API approve returned HTTP `200` and the booking remained `paymentStatus=unpaid`.
- `TC-BOOK-03` guest register → reject: **PASS** in an isolated rerun; reject returned HTTP `200` and the booking reached `rejected`.
- `TC-BOOK-04` free approval and `TC-BOOK-05` manual payment were not closed in the latest isolated run because the local Next dev server dropped the connection during the second startup (`socket hang up` / redirect from `denali.admin.localhost` to `admin.denali.localhost`). This is an environment/runtime blocker, not a product PASS or FAIL.
- Artifact screenshots under `/opt/cursor/artifacts` were unavailable in this environment; screenshot evidence for these Admin cases remains **UNVERIFIED** even where assertions passed.
- The same representative multi-guest probe was rerun against a local production build (same canonical host, system Chrome). It completed end-to-end: OTP/auth, add 2 guests, remove to 1, real `POST /denali/registrations` HTTP `201`, success screen, navigation to `/me`, and `data-portal-member-registrant-other-badge` visible. Result: **PASS**. The earlier connection refusal is isolated to the dev/HMR runtime and does not reproduce in the production build.
### Portal production rejected-receipt resubmit

- **Status: UNVERIFIED (runner/host blocker, not a product FAIL).**
- Added browser coverage in `apps/portal/tests/e2e/portal-booking-purchase-matrix.browser.spec.ts` for: approved registration → receipt submit → Admin receipt rejection → Portal rejected hint + active upload → receipt resubmit → waiting-for-review.
- First attempt used the default `operator.localhost:3000` and failed before product flow with `ECONNREFUSED ::1:3000`.
- Second attempt started Admin on port 3000 with `admin.denali.localhost`, but the operator inbox test id did not appear; the selected host/tenant route was not compatible with `operator-booking-ui` (`getByTestId('operator-bookings-inbox')` timeout).
- No registration/receipt status from the rejected-resubmit flow is accepted as evidence until the runner uses the same canonical Admin host that exposes the command center inbox.
### Portal production rejected-receipt resubmit — follow-up

- The booking topology was corrected to use the dedicated API + Admin + Portal runner with `operator.localhost` host resolution.
- The receipt submit step reached the real API and returned `POST /bookings/:id/receipts 201` before the Admin review phase.
- The test helper was corrected: the receipt form intentionally clears `input.files` after `onChange` and stores the File in React state, so the authoritative assertion is the enabled submit button rather than `input.files.length`.
- The run still ended **UNVERIFIED** because the dedicated runner's Admin web process exited with code 0 before the review page could be opened. No product FAIL is inferred.
- Focused receipt/status source gate after the browser-helper correction: **25/25 PASS** (`portal-member-registrations.spec.ts`, `format-member-registration-display.spec.ts`, `receipt-status-label-contract.spec.ts`).
### Portal production transport browser matrix

- **3 PASS:** bus tour personal-car choices render without opt-in; incomplete transport blocks submit and focuses the field; shared-cars flow requires dong and submits `transport.kind=no_car_dong`.
- **2 UNVERIFIED (fixture missing):** personal-car occupants and driver-only scenarios could not reach intake because the seeded tour IDs returned `GET /denali/catalog/:id 404`.
- No product FAIL is inferred for the two missing-fixture cases; they require valid seeded tour IDs or fixture seeding before closure.
### Portal production transport fixture repair and retest

- Root cause: in-memory tour seed indexed only `…000213` and `…000214`; Postgres seed also defines occupancy `…000215` and driver-only `…000216` variants.
- Added the two variants to the in-memory repository seed.
- Retest: **3/3 PASS** for `DEN-TRANS-02` occupants, `DEN-TRANS-02b` driver-only, and `DEN-TRANS-02c` incomplete transport validation.
- Combined with the earlier pass, all five transport browser cases in this matrix are now PASS.

### Portal production rejected-receipt resubmit — one-frontend retest

- Ran with only API + Portal active; Admin frontend was not started. Initial approval used the operator API contract, while receipt upload, rejected state, correction and resubmit were exercised in the real Portal browser.
- Receipt upload returned HTTP `201`; the operator review mutation returned success; Portal reload showed the rejected-receipt hint and active upload; resubmission returned to waiting-for-review and removed the rejected hint.
- Result: **PASS** for rejected receipt → correction → resubmit. Screenshot capture was attempted but `/opt/cursor/artifacts` is absent, so screenshot evidence remains **UNVERIFIED**.

### Commercial pricing browser matrix — one-frontend retest

- Ran with only API + Portal active and system Chrome; Admin frontend was not started.
- Member self on the discount-enabled tour: `invoiceTotalMinor=2000000`, `balanceDueMinor=2000000` — **PASS**.
- Guest/other on the same discount contract received the base `2500000` in the earlier probe, confirming the member discount does not leak to guests.
- Paid tour with the discount gate closed: `invoiceTotalMinor=2500000`, `balanceDueMinor=2500000` — **PASS**.
- Combined Playwright result: **2/2 PASS**. Staging runtime SHA and live Exposure redaction remain outside this local proof.

### Admin Exposure browser smoke — latest one-frontend run

- Ran with API + only Admin Web active, using system Chrome; no Marketing frontend was started.
- `SMK-EXP-02` panel rendering: **PASS**.
- `SMK-EXP-01` navigation to `/settings/exposure`: **UNVERIFIED** because the production Admin process exited after readiness and the navigation timed out.
- `SMK-EXP-03` locale-less integration link: **UNVERIFIED** because the Admin process exited and Chrome reached `chrome-error://chromewebdata/`.
- This is an environment/runner failure, not evidence of a product regression. Live Admin toggle plus Marketing API/HTML/AX redaction is still open; source Exposure contracts remain `12/12 PASS`.

### Admin Exposure smoke after production build

- Built `@apps/web` successfully with `NEXT_FONT_OFFLINE=1`.
- Re-ran the Admin Exposure settings smoke with system Chrome and only Admin + API active.
- `SMK-EXP-01`, `SMK-EXP-02`, `SMK-EXP-03`: **3/3 PASS**.
- A real public-list destination hide toggle with reload was also **1/1 PASS** for the operator smoke tenant.
- This does not close Denali Marketing redaction: the operator smoke tenant is distinct from the Denali public catalog tenant, so the Marketing API/HTML/AX evidence for Denali remains **UNVERIFIED**.

### Denali public tenant Exposure → Marketing, sequential one-frontend run

- Started the Denali public fixture API, then Admin only; Admin toggle and reload passed.
- Stopped Admin before starting Marketing. Marketing was the only frontend active for the public-output check.
- Public list after hiding `denali.destination`: API `200`, catalog item `category=null`, and PLP card category count `0` — **PASS**.
- Public detail under inherited exposure: API `200`, detail destination remained visible — **PASS** for the declared surface inheritance rule.
- Marketing browser/DOM and API evidence now exists for the Denali tenant; no product FAIL observed in this exposure scenario.

### Evidence reconciliation

- Entries above marked `UNVERIFIED` describe earlier attempts and are retained for audit history.
- The later production-build/one-frontend retests supersede the relevant earlier blockers for: Admin Exposure settings, transport fixture cases, rejected-receipt resubmit, and Denali public-list redaction.
- Remaining non-closure items are artifact/runtime SHA on staging and unavailable screenshot files; these are release-evidence gaps, not observed product failures.

### Staging runtime provenance check — 2026-10-03

- `https://denali.shenski.com/health`, `https://portal.denali.shenski.com/health`, and `https://admin.denali.shenski.com/health`: all HTTP `200`, body `{"ok":true}`.
- All three hosts returned `x-cache: BYPASS`, so the health responses were not served from the edge cache.
- `/release-manifest.json` returned HTTP `404` on all three hosts; no runtime commit SHA or artifact manifest is publicly exposed.
- Result: host health **PASS**; exact staging artifact SHA remains **UNVERIFIED** and cannot be inferred from the health response or Next.js asset hashes.

### Full `test:changed` source gate — 2026-10-03

- Portal purchase/registration package tests: **398/398 PASS**.
- Admin Web tests: **2060/2060 PASS**.
- Finance Core: **274/274 PASS**.
- Workspace SDK, platform-core, tenant-kernel, starter, theme-react, Denali and related packages completed without additional product-flow failures.
- API package: **3168 total; 3159 PASS, 2 FAIL, 7 SKIP**. The two failures are the same fixture-count assertion in `apps/api/test/denali-catalog.spec.ts` (`DCAT-01`) and `apps/api/test/p6-vs01-admin-publish.spec.ts` (`P6-VS-01-01`): actual published catalog count is `12`, while both tests still expect `10`.
- Overall gate: **FAIL** because of those two catalog assertions. They are separate from the purchase-flow scenarios, but the repository gate is not green until the fixture contract is reconciled.
- `git diff --check`: **PASS**.

### Catalog fixture contract reconciliation — 2026-10-03

- Root cause confirmed: the in-memory seed now includes the published transport variants `…000215` (occupancy) and `…000216` (driver-only), but two catalog tests still asserted the historical count of `10`.
- Updated `DCAT-01` and `P6-VS-01-01` to assert the current published contract of `12` items and to require both transport variant IDs.
- Focused retest: **13/13 PASS** across `denali-catalog.spec.ts` and `p6-vs01-admin-publish.spec.ts`.
- The full `test:changed` gate must still be rerun after this reconciliation; no overall green result is claimed yet.

### Full `test:changed` rerun after fixture reconciliation — 2026-10-03

- API package: **3168 total; 3161 PASS, 0 FAIL, 7 SKIP**.
- Portal purchase/registration package tests: **398/398 PASS**.
- Admin Web tests: **2060/2060 PASS**.
- Finance Core: **274/274 PASS**.
- Remaining affected workspace packages completed from cache without additional failures.
- Overall `test:changed`: **PASS** (`base=origin/main`, `mode=ci`).
- `git diff --check`: **PASS**.
- The seven API skips are environment-gated Postgres/MinIO/RLS cases; they are not counted as purchase-flow passes.

### Full purchase-flow browser matrix — latest local run

- Runtime source: `0fa60d472964ad24ce70549c24762718e9684944`; one Admin frontend at a time; system Chrome `/usr/bin/google-chrome`.
- Initial run with bundled Playwright Chromium: 1 API scenario passed; 9 browser scenarios were blocked before launch because the bundled executable was absent. This is an environment blocker, not product evidence.
- System-Chrome run: `P3-E2E-E02` capacity overflow **PASS**; `P3-E2E-E03` guest register → operator reject → terminal rejected **PASS**; `P3-E2E-E04` waitlist → approve **PASS**; paid auto approval remains unpaid **PASS**; free auto approval after assertion correction **PASS**.
- A free-manual run exposed a real state mismatch requiring follow-up: the registration API returned `status=pending`, while the Admin row/detail rendered `تأییدشده` + `بدون نیاز به پرداخت` before the operator action, so the expected approval action was unavailable and the test timed out. This is **FAIL / needs product investigation**, not a test pass.
- Later scenarios in the same batch were contaminated by the local web runner exiting after readiness and returning `ECONNREFUSED ::1:3000`; discount and cancellation results from that run remain **UNVERIFIED**.
- Current conclusion: the complete purchase flow and all scenarios are **not closed**. The free-manual pending projection is the first confirmed product finding from this matrix; discount, cancellation, receipt-after-finalization and staging-SHA closure still need independent evidence.

### Correction — free-manual action correlation

- A fresh free-manual registration created through the public registration API was `pending` before operator action; the direct operator list/detail projection also reported `pending/unpaid/none`.
- The earlier snapshot containing `approved/finalized/WAIVED` belonged to an already actioned/previous booking and must not be read as proof of a pre-action projection mismatch.
- In the real Admin browser, the visible `تأیید بدون نیاز به پرداخت` control was clicked, but no `/api/finance/registrations/{id}/obligation-override` or `/api/bookings/{id}/approve` request was emitted; the same booking stayed `pending/unpaid/none` for 30 seconds. **FAIL: UI action does not execute.**
- Directly exercising those same BFF endpoints with the authenticated browser context returned `200` for both calls and produced `approved/paid/WAIVED`. This isolates the current finding to the Admin UI action wiring/interaction path, not the API projection.

### Remaining Admin action checks — latest focused runs

- `manual approval freezes the member discount`: **UNVERIFIED/FAIL at UI action**. The paid-manual booking and `تأیید و منتظر پرداخت` button rendered, but the expected `POST /api/bookings/{id}/approve` was not observed after the real click; invoice assertions could not be reached.
- `free auto cancellation is terminal`: **UNVERIFIED/FAIL at UI action**. The `لغو رزرو` button rendered, but its confirmation dialog did not open after the real click; no cancellation request was observed.
- These two results match the free-manual finding: the inspection action controls render, while their browser event path does not produce the expected action. They remain product-level browser failures until reproduced/fixed, not closed by direct API success.
- The discount test harness was also corrected so its response waiter is installed before the click; this removes a test-order race but does not close the UI-action failure.

### Admin purchase-flow confidence retest — latest focused runs

- One Admin frontend and one API were active at a time; system Chrome was used.
- Free manual approval: **PASS**. The real button had a hydrated click handler; `PUT /api/finance/registrations/{id}/obligation-override=200` followed by `POST /api/bookings/{id}/approve=200`; final projection was `approved/paid/WAIVED`.
- Paid manual guest approval: **PASS**. The real `POST /api/bookings/{id}/approve=200` completed and the guest invoice stayed at base `2,500,000`; the member discount did not leak to `registrantTarget=other`.
- Cancellation: **PASS**. The real confirmation dialog opened, `POST /api/bookings/{id}/cancel=200` completed, and the cancelled state survived Admin reload.
- Latest ten-case confidence run: **9/10 PASS**. The only failure was test-fixture reuse of an existing persistent Prisma self-registration for the member-discount case; the isolated member-discount browser run was **PASS** with `invoiceTotalMinor=2,000,000` and `balanceDueMinor=2,000,000`. No new product failure was observed in this retest.
- The 10-case suite is therefore not a single clean PASS yet; the remaining issue is test isolation/reuse on the persistent local DB, not an observed purchase-flow behavior. Staging artifact SHA remains **UNVERIFIED**.

### Full matrix retry and isolated Waitlist confirmation — 2026-10-03

- A subsequent full 10-case run completed **9/10 PASS**; the only interruption was before the Waitlist scenario reached product actions: the Admin OTP request received a `308` redirect and then `socket hang up`.
- The same Waitlist → approve scenario was rerun independently with the same one-frontend setup and system Chrome: **PASS** in 21.5s.
- The cancellation scenario was also rerun independently: **PASS** in 43.6s.
- Therefore all ten matrix scenarios have independent PASS evidence across the latest runs, but there is still no single uninterrupted 10/10 run because the persistent local runner intermittently fails during OTP bootstrap. This is **test-infrastructure/fixture stability**, not a newly observed product failure.
- Source gates remain green from the latest rerun (`test:changed`, API 3161 PASS/0 FAIL/7 SKIP, Portal 398/398, Admin 2060/2060, Finance 274/274). Staging runtime SHA remains **UNVERIFIED**.

### Clean full Admin purchase-flow matrix — 2026-10-03

- Full `denali-booking-confidence.spec.ts` with one Admin frontend, system Chrome, one worker and one retry policy: **10/10 PASS in 2.3m**.
- Covered overflow rejection, reject terminal state, Waitlist → approve, paid auto approval, free auto approval, free manual pending → waived, member discount, free member discount, manual guest base pricing, and cancellation terminal state after reload.
- No product-flow failure observed in this clean run. Staging runtime SHA is still **UNVERIFIED**; this is local browser evidence only.

### Current staging provenance recheck — 2026-10-03

- `https://denali.shenski.com/health`, `https://portal.denali.shenski.com/health`, and `https://admin.denali.shenski.com/health`: **HTTP 200**.
- All three responses expose `x-cache: BYPASS`; no runtime release SHA/fingerprint is returned.
- `/release-manifest.json` remains **HTTP 404** on the public, portal, and admin hosts.
- Result: staging availability is **PASS**, but exact deployed artifact SHA remains **UNVERIFIED**; local browser PASS cannot be promoted to staging closure.

### GitHub deploy provenance cross-check — 2026-10-03

- Public GitHub Actions run `37055922167` (`Deploy staging (dev)`) completed **success**.
- Its `head_sha` is `fc758deafaa26f6c049d887390b239e09eeaf12d`; the `dev` remote currently points to the same SHA.
- Build and deploy jobs both completed successfully (`111000487397`, `111007881450`).
- This proves the intended staging deployment artifact/source, but not the exact runtime process serving the three hosts because all public `/release-manifest.json` endpoints return 404. Runtime SHA remains **UNVERIFIED** until the manifest/fingerprint is exposed or checked on the host.

### Direct staging host provenance check — 2026-10-03

- Read-only SSH inspection of `/opt/app-tour-staging/current` succeeded on the staging host.
- `current` resolves to `/opt/app-tour-staging/releases/fc758deafaa26f6c049d887390b239e09eeaf12d`.
- `release-manifest.json` and `release-integrity.json` both report `releaseSha=fc758deafaa26f6c049d887390b239e09eeaf12d`.
- Artifact digest: `77e3ac5139eebbc7b90cc6f7745566fa7eb4fed3884f668a9e4470d1219c489a`.
- Build timestamp: `2026-10-02T19:59:36Z`; migration head: `20260923120000_payment_gated_finalization`.
- Runtime provenance is now **PASS** for the deployed artifact and matches the successful GitHub Actions staging run. Public endpoint exposure is still 404, but host-level manifest is authoritative.
- Git comparison: local test HEAD `0fa60d472964ad24ce70549c24762718e9684944` is the merge-base/ancestor of `origin/dev` and the deployed staging SHA. The deployed release therefore contains the tested local HEAD plus later merge commits; it is not an older unrelated artifact.

### Staging browser access check — 2026-10-03

- The available browser session is currently unauthenticated at `https://portal.denali.shenski.com/login`.
- No approved staging QA session is present, so no staging registration/payment mutation was executed through the browser in this turn.
- Result: staging runtime provenance is closed, but staging end-to-end Browser closure remains **BLOCKED ON AUTHENTICATED QA SESSION**; no product PASS/FAIL is inferred from this access gap.

### Staging authenticated purchase-flow retest — 2026-10-03

- QA member session authenticated successfully with the approved staging OTP flow.
- Fixture: `QA 2026 Member Discount`, tour `31139b4a-f65b-4ef7-b727-42283294faa5`.
- Portal PDP/registration: gallery opened; member preview showed base `۲٬۵۰۰٬۰۰۰`, ۲۰٪ discount, payable `۲٬۰۰۰٬۰۰۰`; submit returned «درخواست ثبت شد».
- Portal registration: registration `4d90b7df-0725-4d32-997f-6bf4f00861e6` appeared approved with debt `۲٬۰۰۰٬۰۰۰` and receipt upload enabled.
- Text receipt submission: staging Portal changed to «فیش شما در حال بررسی است» / `receipt=pending`.
- Admin receipt review: the receipt appeared in the real queue; approval changed the queue to «فیشی در انتظار بررسی نیست» and reported «تأیید شد — مانده ۰ تومان».
- Admin finalization path: a paid fixture `QA Guest Pricing 20260929` was finalized with the real `تأیید نهایی با پرداخت باز` action. The confirmation required a second click; after mutation the UI showed finalization, retained debt `۲٬۵۰۰٬۰۰۰`, and kept the row in payment follow-up.
- Full payment: the Admin action `ثبت مبلغ واریزشده` recorded the remaining `۲٬۵۰۰٬۰۰۰`; the row left that follow-up view and appeared in the final roster as `نهایی` / `وجه دریافت شد`.
- Staging core path result: **PASS** for registration → approval/debt → finalization with open payment → payment → final roster.

### Staging finding — payment approved before finalization

- For registration `4d90b7df-0725-4d32-997f-6bf4f00861e6`, Admin Finance showed a recorded payment of `۲٬۰۰۰٬۰۰۰`, paid `۲٬۰۰۰٬۰۰۰`, balance `۰`; however the booking detail badge remained `پرداخت جزئی (رزرو)` and stated that payment registration did not fully settle the booking.
- Portal Detail/List after reload showed `رسید پرداخت تأیید شد` but still said `برای نهایی شدن سفر، پرداخت را تکمیل کنید`; the booking was not in final roster because it had not been finalized.
- This is a **confirmed projection/UX inconsistency** for the sequence `approved → payment/receipt approved → not finalized`: financial amount is zero, but payment-state/copy remains partial/payment-pending. It must be fixed or the contract must explicitly distinguish “paid but awaiting admin finalization” from “payment pending”.

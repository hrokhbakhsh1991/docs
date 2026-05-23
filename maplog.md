# WORKSPACE USER INVITATION SYSTEM & CUSTOM TABS UX (PHASE 14.11)
Goal: Enforce strict RTL orientation, implement native CSS-driven Active vs. Pending Tabs, align invite roles with backend validation, and prevent duplicate SMS dispatches. Do not touch map.md or map.log.

---

## TASK 14.11.1: Frontend - Lightweight Custom CSS Dual-Tab Directory View
* **Target File**: `apps/web/app/(app)/users/users-page-client.tsx`
* **Technical Specification**:
    - Do not pull Radix Primitives for tabs. Use the workspace's idiomatic lightweight React state tabs structure (`useState('active')`) with custom RTL CSS buttons.
    - **Tab 1 ("اعضای ورک‌اسپیس")**: Renders the core 4-column virtual table (`rosterRows`).
    - **Tab 2 ("دعوت‌نامه‌های در انتظار")**: Renders a secondary compact list calling `GET /api/v2/users/invite` (or the underlying workspace invites stream). Show rows with: Phone/Name Note, Assigned Role, Expiration Time, and a text-left actions menu containing "ارسال مجدد پیامک" and "لغو دعوت".

## TASK 14.11.2: Backend & Frontend - Extended Post Payload & Unified Tag Editor
* **Target Files**:
    - `apps/api/src/modules/identity/dto/post-workspace-user-rewards.dto.ts`
    - `apps/api/src/modules/identity/workspace-users.service.ts`
    - `apps/web/app/(app)/users/components/workspace-user-rewards-modal.tsx`
* **Technical Specification**:
    - **Unified API**: Extend `PostWorkspaceUserRewardsDto` to accept an optional `labels: string[]` parameter. Update `WorkspaceUsersService` to mutate both columns atomically in a single transaction.
    - **Two-Tab Action Modal**: Refactor `WorkspaceUserRewardsModal` into localized Persian tabs using your native CSS tab mechanism:
      - Tab 1 ("امتیازات و تگ‌ها"): Discount field, Selectable Leader Switch, Loyalty Select, and an interactive tags manager syncing to the extended `labels` payload stream.
      - Tab 2 ("سابقه سفرها"): Consumes `/booking-summary` to display a clean micro list of past tours.

## TASK 14.11.3: Frontend - Localized Invite Dialog Connection (API Role Sync)
* **Target File**: `apps/web/app/(app)/users/components/workspace-invite-modal.tsx`
* **Technical Specification**:
    - Wire the "Invite User" button to open a fully localized dialog.
    - **Role Dropdown Alignment**: Strictly restrict roles to API-allowed constants. Show exactly: مدیر (Admin), عضو عادی (Member), بیننده (Viewer). Do not include Leader here.
    - Fields: Phone (validated), Name Note (passed safely or stored via local placeholder).
    - On submit, fire `POST /api/v2/users/invite`, freeze controls via `disabled={isPending}`, and fire `toast.success("دعوت‌نامه با موفقیت صادر و پیامک شد")`.
    # WORKSPACE USERS FULL LOCALIZATION & RTL REFINEMENT (PHASE 14.12)
Goal: Convert all leftover English UI strings, copy blocks, statuses, and table headers into rich Persian typography while maintaining strict component rendering logic, memoization, and dynamic states. Do not touch map.md or map.log.

---

## TASK 14.12.1: Frontend - Global Copy Localization
* **Target File**: `apps/web/app/(app)/users/users-copy.ts` (or the dynamic strings dictionary used by the users layout)
* **Technical Specification**:
    - Completely rewrite and translate all directory strings into idiomatic Persian text:
      - Main Title & Subtitle $\rightarrow$ **کاربران** | **مدیریت اعضای ورک‌اسپیس، نقش‌ها و سطوح وفاداری.**
      - Filter Labels & Placeholders $\rightarrow$ **جستجو بر اساس نام یا ایمیل...** | **همهٔ نقش‌ها**
      - Table Header 1 (Active) $\rightarrow$ **کاربر**
      - Table Header 2 (Active) $\rightarrow$ **نقش سیستمی**
      - Table Header 3 (Active) $\rightarrow$ **امور مالی و رتبه‌بندی**
      - Table Header 4 (Active) $\rightarrow$ **عملیات**
      - Invite Button $\rightarrow$ **دعوت کاربر جدید**
      - Tab Labels $\rightarrow$ **اعضای ورک‌اسپیس** | **دعوت‌نامه‌های در انتظار**

## TASK 14.12.2: Frontend - Inline Status & Date Formatter Localization
* **Target Files**:
    - `apps/web/app/(app)/users/user-row.tsx`
    - `apps/web/app/(app)/users/components/pending-invites-table.tsx`
    - `apps/web/app/(app)/users/users-format.ts`
* **Technical Specification**:
    - **Trip Summary Labels**: Localize the formatted string output inside `formatTripSummaryLabel`. Convert `{completed} Ok / {cancelled} Cancel` $\rightarrow$ `{completed} موفق / {cancelled} کنسل شده`.
    - **Relative Time Activity**: Update `formatActiveAgoLabel` hooks. If the relative time parsed matches words like "ago", ensure it outputs clean Persian fragments (e.g., "فعال در ۲ ساعت پیش"). Fallback for null values $\rightarrow$ `"بدون فعالیت اخیر"`.
    - **Expiration Dates**: In the pending table, format the invite `expiresAt` ISO string or relative delta using a clean localized format (e.g., "انقضا در ۳ روز آینده").

## TASK 14.12.3: Frontend - Safe CSS RTL Alignment Check
* **Target Files**:
    - `apps/web/app/(app)/users/users-page-client.tsx`
    - `apps/web/app/(app)/users/user-table.tsx`
* **Technical Specification**:
    - Inspect the flex containers and layout rows. Ensure the root wrapper bears `dir="rtl"`.
    - Verify that text justification fields are aligned for Persian reading flow (User cell aligned right, action menu triggers safely aligned left/start inside Column 4).

## TASK 14.12.4: Compilation Gate Verification
- Run `pnpm --filter @apps/web exec tsc --noEmit` to confirm 100% type safety with zero broken imports.

# USER ENTITY NULLABLE EMAIL REFACTOR & CLEANUP (PHASE 14.13)
Goal: Make the email column truly nullable across migrations and entities, purge all synthetic `@local.invalid` generation logic from auth/invite streams, and clean up frontend cell formatters. Do not touch map.md or map.log.

---

## TASK 14.13.1: Backend - Schema Repair Migration & Purge Synthetic Emails
* **Target Files**:
    - `apps/api/src/modules/identity/entities/user.entity.ts`
    - `apps/api/src/modules/identity/services/users-invite.service.ts`
    - `apps/api/src/modules/auth/auth.service.ts` (or your registration completion paths)
* **Technical Specification**:
    - **Migration**: Create a core database migration named `MakeUserEmailTrulyNullable`. Alter the `users` table to set the `email` column as `NULL` (remove `NOT NULL` constraint and drop any stale partial unique indexes that conflict with multiple nulls, replacing with a conditional unique index: `CREATE UNIQUE INDEX idx_user_email_unique ON users(email) WHERE email IS NOT NULL AND deleted_at IS NULL`).
    - **Code Purge**: Locate where `@local.invalid` or `synthetic` email generation strings are minted during phone-first invitations or OTP registration completions. Completely delete that substitution logic. Let the `email` property naturally save as `null` or `undefined` in the database.

## TASK 14.13.2: Frontend - Defensively Render Null Emails
* **Target Files**:
    - `apps/web/app/(app)/users/user-row.tsx`
    - `apps/api/src/modules/identity/me-profile.mapper.ts`
* **Technical Specification**:
    - In `user-row.tsx`, update the subtitle renderer. If `row.email` is absent, null, or empty, do not render a subline block or placeholder text for it; only render the verified phone indicator line cleanly.
    - Clean up `me-profile.mapper.ts` by stripping the redundant filtering logic that was previously used to mask or hide the `local.invalid` suffix patterns.

## TASK 14.13.3: Verification Gate
- Run `pnpm --filter @apps/web exec tsc --noEmit` and `pnpm --filter @apps/api exec tsc --noEmit`.
- Run the full Jest E2E test suite to verify that creating users/invites with an absolute `null` email passes with 100% green status.

# EXECUTIVE TOURS INVENTORY INTEGRITY & VALIDATION (PHASE 15.1)
Goal: Enforce server-side tenant isolation and capability checks for `leaderUserIds` inside tour creation pipelines, secure payload sanitization, and refine frontend combobox bindings. Do not touch map.md or map.log.

---

## TASK 15.1.1: Backend - Server-Side Tour Leader Referential Integrity Assertions
* **Target Files**:
    - `apps/api/src/modules/tours/services/tours.service.ts` (or your invariant assertion helper files)
    - `apps/api/src/modules/tours/dto/trip-details.dto.ts`
* **Technical Specification**:
    - **Fix Cross-Tenant Hole**: Create a highly defensive service helper method named `assertLeaderUserIdsBelongToTenant(tenantId: string, leaderUserIds: string[])`.
    - **Validation Logic**: Inside this helper, write a query against the `user_tenants` (membership) repository. For all unique UUIDs provided in `leaderUserIds`, verify that:
      1. The user has an active membership matching the current `tenantId` (`status === MembershipStatus.ACTIVE`).
      2. The user is eligible to lead tours (their `role` is `ADMIN`, `OWNER`, or `LEADER`, OR their parsed metadata explicitly sets `isSelectableLeader === true`).
    - **Pipeline Integration**: Intercept the `createTour` and `updateTour` execution streams (where destination and equipment assertions are made) and invoke `await this.assertLeaderUserIdsBelongToTenant(tenantId, tripDetails.overview.leaderUserIds)`. Throw a strict `BadRequestException` or `ForbiddenException` if any invalid or foreign UUID leaks into the stream.

## TASK 15.1.2: Frontend - Secure Dynamic Crew Member Filtering
* **Target File**: `apps/web/src/hooks/use-workspace-tour-crew-members.ts`
* **Technical Specification**:
    - Look at the `useWorkspaceTourCrewMembers` hook query function fetching `getUsers`.
    - Optimize the fetching logic: Do not rely solely on heavy array-filtering client-side. If the backend `GET /api/v2/users` supports a query parameter for dynamic roles or capabilities, leverage it.
    - Ensure that the combobox options rendered inside `DenaliBasicInfoStep.tsx` accurately append localized badges next to the leader's name (e.g., if a user has a `VIP_MEMBER` badge or specific role, render it cleanly inside the multi-select dropdown options).

## TASK 15.1.3: Quality Compiler Assurance
- Run `pnpm --filter @apps/web exec tsc --noEmit` and `pnpm --filter @apps/api exec tsc --noEmit`.
- Run the full API E2E test suite (`pnpm test:api:e2e:jest`) to guarantee zero regression on catalog creations.

# WORKSPACE FINANCIAL HARDENING, ROUTING & LOCALIZATION (PHASE 16.1)
Goal: Write a defensive cross-tenant receipt E2E breach test, safely relocate and fully localize orphaned payment receipt panels, and activate the finance control route. Do not touch map.md or map.log.

---

## TASK 16.1.1: Backend - Cross-Tenant Receipt Breach E2E Test
* **Target File**: `apps/api/test/e2e/manual-receipt-flow.e2e-spec.ts` (or your active billing specs)
* **Technical Specification**:
    - Implement a strict defensive isolation test case: "should return 404 NotFound when Workspace A admin attempts to approve/reject a valid receipt UUID belonging to Workspace B".
    - Execute and ensure that the application handles fake tenant payload injection gracefully via a fail-closed sequence.

## TASK 16.1.2: Frontend - Relocate & Localize Orphaned Receipt Panels to Finance Route
* **Target Files & Layouts**:
    - Move files from `apps/web/app/(app)/users/admin-receipt-review-panel.tsx` $\rightarrow$ `apps/web/app/(app)/finance/components/admin-receipt-review-panel.tsx`
    - Move files from `apps/web/app/(app)/users/payment-receipt-upload-panel.tsx` $\rightarrow$ `apps/web/app/(app)/finance/components/payment-receipt-upload-panel.tsx`
    - Create a clean main page grid at `apps/web/app/(app)/finance/page.tsx` to mount these panels under a secure unified finance surface.
* **Technical Specification**:
    - **Localization**: Completely translate all labels and state strings inside both panels into premium Persian typography:
      - "Approve Receipt" $\rightarrow$ **تایید فیش واریزی**
      - "Reject / Decline" $\rightarrow$ **عدم تایید و رد فیش**
      - "Review Note" $\rightarrow$ **یادداشت و توضیحات حسابداری**
      - "Manual Payment Upload" $\rightarrow$ **بارگذاری فیش واریز نقدی/بانکی**
    - Enforce strict `dir="rtl"` wrapping layout alignment on the new finance center template views.

## TASK 16.1.3: Quality Compilation Gate
- Run `pnpm --filter @apps/web exec tsc --noEmit` and `pnpm --filter @apps/api exec tsc --noEmit`.
- Ensure all 29/29 and financial integration tests pass with 100% green status.

# WORKSPACE PRE-PAYMENT HOST APPROVAL GATE WORKFLOW (PHASE 16.3)
Goal: Force payment-required tours to initialize as `Pending`, bypass immediate payment intent generation at signup, and ensure capacity constraints bind only upon explicit host approval. Do not touch map.md or map.log.

---

## TASK 16.3.1: Backend - Refactor Initial Placement Logic & Payment Bypassing
* **Target File**: `apps/api/src/modules/tours/services/registrations.service.ts`
* **Technical Specification**:
    - **Invert Placement Rules**: Locate the private method `resolveInitialRegistrationPlacement(tour: TourEntity)`. Completely strip the override that forces `paymentRequired` tours into `RegistrationStatus.ACCEPTED`.
    - Enforce that unless `tour.autoAcceptRegistrations === true`, ALL creations default to `RegistrationStatus.PENDING` and set `consumesAcceptedCapacity: false`.
    - **Bypass Intent on Creation**: In the main save transaction, look at lines 1841-1856. Block or remove the conditional block that triggers `input.createPaymentIntent` when `requiresPayment` is true at initial registration time. It must remain dormant until host acceptance.

## TASK 16.3.2: Backend - Secure Status Update & Outbox Notification Hooks
* **Target Files**:
    - `apps/api/src/modules/tours/services/registrations.service.ts` (or your active status update handlers)
    - `apps/api/src/modules/identity/outbox.processor.ts`
* **Technical Specification**:
    - **Host Acceptance Transition**: Ensure that when a tour leader triggers `updateRegistrationStatus` to transition a row from `Pending` $\rightarrow$ `Accepted`, the system hooks up correctly to check capacity safety before flipping the enum.
    - **Outbox Consumer Anchor**: Inside `OutboxProcessor` under the event type `registration.accepted`, create a structured hook placeholder. If the booking is unpaid and `paymentRequired` is true, write a clean execution log indicating: `[SMS GATEWAY OUTBOX UNIFIED DISPATCH] -> Texting user via participantContactPhone to proceed with payment.` This prepares the notification pipeline for the future SMS module.

## TASK 16.3.3: Frontend - Verify Safe CTA Gating & Test Execution
* **Target Files**:
    - `apps/web/src/features/bookings/payment-flow.ts`
    - `apps/api/test/e2e/tours-complete-purchase-flow.e2e-spec.ts`
* **Technical Specification**:
    - Verify that `registrationNeedsPaymentUi` returns `false` if `status !== "Accepted"`, locking the traveler CTA in `Pending` state perfectly as verified by the report.
    - Run the entire E2E test suite to guarantee that creating a paid registration returns a `Pending` status first with 100% green compiler success.

    # LEADER REVIEW DASHBOARD & ADVENTURE CRM FULL RTL REFIT (PHASE 16.4)
Goal: Fully localize the leader queue and tour workspace, inject transport/vehicle CRM columns, fix the missing `expected_row_version` validation mismatch on status PATCH, and ensure full RTL harmony. Do not touch map.md or map.log.

---

## TASK 16.4.1: Frontend - Complete Persian & RTL Refit for Leader Queue & Workspace
* **Target Files**:
    - `apps/web/app/(app)/leader/review/page.tsx` (and its active client files)
    - `apps/web/app/(app)/tours/[id]/workspace/page.tsx` (and its nested tables)
* **Technical Specification**:
    - **Global RTL**: Enforce strict `dir="rtl"` layout nesting on both route screens.
    - **Localization Typography**: Convert all operational copies and tables into rich Persian typography:
      - "Leader review dashboard" $\rightarrow$ **داشبورد بررسی و تایید درخواست‌ها**
      - "Review queue" $\rightarrow$ **صف بررسی متقاضیان تور**
      - "Approve" / "Reject" $\rightarrow$ **تایید اولیه (صدور فاکتور)** | **رد درخواست**
      - "Queued registrations" $\rightarrow$ **درخواست‌های در انتظار بررسی**

## TASK 16.4.2: Frontend - Inject Adventure CRM Columns (Vehicle & Notes)
* **Target Files**:
    - `apps/web/src/features/dashboard/components/ReviewTable.tsx`
    - `apps/web/src/features/tours/components/RegistrationsTable.tsx`
* **Technical Specification**:
    - **Transport Vector Integration**: Expose and render a rich column named **«وسیله نقلیه / توضیحات»** inside both tables.
    - Parse `reg.transportMode`. Convert `self_vehicle` $\rightarrow$ **خودروی شخصی** (alongside rendering `vehicleSeatCapacity` if present as a small badge) and `group_vehicle` $\rightarrow$ **خودروی همسفران/گروهی**. Localize `participantNote` if written by the traveler to render right inside the main row overview context without hiding it inside secondary side panels.

## TASK 16.4.3: Frontend & BFF - Fix Missing `expected_row_version` Validation Mismatch
* **Target Files**:
    - `apps/web/src/hooks/use-update-registration-status.ts` (or your active status hooks)
    - `apps/web/src/features/dashboard/components/ReviewTable.tsx`
* **Technical Specification**:
    - **Payload Stabilization**: Update the status PATCH body signature. Ensure that when a leader clicks "Approve" or "Reject", the action grabs the row's dynamic version attribute (`rowVersion` or `version`) and bundles it securely into the payload alongside `targetStatus` as `{ targetStatus, expected_row_version: row.rowVersion }`.
    - Map this parameter all the way down through the Next.js BFF proxy to satisfy the production TypeORM optimistic locking architecture completely.

## TASK 16.4.4: Compilation Gate Verification
- Run `pnpm --filter @apps/web exec tsc --noEmit` to achieve 100% type safety.


# TRAVELER REGISTRATION WIZARD & BOOKING SUSPENSE UI (PHASE 16.5)
Goal: Expose transport/vehicle selection fields inside the traveler registration wizard, implement a beautiful localized suspense banner for `Pending` host-approval states on the booking ticket view, and ensure complete RTL cohesion. Do not touch map.md or map.log.

---

## TASK 16.5.1: Frontend - Inject Transport & Vehicle Selector inside Registration Wizard
* **Target File**: `apps/web/src/features/tours/components/wizard/register-for-tour-client.tsx` (or your active traveler wizard steps file)
* **Technical Specification**:
    - **UI Form Fields**: Inside the traveler information capture step, inject a clean Persian radio-group selection for `transportMode`:
      - Option 1 (`self_vehicle`): **«با خودروی آفرود شخصی شرکت می‌کنم»**
      - Option 2 (`group_vehicle`): **«بدون خودرو هستم (متقاضی صندلی گروهی)»**
    - **Conditional Capacity Field**: If `self_vehicle` is toggled, mount a micro number input for `vehicleSeatCapacity` labeled **«تعداد صندلی‌های خالی جهت پذیرش همسفر»**.
    - **Leader Note Block**: Append a clean textarea mapped to `participantNote` placeholder: **«یادداشت برای لیدر (مدل خودرو، تجهیزات همراه، یا سابقه سفرهای آفرودی خود را بنویسید)...»**.
    - Ensure all fields bind correctly to the final payload JSON dispatched to `POST /api/v2/registrations`.

## TASK 16.5.2: Frontend - Persian Suspense Banner on Traveler Ticket Dashboard
* **Target File**: `apps/web/app/(app)/bookings/[id]/booking-detail-client.tsx`
* **Technical Specification**:
    - Locate the parent container layout tracking `reg.status`.
    - **Pending Host-Gate Render**: If `reg.status === "Pending"`, inject a highly visible, stylized alert banner (`@/components/ui/alert` or standard Tailwind flex row with amber backgrounds, bearing strict `dir="rtl"`):
      - **متن بنر**: «درخواست ثبت‌نام شما با موفقیت ثبت شد و در انتظار تایید مدارک و نوع خودرو توسط لیدر تور است. به محض تایید، امکان پرداخت و قطعی کردن بلیت برای شما فعال خواهد شد.»
    - Ensure that under this state, all primary online payment buttons or cash invoice CTAs remain completely hidden, displaying a clean "در انتظار تایید میزبان" status badge.

## TASK 16.5.3: Quality Compiler Verification
- Run `pnpm --filter @apps/web exec tsc --noEmit` to confirm 100% type safety.


# EXECUTIVE FINANCIAL COMPLIANCE & PLATFORM INTEGRITY POLISH (PHASE 16.6)
Goal: Eradicate leftover English status/currency leaks in finance panels, enforce backend business invariants against auto-accepting paid tours, and secure registration status transitions post-lock. Do not touch map.md or map.log.

---

## TASK 16.6.1: Frontend - FA-IR Financial Typography & Error Mapping
* **Target Files**:
    - `apps/web/app/(app)/finance/components/admin-receipt-review-panel.tsx`
    - `apps/web/app/(app)/finance/components/payment-receipt-upload-panel.tsx`
    - `apps/web/app/(app)/finance/finance-copy.ts`
* **Technical Specification**:
    - **Currency & Amount Formatting**: Replace raw `payment.amount` counters with a localized Iranian formatter (`Intl.NumberFormat("fa-IR")`). Append the corporate Persian text badge (**تومان** / **ریال** based on context).
    - **Status Mapping**: Localize receipt statuses inline inside the rows. Convert `Pending` $\rightarrow$ **در انتظار بررسی** and `Approved` $\rightarrow$ **تایید شده**.
    - **Persian Error Registry**: Update your UI error handler connection (`mapToUserMessage`) for the finance components so that corporate banking errors or version conflicts (`REGISTRATION_ROW_VERSION_CONFLICT`) print explicit Persian toast alerts instead of leaking fallback English strings.

## TASK 16.6.2: Backend - Rigid Business Invariants For Paid Tours (Anti-Bypass)
* **Target File**: `apps/api/src/modules/tours/services/registrations.service.ts` (or your tour/registration validator)
* **Technical Specification**:
    - **Paid Auto-Accept Defuses**: Inside `resolveInitialRegistrationPlacement`, inject an absolute fail-closed invariant guard: If `tour.costContext?.requiresPayment === true` AND `tour.autoAcceptRegistrations === true`, force-override the status placement directly to `RegistrationStatus.PENDING` to completely neutralize the configuration bypass loophole (`PLACE-02`). Paid tours must unconditionally filter through the host approval gate.

## TASK 16.6.3: Backend - Post-Lock Race-Condition Verification
* **Target File**: `apps/api/src/modules/registrations/registrations.service.ts`
* **Technical Specification**:
    - **REG-LOCK-01 Fix**: In `updateRegistrationStatus`, locate the lines where `lockRegistrationForFinancialMutation` resolves.
    - Move or re-invoke the core optimistic concurrency asserts (`assertExpectedRegistrationRowVersion` and `validateStatusTransition`) **immediately AFTER** the database row receives its `pessimistic_write` transaction lock. This ensures validation executes exclusively on the absolute, non-stale database snapshot.

## TASK 16.6.4: Compilation Gate Verification
- Run `pnpm --filter @apps/web exec tsc --noEmit` and `pnpm --filter @apps/api exec tsc --noEmit`.
- Run the full E2E purchase simulation suite to secure 100% green status.


# DENALI TOUR WIZARD STATE RETENTION & ERROR MAP REFACTOR (PHASE 16.7)
Goal: Fix image/blob amnesia during step navigation, patch incomplete form resets by aligning canonical models and removing factory placeholders, and wire dynamic Persian error mappers for backend exceptions. Do not touch map.md or map.log.

---

## TASK 16.7.1: Frontend - Safeguard Photos/Blobs During Step Transitions
* **Target File**: `apps/web/src/features/tours/wizard/denali/DenaliCreateTourWizard.tsx`
* **Technical Specification**:
    - **Preserve Upload Identity**: Inside `handleNext`, modify the invocation of `reset(normalized, ...)`. Instead of sweeping the entire form state blindly, ensure that `photosData.photos` and any active `programNature.itinerary` day-photo arrays containing local `blob:` strings are cached or explicitly merged post-normalization to preserve their object identity and browser memory bindings.
    - Prevent the server-draft auto-sync loop from overwriting active client-side blob URLs with stale string states upon step changes.

## TASK 16.7.2: Frontend - Clean Reset Alignment & Purge Factory Placeholders
* **Target Files**:
    - `apps/web/src/features/tours/wizard/denali/DenaliCreateTourWizard.tsx`
    - `apps/web/src/features/tours/wizard/denali/denaliTourCreateBaseSchema.ts`
* **Technical Specification**:
    - **Erase Factory Strings**: Inside `denaliTourCreateBaseSchema.ts`, locate `buildDenaliTourCreateDefaultValues`. Completely purge the factory placeholder value `"abcdefghijabcdefghij"` and replace it with a clean empty string `""` (adjust intermediate step Zod checks so they don't block caching of incomplete draft titles).
    - **Canonical Reset Sync**: Inside `handleClearDraft`, ensure that right after `reset()`, the `setCanonicalModel` hook is explicitly fired with the fresh clean default values schema to prevent state desynchronization races between RHF and UI contexts.

## TASK 16.7.3: Frontend - Localize Tour Backend Error Envelopes
* **Target Files**:
    - `apps/web/src/features/tours/wizard/denali/utils/format-wizard-api-error.ts`
    - `apps/web/lib/errors/error-registry.ts`
* **Technical Specification**:
    - **Wire Translator Core**: Refactor `formatWizardApiErrorMessage`. Intercept the incoming `ApiError` and route its code through the project's standard `mapToUserMessage` helper.
    - **Add Missing Tour Codes**: Add explicit, highly supportive Persian translations inside `error-registry.ts` for dynamic tour creation blockers:
      - `VALIDATION_PROFILE_EDIT_REQUIRED_FIELD` $\rightarrow$ **«لطفاً فعالیت‌ها و برنامه‌ریزی روزهای تور را به طور کامل پر کنید.»**
      - `TOUR_NOT_PUBLISHABLE` $\rightarrow$ **«اطلاعات تور ناقص است. لطفاً پیش از انتشار، تمامی فیلدهای اجباری را تکمیل کنید.»**

## TASK 16.7.4: Quality Gate Check
- Run `pnpm --filter @apps/web exec tsc --noEmit` to guarantee 100% type safety.


# WIZARD CANONICAL RESET HARD-ALIGNMENT (PHASE 16.7.5)
Goal: Enforce immediate, cross-context truncation of `canonicalModel.title` upon executing the draft clear handler to ensure the title field completely clears out in the UI. Do not touch map.md or map.log.

---

## TASK 16.7.5.1: Frontend - Force Explicit Canonical Title Truncation on Clear
* **Target Files**:
    - `apps/web/src/features/tours/wizard/denali/DenaliCreateTourWizard.tsx`
    - `apps/web/src/features/tours/wizard/denali/steps/DenaliBasicInfoStep.tsx`
* **Technical Specification**:
    - Locate the `handleClearDraft` callback inside `DenaliCreateTourWizard.tsx`.
    - Ensure that inside the execution block (where `reset` and `setCanonicalSyncToken` are called), an explicit state dispatch is routed directly to invoke `updateCanonical({ title: "" })` or whatever immediate modifier purges the `canonicalModel` memory.
    - Open `DenaliBasicInfoStep.tsx`. Check the input field rendering `canonicalModel.title`. Ensure that if the value is empty or factory-reset, the HTML `<input>` value perfectly mirrors `""` without holding onto cache artifacts or local component state fallbacks.

## TASK 16.7.5.2: Verification Gate
- Run `pnpm --filter @apps/web exec tsc --noEmit` to achieve 100% type safety.

# TOUR EDIT SURFACE COMPLIANCE & ACTIVATION HARDENING (PHASE 16.8)
Goal: Inject missing Denali pilot geolocation / itinerary fields into the classic tour edit form, map specific publish invariant errors, and eliminate the 400 activation blockade. Do not touch map.md or map.log.

---

## TASK 16.8.1: Frontend - Inject Missing Geo-Location & Itinerary Fields into Edit Form
* **Target File**: `apps/web/src/components/tours/TourForm.tsx` (or your active classic edit form layout)
* **Technical Specification**:
    - **Add Adventure Geo Blocks**: If the current profile or theme resolves to `denali_pilot`, mount a clean Persian UI section for **«مختصات و نقاط جغرافیایی تور»**.
    - Expose fields for `tripDetails.overview.gatheringPoint` and `startPoint` (address string, latitude, and longitude inputs) so admins can fullfill the publish requirements right during editing.
    - Ensure that the `itinerary.days` and activities row counters are securely bound to avoid stripping out essential DB records upon submit save.

## TASK 16.8.2: Frontend - Register Premium Tour Activation Errors in Translator
* **Target Files**:
    - `apps/web/lib/errors/error-registry.ts`
    - `apps/web/src/features/tours/wizard/denali/utils/format-wizard-api-error.ts`
* **Technical Specification**:
    - **Inject Core Activation Codes**: Add explicit Persian translations into `error-registry.ts` for the following blocker constraints:
      - `DENALI_PUBLISH_REQUIRES_GEOLOCATION_ZONES` $\rightarrow$ **«انتشار تورهای دنالی نیازمند تعیین دقیق نقطه تجمع و آغاز سفر روی نقشه است.»**
      - `PAID_TOUR_REQUIRES_AMOUNT` $\rightarrow$ **«برای تورهای پولی، وارد کردن مبلغ کل هزینه الزامی است.»**
      - `INVALID_LIFECYCLE_TRANSITION` $\rightarrow$ **«تغییر وضعیت درخواستی برای این تور مجاز نمی‌باشد.»**

## TASK 16.8.3: Quality Compilation Gate
- Run `pnpm --filter @apps/web exec tsc --noEmit` to ensure zero compilation breaks.

# TOUR PEAK EXPERIENCE AUTO-APPROVAL GATE (PHASE 16.9)
Goal: Implement a "Peak-Experience" auto-approval bypass where travelers with sufficient past successful climbs automatically transition to `Accepted` status, skipping the manual host review gate. Do not touch map.md or map.log.

---

## TASK 16.9.1: Backend - Schema and Placement Bypass Logic
* **Target Files**:
    - `apps/api/src/modules/tours/entities/tour.entity.ts` (or `tripDetails` schema)
    - `apps/api/src/modules/registrations/registration.entity.ts` (or payload data)
    - `apps/api/src/modules/registrations/registrations.service.ts`
* **Technical Specification**:
    - **Tour Invariant**: Allow tours to hold a custom metadata field under `tripDetails.requirements.minRequiredPeaks` (integer, e.g., 1 to 4).
    - **Registration Intake**: Allow the traveler request to accept `participantMetadata.userPastPeaksCount` (integer filled by user).
    - **Auto-Approve Condition**: Open `registrations.service.ts` and locate `resolveInitialRegistrationPlacement`.
    - Update the logic: If the tour specifies a `minRequiredPeaks` AND the incoming traveler's `userPastPeaksCount` is greater than or equal to that number, forcefully return `{ status: RegistrationStatus.ACCEPTED, consumesAcceptedCapacity: true }`, completely bypassing the `Pending` state even for paid tours.

## TASK 16.9.2: Frontend - Inject Peak Counter inside Wizard & Form Sync
* **Target Files**:
    - `apps/web/src/features/tours/components/wizard/register-for-tour-client.tsx`
    - `apps/web/src/components/tours/TourForm.tsx`
* **Technical Specification**:
    - **Traveler Side**: Inside the registration wizard, if the tour type is a mountain/outdoor profile, inject a clean Persian `<Select>` or number input for **«تعداد قله‌های صعودشدهٔ اخیر با این آژانس»** (گزینه‌ها: بدون سابقه، ۱ قله، ۲ قله، ۳ قله، ۴ قله و بیشتر). Bind this to `participantMetadata.userPastPeaksCount`.
    - **Admin Side**: Inside the classic edit/creation form, add a counter field for **«حداقل قله‌های صعودشده جهت تایید خودکار مسافر»**.

## TASK 16.9.3: Verification Check
- Run `pnpm --filter @apps/web exec tsc --noEmit` and `pnpm --filter @apps/api exec tsc --noEmit` to hit 100% green compliance.

# ULTIMATE PRODUCTION POSTURE COMPLIANCE & FINANCIAL BLOCKADE (PHASE 16.10)
Goal: Fix the catastrophic `requiresPayment` deletion bug on edit save, enclose tour patch capacity checks in an explicit database transaction, and map the missing `VALIDATION_PROFILE_REQUIRED_FIELD` error code. Do not touch map.md or map.log.

---

## TASK 16.10.1: Frontend & BFF - Protect Paid-Tour Flags from Silent Clobbering
* **Target Files**:
    - `apps/web/src/features/tours/services/tours.service.ts` (`toUpdateTourApiBody`)
    - `apps/web/src/components/tours/TourForm.tsx`
* **Technical Specification**:
    - **Preserve Commercial Invariants**: Refactor `toUpdateTourApiBody`. Ensure that during the construction of the outgoing `cost_context` payload, the function explicitly spreads or retains the pre-loaded `existingCostContext.requiresPayment` state instead of blindly deleting it when the form field is absent.
    - Secure the object mapping chain so a passive textual save on a tour never converts a paid tour into a free configuration.

## TASK 16.10.2: Backend - Enclose Tour PATCH inside Strict Transaction Boundary
* **Target File**: `apps/api/src/modules/tours/tours.service.ts`
* **Technical Specification**:
    - **TOCTOU Capacity Guard**: Refactor the `updateTour` execution pipeline. Enclose the load, assertion merge, and save blocks inside an explicit `this.dataSource.transaction(async (manager) => { ... })` scope.
    - Re-invoke the live capacity condition check `if (dto.total_capacity < tour.acceptedCount)` exclusively after the row has securely received its `pessimistic_write` lock inside the transaction to prevent database counters drift under concurrent live registrations traffic.

## TASK 16.10.3: Frontend - Register Profile Required Constraint in Persian Dictionary
* **Target File**: `apps/web/lib/errors/error-registry.ts`
* **Technical Specification**:
    - **Translate System Blocker**: Add an explicit Persian mapping for the missing structural error code:
      - `VALIDATION_PROFILE_REQUIRED_FIELD` $\rightarrow$ **«اطلاعات ساختاری تور (مانند عنوان، قیمت پایه یا روزهای سفر) ناقص است. لطفاً ابتدا فرم پیش‌نویس را کامل کنید.»**
    - Register the canonical validation code token in the web array to ensure no 400 response from the API falls through to an unhandled English message screen.

## TASK 16.10.4: Ultimate Quality Gate
- Run `pnpm --filter @apps/web exec tsc --noEmit` and `pnpm --filter @apps/api exec tsc --noEmit`.
- Ensure the TypeScript compiler emits 100% green exit-code 0 status across the workspace.

# TOUR CLONING FIX & WORKSPACE GRID OPTIMIZATION (PHASE 16.11)
Goal: Remint nested photo IDs on tour duplication, apply React performance memoization to the workspace registrations table, and expose read-only/editable views for leaders and passenger requirements on the edit form. Do not touch map.md or map.log.

---

## TASK 16.11.1: Backend/Frontend - Remint Nested Photo IDs on Tour Copy
* **Target Files**:
    - `apps/api/src/modules/tours/services/tours-clone.service.ts` (or your active JSON clone helper)
    - `apps/web/src/features/tours/wizard/denali/utils/transformTourToDenaliWizardValues.ts`
* **Technical Specification**:
    - Locate the nested itinerary and gallery cloning utilities (`clonePhoto` or `mapDayPlanPhotos`).
    - Ensure that when a tour is duplicated, the system explicitly strips or re-generates brand-new UUID primary keys for all copied records inside the `photos[].id` arrays. This guarantees that child tour media assets do not alias or overwrite parent tour media references.

## TASK 16.11.2: Frontend - Optimize Workspace Grid via Memoization
* **Target Files**:
    - `apps/web/src/components/tours/workspace/RegistrationsTable.tsx`
    - `apps/web/src/components/tours/workspace/RegistrationTransportCrmCell.tsx`
* **Technical Specification**:
    - Wrap `RegistrationTransportCrmCell` in a strict `React.memo` container to prevent unnecessary repaints when sibling rows mutate.
    - Extract the table row `<tr>` mapping loop inside `RegistrationsTable.tsx` into a dedicated memoized row component (`RegistrationTableRow.tsx`). This eliminates heavy layout refetches from causing full table re-render lag when managing high-volume climber groups.

## TASK 16.11.3: Frontend - Surface Missing Controls on Classic Edit Form
* **Target File**: `apps/web/src/components/tours/TourForm.tsx`
* **Technical Specification**:
    - Expose a clean, visible section for **«راهنما و لیدرهای تور»** (`overview.leaderUserIds`) and passenger configuration toggles (like `sportsInsuranceRequired`) inside the flat edit matrix.
    - Ensure these fields are accurately hydrated from `toDefaultValues` and seamlessly bundled on PATCH instead of relying on invisible state retention.

## TASK 16.11.4: Compilation Verification
- Run `pnpm --filter @apps/web exec tsc --noEmit` to confirm 100% success.

# DB PURGE & WIZARD INTUITIVE ASSISTANCE INJECTION (PHASE 16.12)
Goal: Completely wipe out old mock tour seeds and wizard templates from the database migrations/seeders, replace them with clean-slate production configurations, and inject premium Persian helper tooltips across all complex adventure fields. Do not touch map.md or map.log.

---

## TASK 16.12.1: Backend - Drop Legacy Mock Tour Seeds & Keep Base Schemas
* **Target Files**:
    - `apps/api/src/database/seeds/` (or your active seeder/migration file creating mock tours)
    - `apps/api/src/modules/settings-locations/resolve-workspace-tour-form-profile.ts`
* **Technical Specification**:
    - Purge all factory-preset mock tours and old template data (like sample routes for `general` or legacy pre-filled rows).
    - Maintain only the strict baseline production constraints. Ensure that when a new workspace is created, its default template references a clean, blank slate configuration initialized directly to the required profile (e.g., `denali_pilot` or `mountain_outdoor`) without re-injecting zombie text inputs.

## TASK 16.12.2: Frontend - Inject Premium Persian Guidance Tooltips inside Wizard & Edit
* **Target Files**:
    - `apps/web/src/features/tours/wizard/denali/steps/DenaliBasicInfoStep.tsx`
    - `apps/web/src/components/tours/TourForm.tsx`
    - `apps/web/src/features/tours/wizard/denali/steps/DenaliPricingParticipantSection.tsx`
* **Technical Specification**:
    - **Contextual Guidance Boxes**: Add elegant micro tooltips or helper labels (`@/components/ui/tooltip` or clear sub-texts bearing strict `dir="rtl"`) right below/beside confusing administrative inputs:
      - **عنوان تور**: «نامی جذاب و کوتاه انتخاب کنید. نمونه: صعود زمستانه به دماوند جبهه جنوبی»
      - **نقاط جغرافیایی (تجمع و آغاز)**: «این دو نقطه روی نقشه برای متقاضیان الزامی است. نقطه تجمع جایی است که همسفران را سوار می‌کنید و نقطه آغاز، شروع پیمایش آفرود یا کوه است.»
      - **حداقل قله‌های صعودشده (شرط تایید خودکار)**: «با تنظیم این عدد، کوهنوردان باسابقه که این تعداد صندلی/قله را با شما صعود کرده‌اند، بدون نیاز به تایید دستی شما مستقیم به درگاه پرداخت هدایت می‌شوند.»
      - **الزامات بیمه و کد ملی**: «فعال کردن این تیک‌ها، مسافر را در فرم ثبت‌نام مجبور به وارد کردن کدملی دقیق و ارائه کارت بیمه ورزشی معتبر می‌کند.»

## TASK 16.12.3: Verification Gate Check
- Run `pnpm --filter @apps/web exec tsc --noEmit` and `pnpm --filter @apps/api exec tsc --noEmit`.
- Verify the creation flow launches completely empty, prompting the newly added Persian guidelines beautifully.


# WIZARD UI CLEANSE & FIELD PARITY ALIGNMENT (PHASE 16.12)
Goal: Fix the duplicated gathering place fields, fully expose the missing minRequiredPeaks constraints in creation mode, introduce absolute Draft/Active status toggles, and bypass the legacy auto-filled name template issue. Do not touch map.md or map.log.

---

## TASK 16.12.1: Frontend - Purge Duplicated Gathering Place & Fix Parity
* **Target Files**:
    - `apps/web/src/components/tours/TourForm.tsx`
    - `apps/web/src/features/tours/wizard/denali/steps/DenaliBasicInfoStep.tsx`
* **Technical Specification**:
    - Remove the legacy textual `gathering_place` row if the advanced geo-pinned mapping `tripDetails.location.gatheringPoint` is present.
    - Ensure only ONE shkil interactive map-picker and text address row is shown to the admin.

## TASK 16.12.2: Frontend - Force Expose Peak Experience Requirements during Creation
* **Target File**: `apps/web/src/components/tours/TourForm.tsx`
* **Technical Specification**:
    - Ensure that the conditional rule fields (`tripDetails.requirements.minRequiredPeaks` and `sportsInsuranceRequired`) are unconditionally visible during BOTH initial creation wizard and classic edit modes.
    - Remove any restrictive state-guards that hide these toggles before a tour is officially saved.

## TASK 16.12.3: Frontend - Add Explicit Status Toggle (Draft vs Active)
* **Target File**: `apps/web/src/components/tours/TourForm.tsx`
* **Technical Specification**:
    - Inject a beautiful premium Toggle or Select component for **«وضعیت انتشار تور»** linking directly to the `status` enum payload (`DRAFT` vs `ACTIVE/OPEN`).
    - This allows the admin to explicitly publish the tour or safely store it as a working draft.

## TASK 16.12.4: Compilation Gate Check
- Run `pnpm --filter @apps/web exec tsc --noEmit` and confirm exit 0.

# MULTI-STATION PICKUPS IN LOGISTICS & FORM CLEANSE (PHASE 16.12)
Goal: Move gathering points to a dynamic array in the Logistics tab, remove legacy time/place inputs from Basic Info, and fix cloning UUID reminting.

## TASK 16.12.1: Backend Contracts & Clone Engine
- In `packages/shared-contracts/src/tours/workspaces/denali-invariants.ts`, change `tripDetails.location.gatheringPoint` to `tripDetails.logistics.gatheringPoints` array.
- Update `checkDenaliPilotPublishGeolocationZones` to validate this new logistics array.
- Update `tours-clone.service.ts` to map over `gatheringPoints` and remint new UUIDs for every copied pickup station.

## TASK 16.12.2: Frontend Layout & Form Parity
- In `DenaliBasicInfoStep.tsx`, completely remove the old gathering text and singular departure time fields.
- In `DenaliLogisticsStep.tsx`, implement `useFieldArray` for `tripDetails.logistics.gatheringPoints` rendering title, time, and map-picker side-by-side.
- In `TourForm.tsx`, unconditionally expose the `minRequiredPeaks` toggle and add an explicit `DRAFT` vs `ACTIVE` status selector.

## TASK 16.12.3: Quality Gate
- Run `tsc --noEmit` across web and api packages to ensure 100% compilation.

## TASK 16.12.4: Compilation Gate Check
- Run `pnpm --filter @apps/web exec tsc --noEmit` and `pnpm --filter @apps/api exec tsc --noEmit` (exit 0).

# NESTED GATHERING PICKUP STATIONS (PHASE 16.13 — Option A)
Goal: Refactor `tripDetails.logistics.gatheringPoints` to nested `{ title, time, location }`, migrate legacy `overview.gatheringPoint` / flat blobs on read, and wire wizard + classic edit + API projection. Do not touch map.md or map.log.

---

## TASK 16.13.1: Shared Types & Canonical Mapping
* **Target Files**:
    - `packages/types/src/denali/gatheringPickupStation.ts`
    - `packages/types/src/denali/denaliCanonicalTourModel.ts`
    - `packages/types/src/denali/denaliCanonicalFromForm.ts`
    - `packages/types/src/index.ts`
* **Technical Specification**:
    - Introduce `DenaliGatheringPickupStation` with `normalizeGatheringPickupStation(s)`, `gatheringPickupStationIsConcrete`, `gatheringPickupStationFromLegacyLocation`, and `gatheringPickupStationToPersisted`.
    - Resolve `gatheringPoints` from `form.tripDetails.logistics.gatheringPoints` with fallback from legacy `basicInfo.gatheringPoint` / `meetingPoint`.

## TASK 16.13.2: Backend DTO, Invariants & Clone
* **Target Files**:
    - `apps/api/src/modules/tours/types/tour-trip-details.types.ts`
    - `apps/api/src/modules/tours/dto/trip-details.dto.ts`
    - `packages/shared-contracts/src/tours/workspaces/denali-invariants.ts`
    - `apps/api/src/modules/tours/services/tours-clone.service.ts`
* **Technical Specification**:
    - `TripDetailsGatheringPickupStation { title, time?, location }` on logistics.
    - Publish gate: non-empty array; **every** station must pass `gatheringPickupStationIsConcrete` (title + address + lat/lng).
    - Clone deep-copies `title/time/location` and remints location row ids.

## TASK 16.13.3: Frontend Schema, Widget & Projection
* **Target Files**:
    - `apps/web/src/features/tours/wizard/schemas/denaliGatheringPickupStation.schema.ts`
    - `apps/web/src/features/tours/wizard/denali/components/DenaliGatheringPointsWidget.tsx`
    - `apps/web/src/features/tours/wizard/denali/steps/DenaliBasicInfoStep.tsx`
    - `apps/web/src/components/tours/TourForm.tsx`
    - `apps/web/src/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection.ts`
    - `apps/web/src/features/tours/models/tourTripDetails.schema.ts`
    - `apps/web/src/components/tours/tour-schema.ts`
* **Technical Specification**:
    - RTL grid per row: **عنوان ایستگاه** | **ساعت حضور**; `Controller` on nested `location` for map patches.
    - Mount widget on Basic Info + classic edit; remove duplicate from Transport step; route-map zones exclude gathering (use `logistics.gatheringPoints` only).
    - Projection emits `logistics.gatheringPoints`; stop writing `overview.gatheringPoint`.

## TASK 16.13.4: Compilation & Spec Verification Gate
- Run `pnpm --filter @repo/types build` and `pnpm --filter @repo/shared-contracts build`.
- Run `pnpm --filter @apps/web exec tsc --noEmit` and `pnpm --filter @apps/api exec tsc --noEmit` (exit 0).
- Run API specs: `denali-publish-geolocation.spec.ts`, `tours-clone.service.unit-spec.ts`; web: `transformTourToDenaliWizardValues.spec.ts`.


# WIZARD UI DRIFT ALIGNMENT & CLEAN QA GATE (PHASE 16.14) (DONE)
Goal: Align legacy general logistics step inputs with the new tripDetails.logistics.gatheringPoints schema and purge deprecated single meetingPoint schemas.

## TASK 16.14.1: Frontend UI - General Logistics & Wizard Step Path Sync (DONE)
- File: `apps/web/src/components/tours/tour-create-trip-details-fields.tsx`
- File: `apps/web/src/features/tours/wizard/components/LogisticsStep.tsx`
- Action: Locate any legacy inputs bound to `logistics.gatheringPoints` (without prefix) or old singular paths.
- Fix: Synchronize and rewrite their form state bindings to strictly map onto the canonical nested contract path: `tripDetails.logistics.gatheringPoints`.

## TASK 16.14.2: Schema Sanitation - Deprecate Legacy Meeting Schema Fields (DONE)
- File: `packages/shared-contracts/src/tours/workspaces/denali-invariants.ts`
- File: `apps/api/src/modules/tours/dto/trip-details.dto.ts`
- Action: Find `meetingPoint` and `overview.gatheringPoint` entries inside the creation base validator schemas.
- Fix: Explicitly flag them as `@deprecated` or remove them from the creation payload requirements to secure a 100% blank slate with zero legacy parameters.

## TASK 16.14.3: Compilation Check (DONE)
- Action: Verify that running `tsc --noEmit` across both packages yields absolute 0 errors. (PASSED)



# WIZARD GEOLOCATION PURGE & FULL-STACK ARRAY INTEGRATION (PHASE 16.15) (DONE)
Goal: Strip old single location fields from Basic Info, embed the gatheringPoints array inside the Logistics tab, and update cloning, save-draft mutations, and all test specs to prevent regressions.

## TASK 16.15.1: Frontend UI - Declutter Basic Info Step (DONE)
- File: `apps/web/src/features/tours/wizard/denali/steps/DenaliBasicInfoStep.tsx`
- Action: Delete all JSX fields and map elements for `gathering_place`, `departure_time`, and single `gatheringPoint`.
- Content: Retain ONLY Title, Capacity, Leaders, and the Draft/Active Status selector.

## TASK 16.15.2: Frontend UI & Mutations - Logistics Tab & Draft State (DONE)
- File: `apps/web/src/features/tours/wizard/denali/steps/DenaliLogisticsStep.tsx`
- File: `apps/web/src/components/tours/TourForm.tsx`
- Action: Mount `useFieldArray` bound to `tripDetails.logistics.gatheringPoints` (with title, time, and MapPicker side-by-side).
- Payload Integration: Ensure both "Save Draft" and "Publish" handlers accurately include this `gatheringPoints` array in the mutation request payload instead of looking for old single object coordinates.

## TASK 16.15.3: Backend Invariants & Deep Cloning Array Integration (DONE)
- File: `packages/shared-contracts/src/tours/workspaces/denali-invariants.ts`
- File: `apps/api/src/modules/tours/services/tours-clone.service.ts`
- Action: Enforce that `checkDenaliPilotPublishGeolocationZones` validates the array path. Update the cloning engine to deep-copy the `gatheringPoints` array and remint clean UUIDs for every station row.

## TASK 16.15.4: Test Specs Compliance & Quality Gate (DONE)
- File: `apps/web/src/features/tours/wizard/denali/utils/transformTourToDenaliWizardValues.spec.ts`
- File: `apps/api/test/tours/tours-create.e2e-spec.ts`
- Action: Rewrite all mock payloads inside spec files to provide the arrayed `gatheringPoints` format instead of single object schemas to secure a green `tsc --noEmit` build code 0. (PASSED)

# WIZARD TEMPLATE SELECTOR & FULL-STACK DRAFT PARITY (PHASE 16.15) (DONE)
Goal: Replace ambiguous draft buttons with an explicit Multi-Template Select Component and an intelligent auto-draft rehydration mechanism, supporting the nested logistics array.

## TASK 16.15.1: Frontend UI - Declutter & Add Template Dropdown (DONE)
- File: `apps/web/src/features/tours/wizard/denali/steps/DenaliBasicInfoStep.tsx`
- Action 1: Completely delete legacy single location/time inputs to keep the view minimal. (DONE)
- Action 2: Mount a `<Select>` component for **«بارگذاری از روی تمپلیت‌های آماده»**. Fetch workspace templates and on change, populate form state using `reset()` or `setValue()` including the nested `tripDetails.logistics.gatheringPoints` array. (DONE)
- Action 3: Implement an auto-recovery prompt banner if a single active local draft exists, instead of an absolute static button. (DONE)

## TASK 16.15.2: Backend API - Template Resolver Multi-Parity (DONE)
- File: `apps/api/src/modules/settings-locations/resolve-workspace-tour-form-profile.ts`
- File: `apps/api/src/modules/tours/dto/trip-details.dto.ts`
- Action: Update the profile resolver to handle selective template IDs. Ensure that when a specific template is picked, its stored JSON array maps perfectly onto the new `gatheringPoints` schema topology. (DONE)

## TASK 16.15.3: Backend Core - Deep Clone & Invariants (DONE)
- File: `packages/shared-contracts/src/tours/workspaces/denali-invariants.ts`
- File: `apps/api/src/modules/tours/services/tours-clone.service.ts`
- Action: Ensure `checkDenaliPilotPublishGeolocationZones` loops through the array on publish. Confirm the cloning service deeply copies the array and remints brand-new UUIDs for every copied station row. (DONE)

## TASK 16.15.4: Compilation & Specs Validation (DONE)
- Action: Update all associated tour wizard `*.spec.ts` files to pass the new array payload structure. Run `tsc --noEmit` across web and api to secure code 0 success. (PASSED)

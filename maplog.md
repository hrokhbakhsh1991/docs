# EXECUTIVE WORKSPACE USERS CRM & LEDGER INTEGRATION (PHASE 14.8)
Goal: Purge low-level technical capabilities from the UI, bridge the identity-booking graph using synthetic phone matching, expose live wallet balances, display dynamic gender avatars, and surface trip metrics. Do not touch map.md or map.log.

---

## TASK 14.8.1: Backend - Implement Admin-Scoped Booking History & Stats
* **Target Files**:
    - `apps/api/src/modules/identity/workspace-users.controller.ts`
    - `apps/api/src/modules/registrations/registrations.service.ts`
* **Technical Specification**:
    - Create a new endpoint `GET /api/v2/workspaces/users/:userId/booking-summary` restricted to `Owner` and `Admin`.
    - Inside the handler, compute the `syntheticBookingContactPhone(userId)`.
    - Query `RegistrationEntity` where `tenantId` matches context AND (`participantContactPhone` OR `telegramUserId` matches user metrics).
    - Aggregate metrics into a clean response DTO:
      - `totalTrips`: Count of all rows.
      - `completedTrips`: Count where `status` NOT IN ('Cancelled', 'Rejected', 'NoShow') and departure date is past.
      - `cancelledTrips`: Count where `status` IN ('Cancelled', 'Rejected').
    - Strip and clean low-level raw capabilities from the core user response payload; hardcode them behind roles.

## TASK 14.8.2: Frontend - Enforce 4-Column High-Density CRM Layout
* **Target File**: `apps/web/app/(app)/users/users-page-client.tsx` (and related row layout sub-components)
* **Technical Specification**:
    - **The Purge**: Completely delete the raw technical capabilities checkbox grid from the interface.
    - **Column 1: User Profile (~35% width)**:
      - Mount `user-avatar.tsx` to automatically render the user's `profileImageUrl` or fall back to the SVG glyph dictated by the API's `gender` response.
      - Stack: Name (bold) -> Email/Phone -> Tiny relative activity label using `formatActiveAgoLabel(row.lastActiveAt)`.
    - **Column 2: Role (~15% width)**:
      - Render the custom workspace role badge (`OWNER`, `ADMIN`, `LEADER`, `MEMBER`).
    - **Column 3: Wallet & Loyalty Analytics (~40% width)**:
      - Clean vertical stack layout. Top line: Render the live currency balance from `loadBalancesForUserIds` formatted beautifully (e.g., `+۱,۲۰۰,۰۰۰ تومان` or `۰ ریال`).
      - Bottom line: Display the summary string fetched from Task 14.8.1: `{completedTrips} Ok / {cancelledTrips} Cancel`. Append active reward badges (`VIP_MEMBER`) as dense tags.
    - **Column 4: Actions (~10% width)**:
      - Right-aligned three-dots menu (`...`) hiding: "Change Role", "Manage Rewards & Selectable Leader Toggle", and "Remove User".

## TASK 14.8.3: Verification Gate
- Run `pnpm --filter @apps/web exec tsc --noEmit` and `pnpm --filter @apps/api exec tsc --noEmit`.
- Ensure all 29/29 E2E API tests remain perfectly green.

## TASK 14.8.4: Defensive Optimization & Clean-Code Constraints (گارد باگ‌زدایی و پرفارمنس)
* **Performance Rule (Anti N+1)**: Deep-refactor the list query logic. Under NO circumstances should `RegistrationsService` or `UsersMemberWalletBalancesService` execute sequential SQL lookups inside a loop per user row. Booking summaries and wallet balances for the entire page slice (e.g., 50 users) MUST be aggregated using a single `In(userIds)` query or an optimized SQL `GROUP BY` aggregate join.
* **JSONB Deep Merge Guarantee**: Inside `workspace-users.service.ts`, when modifying `membership_metadata`, use PostgreSQL `jsonb_set` or a strict shallow/deep spread merge. Updating the discount or leader status must NEVER overwrite or nullify existing `allowedRegionIds` or unrelated structural metadata keys.
* **UI Resiliency**: In `apps/web/app/(app)/users/user-avatar.tsx`, introduce a strict fallback chain for the `gender` prop. If the API returns `null`, empty string, or `prefer_not_to_say`, gracefully default to a clean, highly optimized neutral placeholder icon to avoid runtime client-side crashes.
* **Currency Isolation**: Ensure the batch wallet balance loader explicitly queries the balance matching the tenant's primary operating currency (e.g., 'IRR'), avoiding cross-currency balance numeric pollution.
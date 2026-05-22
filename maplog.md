# WORKSPACE USERS COMPREHENSIVE PURGE & FEATURE INJECTION (PHASE 14.8 - ULTIMATE)
Goal: Purge low-level technical capabilities from the UI, implement high-level business privileges, inject live wallet balances, display dynamic avatar fallbacks, and surface user activity metrics without introducing horizontal scrolling. Do not touch map.md or map.log.

---

## TASK 14.8.1: Backend - Core Entity Upgrades & Wallet / Activity Surface
* **Target Files**:
    - `apps/api/src/modules/identity/entities/user.entity.ts`
    - `apps/api/src/common/middleware/auth.middleware.ts`
    - `apps/api/src/modules/identity/workspace-users.service.ts`
* **Technical Specification**:
    - **Last Active Tracker**: Ensure `UserEntity` has a `lastActiveAt` column. Inside `AuthMiddleware`, asynchronously update this timestamp on every successful non-bypass request to track user vitality.
    - **The Purge**: Hardcode and seal low-level internal technical capabilities behind core roles. Hide them from standard user payload streams.
    - **Wallet Context**: Expose the live balance from `account_balances` associated with the user's personal account within the active tenant's ledger.
    - **Metadata Bounds**: Enforce strict limits on `membershipMetadata` (e.g., `permanentDiscountPercentage` bounded between 0 and 100).

## TASK 14.8.2: Frontend - Enterprise Clean Layout & Dynamic Asset Fallbacks
* **Target File**: `apps/web/app/(app)/users/users-page-client.tsx` (and related row/modal components)
* **Technical Specification**:
    - **Smart Avatars**: In the "User Profile" column, display the user's profile image. If the image string is null/absent, evaluate the user's `gender` field from the API response. Render a tailored, modern vector avatar indicator based on gender (Male / Female / Neutral fallback).
    - **Data Compaction (No Horizontal Scroll)**:
      - Column 1: **User Profile** (~35% width). Stacks: Smart Avatar + Bold Name + Sub-lines containing [Email/Phone] and a small gray relative time indicator for `Last Active` (e.g., "Active 2h ago").
      - Column 2: **Role** (~15% width). Displays the clean status badge.
      - Column 3: **Financials & Privileges** (~40% width). Displays the live **Wallet Balance** (formatted beautifully) alongside the wrap layout for `% Discount` and club tiers (`VIP_MEMBER`, `GOLD_CLUB`).
      - Column 4: **Actions** (~10% width). Right-aligned three-dots menu.
    - **Rewards Console**: Refactor `WorkspaceUserRewardsModal` to provide clean fields for: Permanent Discount %, Selectable Tour Leader switch, and a Loyalty Club tier select dropdown.

## TASK 14.8.3: Quality Gate Verification
- Run `pnpm --filter @apps/web exec tsc --noEmit` and `pnpm --filter @apps/api exec tsc --noEmit`.
- Run `jest test/api.e2e-spec.jest.ts` to ensure 100% green compliance.
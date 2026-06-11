# Phase 9.4 — Users Directory (Operator UX + RBAC architecture)

```yaml
ux_spec_id: USERS-DIRECTORY-UX
version: "2026-06-11-v2"
status: LOCKED
decisions: [DEC-P9-004, DEC-P9-008, DEC-P9-013, DEC-P9-015, DEC-P9-018, DEC-P9-019]
subphase: "9.4"
scope: "(app)/users directory + invites + role management — ownership transfer is separate round"
authority: subphases/9.4-users-rbac.md · users-api-dispatch-addendum.md · CASL-OPERATOR-SPEC.md
pattern: ADMIN-SHELL-UX.md · TOURS-LIST-UX.md
legacy_reference:
  - legacy/apps/web/app/(app)/users/
  - legacy/apps/web/app/(app)/users/users-page-client.tsx
  - legacy/apps/web/app/(app)/users/components/workspace-invite-modal.tsx
  - legacy/apps/web/app/(app)/users/users-directory-gate.ts
  - legacy/apps/api/src/common/rbac/workspace-membership-rbac.policy.ts
  - legacy/apps/api/src/modules/identity/workspace-users.service.ts
trunk_baseline:
  - packages/workspace-sdk/src/auth/tenant-auth-grants.ts
  - docs/phase-9/appendices/IDENTITY-PORT-SCOPE.md
```

> **Problem:** Operator admin needs a **production-grade team directory** — invite, pending queue, role change, remove, CSV export — with a **locked 3-tier RBAC** (`owner | admin | member`). Legacy persists five roles; trunk uses **mobile-first** UX on Phase 2 stack. Trunk `(app)/users` is **ABSENT**.

---

## 1. Gap analysis (audit 2026-06-08)

### 1.1 Documentation (resolved S9.4-R0)

| Artifact                         | Status                              | Notes                                         |
| -------------------------------- | ----------------------------------- | --------------------------------------------- |
| `9.4-users-rbac.md`              | **expanded**                        | Links USERS-DIRECTORY-UX · DEC-P9-015         |
| `users-api-dispatch-addendum.md` | **v2**                              | 3-tier invite roles · ownership transfer stub |
| `USERS-DIRECTORY-UX.md`          | **LOCKED**                          | Master users spec                             |
| `TRACEABILITY-MATRIX-9.4.md`     | **LOCKED**                          | REQ-P9-040..042                               |
| JSON schema                      | **USERS-DIRECTORY-ROW.schema.json** | List row + invite DTO contract                |
| `AGENT-STATE-MAP-9.4.yaml`       | **18 states**                       | 3-tier gates · migration                      |

### 1.2 Runtime (trunk — 2026-06-08)

| Layer                             | Status        | Notes                                            |
| --------------------------------- | ------------- | ------------------------------------------------ |
| `GET /users` + `POST /users/invite` | ✅ R1       | in-memory identity repo · `users.routes.ts`      |
| `GET /users/invites` + revoke/resend | ✅ R2      | `users.service.ts` · tenant-scoped queue         |
| `PATCH /users/{id}/role` + `DELETE /users/{id}` | ✅ R3      | rank policy · sessionVersion bump · not self/owner |
| `PATCH /users/{id}/rewards`                     | ✅ R4      | membership rewards metadata · admin/owner gate     |
| `POST /workspaces/{tenantId}/ownership-transfer` | ✅ R4   | owner-only · in-memory role swap + sessionVersion bump |
| `POST /auth/invite/{token}/accept` | ✅ R5      | authenticated accept · phone match · tenant scope  |
| Pending-invite OTP login           | ✅ R6      | `verify-otp` issues session when invite matches phone (SMK-P9-03) |
| `apps/web/app/auth/invite/[token]` | ✅ R5      | login redirect · post-login accept chain           |
| `apps/web/app/(app)/users/`       | ✅ R1+R4      | directory · pending · row actions · rewards modal   |
| `UserTenant.role` 3-tier enum     | ❌ pending 9.1 | `005_identity_production_delta.sql` not on trunk |
| `isAdminOrOwner` grant            | ✅ SDK        | wired in users handlers R1                       |
| `users-directory.spec.ts`         | ✅ R1+R2      | gate · tab query · pending landmarks             |
| `operator-smoke.spec.ts` SMK-P9-03 | ✅ R6 E2E    | Playwright invite → accept → directory member row |

### 1.3 Legacy parity inventory

| Feature            | Legacy                                | 9.4 target                                               |
| ------------------ | ------------------------------------- | -------------------------------------------------------- |
| Route              | `(app)/users`                         | same                                                     |
| Directory gate     | `isLeaderRole` (= owner **or** admin) | **`isOwner`** — DEC-P9-018 |
| Invite roles       | admin · member · viewer               | **admin · member · viewer** (DEC-P9-019)                 |
| Role filter        | 6 values incl. leader/viewer          | **all · owner · admin · member · viewer**                  |
| Tabs               | Active · Pending invites              | same                                                     |
| Search debounce    | 350ms                                 | same                                                     |
| Sort               | name · email asc/desc                 | same                                                     |
| Infinite scroll    | page size 50                          | same                                                     |
| Row actions        | change role · rewards · remove        | same (rewards admin/owner)                               |
| CSV export         | client-side filtered roster           | same                                                     |
| Locked panel       | sign-in · role-denied · empty · error | same semantics — rename `leader-denied` → `admin-denied` |
| Invite accept      | `/auth/invite/[token]`                | same                                                     |
| Ownership transfer | `POST .../ownership-transfer`         | **R5 UI** on `(app)/users` · logout after success        |

---

## 2. Design north star

| Principle                        | Implementation                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| **4 team roles**                 | Persisted `UserTenant.role` ∈ `{ owner, admin, member, viewer }` — DEC-P9-019 (amends DEC-P9-015) |
| **No finance/tour sub-roles**    | Tour mutate + finance = **admin/owner** + tenant modules — not a 4th role             |
| **Mobile-first**                 | Card list `<768px`; table `≥768px`; row actions → bottom sheet on mobile (DEC-P9-013) |
| **URL as SoT**                   | `DirectoryListUiState` ↔ `?search=&role=&sort=`                                       |
| **Permission preview on invite** | Role select shows 2-line capability summary (fa/en)                                   |
| **Fail-closed API**              | Member GET `/users` → **403** · never empty 200 with hidden rows                      |
| **Operator stack**               | Tailwind v4 + shadcn in `(app)/users/**` only (DEC-P9-013 R1)                         |
| **Legacy hydrate**               | DB `leader` → `admin` · `viewer` persisted as `viewer` (DEC-P9-019)                        |

---

## 3. RBAC model (DEC-P9-015 · DEC-P9-019)

### 3.1 Role rank

```text
owner (4) > admin (3) > member (2) > viewer (1)
```

Higher rank may modify lower-rank memberships subject to rules below. **Owner row is immutable** via general PATCH (ownership transfer is a dedicated flow).

### 3.2 Permission matrix (Denali workspace)

| Capability               | Owner  |     Admin      |     Member      |
| ------------------------ | :----: | :------------: | :-------------: |
| View `/users` directory  |   ✅   |       ❌       | ❌ locked panel |
| POST `/users/invite`     |   ✅   |       ✅       | ❌ 403 P9-F-005 |
| Invite as **admin**      |   ✅   |       ✅       |       ❌        |
| Invite as **member**     |   ✅   |       ✅       |       ❌        |
| PATCH role → admin       |   ✅   |      ✅\*      |       ❌        |
| PATCH role → member      |   ✅   |       ✅       |       ❌        |
| PATCH role → owner       | ❌\*\* |       ❌       |       ❌        |
| DELETE member (not self) |   ✅   |       ✅       |       ❌        |
| DELETE owner             |   ❌   |       ❌       |       ❌        |
| Remove self              |   ❌   |       ❌       |       ❌        |
| Rewards modal            |   ✅   |       ✅       |       ❌        |
| CSV export               |   ✅   |       ✅       |       ❌        |
| Create/edit tours        |   ✅   |       ✅       |  ❌ read only   |
| Finance module surfaces  |  ✅†   |      ✅†       |       ❌        |
| Urban owner settings     |   ✅   | ❌ RULE-P9-002 |       ❌        |

\* Admin may change another admin **only if** actor rank > target rank policy allows (typically owner changes admin; admin changes member only — see §3.4).  
\*\* Owner assignment only via `POST /workspaces/{tenantId}/ownership-transfer` (9.4-R2).  
† Requires tenant `enabled_modules` includes `finance`.

### 3.3 “Finance admin” and “Tour admin”

These are **not separate roles**:

| Product label     | Implementation                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| **Tour admin**    | User with `role=admin` (or owner) — `operator.tours.mutate` via `isAdminOrOwner`                             |
| **Finance admin** | User with `role=admin` (or owner) **and** tenant module `finance` — `operator.finance.read` + receipt review |

No per-user capability toggles in 9.4 MVP — module gating is **tenant-level** (legacy parity).

### 3.4 Role change rules (API + UI must mirror)

| Rule                     | Enforcement                                     |
| ------------------------ | ----------------------------------------------- |
| Self role change         | **403** `RBAC_SELF_ROLE_CHANGE_FORBIDDEN`       |
| Target is owner          | **403** — use ownership transfer                |
| Actor assigns owner      | **403** `RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN`  |
| Actor rank ≤ target rank | **403** `RBAC_INSUFFICIENT_ROLE_PRIVILEGE`      |
| Invite assignable roles  | `admin` \| `member` \| `viewer` (DEC-P9-019)      |
| Session invalidation     | Bump `UserTenant.sessionVersion` on role change |

**UI selectable roles (row menu):**

| Actor     | Can assign to others                                                                    |
| --------- | --------------------------------------------------------------------------------------- |
| **owner** | `admin`, `member`                                                                       |
| **admin** | `member` only (not admin→admin demotion of peers unless owner — match legacy rank gate) |

Port logic from `legacy/.../workspace-membership-rbac-ui.ts` adapted to 4 team roles (DEC-P9-019).

### 3.5 Legacy migration at hydrate

| Legacy `user_tenants.role` | Phase 9 persisted role |
| -------------------------- | ---------------------- |
| `owner`                    | `owner`                |
| `admin`                    | `admin`                |
| `leader`                   | `admin`                |
| `member`                   | `member`               |
| `viewer`                   | `viewer`               |

Normalization runs in `hydrateMembershipFromDb` **before** JWT/session response. One-time SQL migration may coalesce rows in 9.4 DDL note — document in `infra/sql/005_identity_production_delta.sql` addendum.

**Forbidden:** exposing `leader` in invite UI or role filter after 9.4 closure.

---

## 4. Information architecture

```text
(app)/users                          ← Directory (this spec)
(app)/users?tab=pending              ← Pending invites tab (URL or client tab state)
/auth/invite/[token]                 ← Accept flow (extends 9.1 auth tree)
```

### Navigation entry

From **9.2 OperatorShell** nav item `Users` → `(app)/users`. Visible only when **`isOwner`** (DEC-P9-018). Breadcrumb: Dashboard → Users.

---

## 5. API contract

Authority: [`users-api-dispatch-addendum.md`](users-api-dispatch-addendum.md) v2 · schema [`schemas/USERS-DIRECTORY-ROW.schema.json`](schemas/USERS-DIRECTORY-ROW.schema.json).

### 5.1 `GET /users`

| Param    | Type   | Notes                                                 |
| -------- | ------ | ----------------------------------------------------- |
| `search` | string | Name · phone · email substring                        |
| `role`   | enum   | `all` \| `owner` \| `admin` \| `member` \| `viewer` |
| `sort`   | token  | `name_asc` · `name_desc` · `email_asc` · `email_desc` |
| `cursor` | string | Opaque offset token — infinite scroll (R4)            |
| `limit`  | int    | Default **50** (legacy)                               |

**Response:** `{ items: WorkspaceDirectoryRow[], total: number, nextCursor?: string }`

**Gate:** `isOwner` (DEC-P9-018) → else **403** `USERS_DIRECTORY_FORBIDDEN`

### 5.2 `POST /users/invite`

```typescript
type InvitableWorkspaceRole = "admin" | "member" | "viewer";
```

```json
{ "phone": "+989...", "role": "admin" | "member" | "viewer", "nameNote": "optional" }
```

**Gate:** `isOwner` · inviter cannot assign role above own rank.

### 5.3 `PATCH /users/{userId}/role`

```json
{ "role": "admin" | "member" | "viewer" }
```

**Gate:** rank policy · owner grant forbidden · bump `sessionVersion`.

### 5.4 Suspend / reactivate (R1)

| Route | Effect |
| ----- | ------ |
| `PATCH /users/{userId}/suspend` | `status → SUSPENDED` · `sessionVersion++` · row stays in directory |
| `PATCH /users/{userId}/reactivate` | `status → ACTIVE` · `sessionVersion++` |

**UX (owner actor):**

- Active row: primary action **Suspend** (`actions.suspend`) — confirm dialog fa/en.
- Suspended row: badge **«معطل»** / `Suspended` + **Reactivate** action.
- Suspended members remain on the **Active** tab (not pending invites); CSV export includes `status` column.
- URL filter `?status=all|active|suspended` syncs to roster fetch: `GET /users?status=…` filters **server-side** before cursor pagination (large-roster parity). Web still mirrors filter chips in URL; BFF forwards query unchanged.
- Rank gate matches remove: owner cannot suspend self or another owner row.

### 5.5 Other routes

See dispatch addendum: revoke invite · accept token · DELETE user · PATCH rewards · ownership transfer (stub).

### 5.6 Pending-invite OTP session (R6 · SMK-P9-03)

When `POST /auth/verify-otp` finds a **user row** but **no ACTIVE membership**, it checks `listPendingInvitesByTenant` for an `INVITED` row whose `phone` matches the OTP mobile. On match:

1. API issues a normal RS256 `sessionToken` (`sess_ver: 1`, invited `role`, plus `workspace_id` shim — member role requires workspace at JWT ingress; value defaults to `ws-operator-smoke` / `TOUR_OPS_DEV_WORKSPACE_ID`).
2. Response includes `pendingInvite: true` (BFF maps to cookie via `login-web-session`).
3. Subsequent bearer requests hit `requireOperatorSession` → `hydrateMembershipFromDb` throws `AuthTokenRevokedError` → fallback `resolvePendingInviteAuth`.

**Synthetic auth context:** `resolvePendingInviteAuth` returns `status: "SUSPENDED"` (not `INVITED` — `MembershipStatus` SDK union is `ACTIVE | SUSPENDED` only). `isAuthzGranted` stays **false** until accept creates an ACTIVE membership. Accept route (`POST /auth/invite/{token}/accept`) only needs `userId` + `tenantId` + phone match — not full tenant grants.

**Login chain (web):** `login-web-session` → `GET /auth/ability-context` (200 with `canManageTenant: false`) → optional `POST /auth/invite/{token}/accept` when `?invite=` present → redirect `/dashboard`.

**Test fixture:** `seedOperatorIdentityFixture` seeds `OPERATOR_SMOKE.inviteeUserId` / `inviteMobile` **without** membership so `ID-9.1-03` and Playwright SMK-P9-03 exercise the pending-invite path (dev memory seed mirrors this in `seedOperatorSmokeDevFixture`).

### 5.7 Pending-invite resend OTP (R6)

Owner **Resend** on the pending tab calls `POST /users/invites/{inviteId}/resend`:

| Step | Behavior |
| ---- | -------- |
| 1 | API validates owner + tenant-scoped invite row |
| 2 | `createMobileOtpChallenge(phone)` — SMS/dev log delivery identical to login OTP |
| 3 | Rate limit per invitee mobile (10/min) — UI maps **429** `OTP_RATE_LIMITED` |
| 4 | Response includes `otpSent: true`; no `challengeId` in owner response |

**Invitee flow:** mobile login → authorized (pending invite exists) → request OTP → verify → `pendingInvite: true` session → accept invite link or dashboard accept when `?invite=` present.

**Web:** `handleResendInvite` refreshes pending list on success; errors use `users.errors.OTP_RATE_LIMITED` when backend returns that code.

### 5.8 Member detail drawer (R7)

Owner opens **Details** on an active roster row (desktop table + mobile card menu):

| Tab | Data source | UX |
| --- | ----------- | -- |
| **Activity history** | `GET /users/{id}/role-history` | Timeline: `eventKind` (`role_change` · `status_change` · `rewards_change` · `member_removed`) · actor mobile · timestamp |
| **Trips** | `GET /users/{id}/booking-summary` | Count chips + recent trip list (tour title · status · departure) |

Sheet component: `users-member-detail-sheet.tsx` · landmarks `operator-users-member-detail` · `operator-users-member-history` · `operator-users-member-trips`.

Empty states: no audit rows yet · no bookings submitted by member.

### 5.9 Bulk roster mutations (R8)

Desktop table supports checkbox selection on **manageable** rows (not self · not owner). Toolbar appears when ≥1 selected:

| Action | API | Notes |
| ------ | --- | ----- |
| Change role | `PATCH /users/bulk/role` `{ userIds, role }` | Same rank policy as single PATCH · audit per success |
| Suspend | `PATCH /users/bulk/suspend` `{ userIds }` | Skips already-suspended with failure row |
| Reactivate | `PATCH /users/bulk/reactivate` `{ userIds }` | Skips non-suspended with failure row |
| Remove | `POST /users/bulk/remove` `{ userIds }` | Same removal policy as `DELETE /users/{id}` |

**Response (all bulk routes):** `{ items: UsersDirectoryRow[], failures: { userId, code }[] }` — partial success allowed. Empty `userIds` → **400** `BULK_USER_IDS_REQUIRED`. Max **50** IDs per request → **400** `BULK_USER_IDS_LIMIT_EXCEEDED`.

**Web:** `users-directory-bulk-toolbar.tsx` · landmarks `operator-users-bulk-toolbar` · `operator-users-row-select` (desktop table **and** mobile cards `<768px`).

**Mobile bulk (R8+):** each manageable mobile card shows the same row checkbox as the desktop table; bulk toolbar appears above the card list when ≥1 selected (shared selection state).

---

## 6. Web UX specification

### 6.1 File tree (target)

```text
apps/web/app/(app)/users/
  page.tsx                    # RSC shell → UsersPageClient
  users-page-client.tsx
  users-directory-gate.ts     # resolveUsersDirectoryBodyState
  users-directory-ui-state.ts
  users-page-logic.ts         # sort · normalizeRole · roleLabel
  users-directory-table-card.tsx
  users-directory-locked-panel.tsx
  components/
    directory-tabs.tsx
    workspace-invite-modal.tsx
    pending-invites-table.tsx
    user-row-actions-menu.tsx
    workspace-user-rewards-modal.tsx
  users-page.module.css
```

### 6.2 Directory gate order

```text
1) Hydrate session
2) Signed out → sign-in EmptyState
3) !isOwner → locked EmptyState (admin/member denied — DEC-P9-018)
4) No API URL → unavailable
5) List loading
6) List error
7) Empty roster (no filters)
8) Directory with rows
```

### 6.3 Mobile wireframe (`<768px`)

```text
┌─────────────────────────────────────┐
│ Users                    [دعوت +]   │
│ [ اعضا | دعوت‌های معلق (۳) ]        │
│ [ جستجو........................ ]   │
│ [ نقش ▼ همه ]  [ مرتب‌سازی ▼ ]     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ (آ) علی رضایی                   │ │
│ │ admin · فعال          [ ⋮ ]     │ │
│ └─────────────────────────────────┘ │
│ ... cards · infinite scroll ...     │
└─────────────────────────────────────┘
```

**Desktop (≥768px):** responsive `<table>` — Name · Phone · Role · Status · Badges · Last active · Actions (inline).

**Mobile (`<768px`):** card list + **bottom sheet** for row actions (DEC-P9-013 R4); infinite scroll sentinel at list foot.

### 6.4 Invite modal

| Field     | Control      | Notes                                 |
| --------- | ------------ | ------------------------------------- |
| Phone     | `Input` tel  | Required · E.164 normalize            |
| Name note | `Input` text | Optional — localStorage parity legacy |
| Role      | `Select` / button group | **admin** · **member** · **viewer** (DEC-P9-019) |
| Preview   | static text (2 lines)     | Changes with role selection (R4)                 |

**Role preview copy (fa example):**

- **Admin:** «مدیریت تورها، کاربران، رزروها و تنظیمات.» / «دسترسی مالی در صورت فعال بودن ماژول.»
- **Member:** «مشاهده تورها و مدیریت رزروهای خود.» / «بدون دعوت یا تغییر نقش.»
- **Viewer:** «مشاهدهٔ read-only تورها و رزروها.» / «بدون دعوت، تغییر نقش یا تنظیمات.»

### 6.5 Role badges

| Role   | Token                 | Label fa |
| ------ | --------------------- | -------- |
| owner  | `--color-role-owner`  | مالک     |
| admin  | `--color-role-admin`  | مدیر     |
| member | `--color-role-member` | عضو      |

### 6.6 Pending invites tab

| Column                          | Actions                     |
| ------------------------------- | --------------------------- |
| Phone · Role · Created · Status | Revoke · Resend · Copy link |

Badge count on tab when `pendingCount > 0`.

### 6.7 Rewards modal (R2 · legacy parity)

| Field | Control | API field |
| ----- | ------- | --------- |
| Permanent discount | numeric input 0–100 | `permanentDiscountPercentage` |
| Loyalty tier | radio **none** · **VIP** · **GOLD** | `badges`: `VIP_MEMBER` \| `GOLD_CLUB` (mutually exclusive) |
| Selectable tour leader | checkbox | `isSelectableLeader` |
| Leader buddy badge | checkbox | `badges` includes `LEADER_BUDDY` |
| Labels | tag editor (add/remove chips, max 32 × 64 chars) | `labels[]` |

**Row micro-badges (desktop + mobile cards):** discount `%` chip · VIP · GOLD · label chips · «راهنما» when selectable leader · Leader buddy badge · suspended status column.

**Gate:** owner-only directory actor (DEC-P9-018).

### 6.8 Ownership transfer (R5)

Owner-only section at foot of `(app)/users` active tab.

| Step | UX |
| ---- | -- |
| 1 | Fetch roster candidates (`GET /users?limit=100`) — eligible: **ACTIVE** `admin` \| `member`, not self |
| 2 | Select new owner (native `<select>` or button group) |
| 3 | Confirm dialog (fa/en) — irreversible; previous owner becomes **admin** |
| 4 | BFF `POST /api/tenants/{tenantId}/ownership-transfer` → API `POST /workspaces/{tenantId}/ownership-transfer` `{ newOwnerUserId }` |
| 5 | Success → `POST /api/auth/logout` → redirect `/auth/login?access=ownership-transferred` |

**Landmarks:** `operator-users-ownership-transfer` · `operator-users-ownership-select` · `operator-users-ownership-submit`

**Post-transfer:** JWT/session cleared — former owner must OTP as **admin** (no owner panel until future admin shell).

### 6.9 CSV export

Client-side export of **currently loaded + filtered** roster (legacy parity). Filename: `users-{tenantSlug}-{iso-date}.csv`. Columns: name, phone, email, role, status.

---

## 7. Completion proof matrix

| ID        | Check                              | Pass                       |
| --------- | ---------------------------------- | -------------------------- |
| CP-9.4-01 | GET /users admin                   | 200 list                   |
| CP-9.4-02 | GET /users member                  | **403**                    |
| CP-9.4-03 | POST invite admin role             | 201                        |
| CP-9.4-04 | Accept invite → UserTenant         | integration                |
| CP-9.4-05 | Cross-tenant token                 | **403**                    |
| CP-9.4-06 | DELETE user                        | 204 · not self             |
| CP-9.4-07 | CSV export                         | web spec rows match filter |
| CP-9.4-08 | Rewards modal admin                | 200 PATCH                  |
| CP-9.4-09 | Invite UI admin · member · viewer  | DEC-P9-019                 |
| CP-9.4-10 | Legacy leader hydrates admin       | session role=admin         |
| CP-9.4-11 | Admin cannot PATCH owner role      | **403**                    |
| CP-9.4-12 | Mobile card layout `<768px`        | happy-dom width test       |
| CP-9.4-13 | URL sync search/role/sort          | query params round-trip    |
| CP-9.4-14 | sessionVersion bump on role change | old JWT **401**            |
| CP-9.4-15 | Urban admin on owner surface       | **403** RULE-P9-002        |

---

## 7.1 Implementation rounds (R1 focus)

| Round       | Deliverables                                      | Proof              |
| ----------- | ------------------------------------------------- | ------------------ |
| **S9.4-R0** | Doc pack · schema · traceability                  | `phase-9:guard`    |
| **S9.4-R1** | `GET /users` · `POST /users/invite` · directory UI | CP-9.4-01..03 · CP-9.4-09 |
| **S9.4-R2** | Pending invites tab · revoke/resend                 | CP-9.4-04          |
| **S9.4-R3** | Role PATCH · remove · rewards · CSV               | CP-9.4-06..08      |

---

## 8. Anti-hollow assertions

| ID        | Assertion                   | Detection                    |
| --------- | --------------------------- | ---------------------------- |
| AH-9.4-01 | Member POST invite          | **FAIL** P9-F-005            |
| AH-9.4-02 | Admin grants owner          | **FAIL**                     |
| AH-9.4-03 | Cross-tenant invite         | **403**                      |
| AH-9.4-04 | Urban admin widened         | **FAIL** RULE-P9-002         |
| AH-9.4-05 | Fifth role in UI            | **FAIL** DEC-P9-015          |
| AH-9.4-06 | Directory visible to member | **FAIL** — locked panel only |

---

## 9. Verification bundle

```bash
pnpm --filter @apps/api exec node --import tsx --test test/identity-users.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/users-directory.spec.ts
pnpm run phase-9:guard
```

---

## 10. Out of scope (9.4)

- Per-user finance/tour capability toggles (future labels/metadata)
- Marketing segment labels UI (legacy adapter deferred unless in COP waiver)

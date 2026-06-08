# Phase 9.4 — Users Directory (Operator UX + RBAC architecture)

```yaml
ux_spec_id: USERS-DIRECTORY-UX
version: "2026-06-08-v1"
status: LOCKED
decisions: [DEC-P9-004, DEC-P9-008, DEC-P9-013, DEC-P9-015]
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

### 1.2 Runtime (trunk)

| Layer                             | Exists         | Gap                                              |
| --------------------------------- | -------------- | ------------------------------------------------ |
| `apps/web/app/(app)/users/`       | ❌             | Full directory UI                                |
| `apps/api/src/identity/users*.ts` | ❌             | List · invite · role · remove                    |
| `UserTenant.role` 3-tier enum     | ❌ pending 9.1 | `005_identity_production_delta.sql` not on trunk |
| `isAdminOrOwner` grant            | ✅ SDK only    | Handlers pending 9.4 wiring                      |
| `users-directory.spec.ts`         | SCAFFOLD       | Behavioral tests absent                          |

### 1.3 Legacy parity inventory

| Feature            | Legacy                                | 9.4 target                                               |
| ------------------ | ------------------------------------- | -------------------------------------------------------- |
| Route              | `(app)/users`                         | same                                                     |
| Directory gate     | `isLeaderRole` (= owner **or** admin) | `isAdminOrOwner` — **same effective ACL**                |
| Invite roles       | admin · member · viewer               | **admin · member only** (DEC-P9-015)                     |
| Role filter        | 6 values incl. leader/viewer          | **all · owner · admin · member**                         |
| Tabs               | Active · Pending invites              | same                                                     |
| Search debounce    | 350ms                                 | same                                                     |
| Sort               | name · email asc/desc                 | same                                                     |
| Infinite scroll    | page size 50                          | same                                                     |
| Row actions        | change role · rewards · remove        | same (rewards admin/owner)                               |
| CSV export         | client-side filtered roster           | same                                                     |
| Locked panel       | sign-in · role-denied · empty · error | same semantics — rename `leader-denied` → `admin-denied` |
| Invite accept      | `/auth/invite/[token]`                | same                                                     |
| Ownership transfer | `POST .../ownership-transfer`         | **9.4-R2** optional · document stub in dispatch          |

---

## 2. Design north star

| Principle                        | Implementation                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| **3 roles only**                 | Persisted `UserTenant.role` ∈ `{ owner, admin, member }` — DEC-P9-015                 |
| **No finance/tour sub-roles**    | Tour mutate + finance = **admin/owner** + tenant modules — not a 4th role             |
| **Mobile-first**                 | Card list `<768px`; table `≥768px`; row actions → bottom sheet on mobile (DEC-P9-013) |
| **URL as SoT**                   | `DirectoryListUiState` ↔ `?search=&role=&sort=`                                       |
| **Permission preview on invite** | Role select shows 2-line capability summary (fa/en)                                   |
| **Fail-closed API**              | Member GET `/users` → **403** · never empty 200 with hidden rows                      |
| **Phase 2 stack**                | `@app-tour/ui-primitives` + CSS Modules (DEC-P9-013)                                  |
| **Legacy hydrate**               | DB `leader` → `admin` · `viewer` → `member` at session hydrate                        |

---

## 3. RBAC model (DEC-P9-015)

### 3.1 Role rank

```text
owner (3) > admin (2) > member (1)
```

Higher rank may modify lower-rank memberships subject to rules below. **Owner row is immutable** via general PATCH (ownership transfer is a dedicated flow).

### 3.2 Permission matrix (Denali workspace)

| Capability               | Owner  |     Admin      |     Member      |
| ------------------------ | :----: | :------------: | :-------------: |
| View `/users` directory  |   ✅   |       ✅       | ❌ locked panel |
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
| Invite assignable roles  | `admin` \| `member` only                        |
| Session invalidation     | Bump `UserTenant.sessionVersion` on role change |

**UI selectable roles (row menu):**

| Actor     | Can assign to others                                                                    |
| --------- | --------------------------------------------------------------------------------------- |
| **owner** | `admin`, `member`                                                                       |
| **admin** | `member` only (not admin→admin demotion of peers unless owner — match legacy rank gate) |

Port logic from `legacy/.../workspace-membership-rbac-ui.ts` adapted to 3 roles.

### 3.5 Legacy migration at hydrate

| Legacy `user_tenants.role` | Phase 9 persisted role |
| -------------------------- | ---------------------- |
| `owner`                    | `owner`                |
| `admin`                    | `admin`                |
| `leader`                   | `admin`                |
| `member`                   | `member`               |
| `viewer`                   | `member`               |

Normalization runs in `hydrateMembershipFromDb` **before** JWT/session response. One-time SQL migration may coalesce rows in 9.4 DDL note — document in `infra/sql/005_identity_production_delta.sql` addendum.

**Forbidden:** exposing `leader` or `viewer` in invite UI or role filter after 9.4 closure.

---

## 4. Information architecture

```text
(app)/users                          ← Directory (this spec)
(app)/users?tab=pending              ← Pending invites tab (URL or client tab state)
/auth/invite/[token]                 ← Accept flow (extends 9.1 auth tree)
```

### Navigation entry

From **9.2 OperatorShell** nav item `Users` → `(app)/users`. Visible only when `isAdminOrOwner`. Breadcrumb: Dashboard → Users.

---

## 5. API contract

Authority: [`users-api-dispatch-addendum.md`](users-api-dispatch-addendum.md) v2 · schema [`schemas/USERS-DIRECTORY-ROW.schema.json`](schemas/USERS-DIRECTORY-ROW.schema.json).

### 5.1 `GET /users`

| Param    | Type   | Notes                                                 |
| -------- | ------ | ----------------------------------------------------- |
| `search` | string | Name · phone · email substring                        |
| `role`   | enum   | `all` \| `owner` \| `admin` \| `member`               |
| `sort`   | token  | `name_asc` · `name_desc` · `email_asc` · `email_desc` |
| `cursor` | string | Opaque — infinite scroll                              |
| `limit`  | int    | Default **50** (legacy)                               |

**Response:** `{ items: WorkspaceDirectoryRow[], nextCursor?: string }`

**Gate:** `isAdminOrOwner` → else **403** `OPERATOR_FORBIDDEN`

### 5.2 `POST /users/invite`

```typescript
type InvitableWorkspaceRole = "admin" | "member";
```

```json
{ "phone": "+989...", "role": "admin" | "member", "nameNote": "optional" }
```

**Gate:** `isAdminOrOwner` · inviter cannot assign role above own rank.

### 5.3 `PATCH /users/{userId}/role`

```json
{ "role": "admin" | "member" }
```

**Gate:** rank policy · owner grant forbidden · bump `sessionVersion`.

### 5.4 Other routes

See dispatch addendum: revoke invite · accept token · DELETE user · PATCH rewards · ownership transfer (stub).

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
3) !isAdminOrOwner → admin-denied EmptyState (legacy leader-denied)
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

**Desktop:** table columns — Avatar · Name · Phone · Role badge · Status · Actions.

### 6.4 Invite modal

| Field     | Control      | Notes                                 |
| --------- | ------------ | ------------------------------------- |
| Phone     | `Input` tel  | Required · E.164 normalize            |
| Name note | `Input` text | Optional — localStorage parity legacy |
| Role      | `Select`     | **admin** · **member**                |
| Preview   | static text  | Changes with role selection           |

**Role preview copy (fa example):**

- **Admin:** «مدیریت تورها، کاربران، رزروها و تنظیمات. دسترسی مالی در صورت فعال بودن ماژول.»
- **Member:** «مشاهده تورها و مدیریت رزروهای خود. بدون دعوت یا تغییر نقش.»

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

### 6.7 CSV export

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
| CP-9.4-09 | Invite UI 2 roles only             | no viewer/leader option    |
| CP-9.4-10 | Legacy leader hydrates admin       | session role=admin         |
| CP-9.4-11 | Admin cannot PATCH owner role      | **403**                    |
| CP-9.4-12 | Mobile card layout `<768px`        | happy-dom width test       |
| CP-9.4-13 | URL sync search/role/sort          | query params round-trip    |
| CP-9.4-14 | sessionVersion bump on role change | old JWT **401**            |
| CP-9.4-15 | Urban admin on owner surface       | **403** RULE-P9-002        |

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
- Full ownership-transfer UI (stub API only in 9.4-R2)
- Marketing segment labels UI (legacy adapter deferred unless in COP waiver)

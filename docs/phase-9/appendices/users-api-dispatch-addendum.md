# Phase 9.4 — Users & invites API dispatch addendum

```yaml
addendum_id: DISPATCH-P9-USERS
version: "2026-06-08-v2"
authority: USERS-DIRECTORY-UX.md · IDENTITY-PORT-SCOPE.md · CASL-OPERATOR-SPEC.md · DEC-P9-004 · DEC-P9-015
target: apps/api/src/openapi/dispatch-routes.ts
```

## Dispatch operations (9.4)

| operationId          | Method | Path                                        | Handler                                             | CASL gate                                      |
| -------------------- | ------ | ------------------------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| `listUsers`          | GET    | `/users`                                    | `identity/users.list.handler.ts`                    | **`isOwner`** (DEC-P9-018)                     |
| `inviteUser`         | POST   | `/users/invite`                             | `identity/invites.create.handler.ts`                | **`isOwner`** · role ∈ `{admin,member,viewer}`   |
| `revokeInvite`       | DELETE | `/users/invites/{inviteId}`                 | `identity/invites.revoke.handler.ts`                | **`isOwner`**                                  |
| `resendInvite`       | POST   | `/users/invites/{inviteId}/resend`          | `identity/invites.resend.handler.ts`                | **`isOwner`**                                  |
| `listPendingInvites` | GET    | `/users/invites`                            | `identity/invites.list.handler.ts`                  | **`isOwner`**                                  |
| `acceptInvite`       | POST   | `/auth/invite/{token}/accept`               | `identity/invites.accept.handler.ts`                | anonymous + token                              |
| `patchUserRole`      | PATCH  | `/users/{userId}/role`                      | `identity/users.role.handler.ts`                    | rank policy · **no owner assign**              |
| `removeUser`         | DELETE | `/users/{userId}`                           | `identity/users.remove.handler.ts`                  | **`isOwner`** · rank policy · not self         |
| `patchUserRewards`   | PATCH  | `/users/{userId}/rewards`                   | `identity/users.rewards.handler.ts`                 | **`isOwner`** · rank policy                    |
| `suspendUser`        | PATCH  | `/users/{userId}/suspend`                   | `identity/users.suspend.handler.ts`                 | rank policy · **owner panel** · not self       |
| `reactivateUser`     | PATCH  | `/users/{userId}/reactivate`                | `identity/users.reactivate.handler.ts`              | rank policy · **owner panel** · not self       |
| `transferOwnership`  | POST   | `/workspaces/{tenantId}/ownership-transfer` | `identity/workspaces.ownership-transfer.handler.ts` | **owner only** · R5 UI on `(app)/users`          |

## Invite DTO (DEC-P9-015)

```typescript
export type InvitableWorkspaceRole = "admin" | "member" | "viewer";

export type InviteUserRequest = {
  phone: string;
  role: InvitableWorkspaceRole;
  nameNote?: string;
};
```

**Forbidden:** `leader` · `owner` on invite body.

## Role PATCH DTO

```typescript
export type PatchUserRoleRequest = {
  role: "admin" | "member" | "viewer";
};
```

**Forbidden:** `owner` in PATCH body — use `transferOwnership`.

## Suspend / reactivate (R1 · legacy block parity)

| operationId      | Method | Path                           | Body | Success |
| ---------------- | ------ | ------------------------------ | ---- | ------- |
| `suspendUser`    | PATCH  | `/users/{userId}/suspend`      | none | **200** updated `UsersDirectoryRow` |
| `reactivateUser` | PATCH  | `/users/{userId}/reactivate`   | none | **200** updated `UsersDirectoryRow` |

**Semantics:**

- Sets `membership.status` to `SUSPENDED` or `ACTIVE` (not delete).
- Bumps `sessionVersion` on transition — invalidates existing JWT for that member.
- Same rank policy as `removeUser`: actor rank must exceed target; no self; owner row protected.
- Suspend when already `SUSPENDED` → **409** `MEMBERSHIP_ALREADY_SUSPENDED`.
- Reactivate when not `SUSPENDED` → **409** `MEMBERSHIP_NOT_SUSPENDED`.
- Directory list (`GET /users`) includes `SUSPENDED` rows with `status` field (legacy parity).

**Gate:** `isOwner` (DEC-P9-018) on `(app)/` panel — API still uses rank policy for future admin panel.

## List query params

| Param    | Values                                                   |
| -------- | -------------------------------------------------------- |
| `search` | string                                                   |
| `role`   | `all` \| `owner` \| `admin` \| `member` \| `viewer`      |
| `status` | `all` (default) \| `active` (`ACTIVE` only) \| `suspended` (`SUSPENDED` only) — applied before sort/cursor |
| `sort`   | `name_asc` \| `name_desc` \| `email_asc` \| `email_desc` — contact sort uses `email` then `phone` then `displayName` |
| `cursor` | opaque offset token (R4)                                 |
| `limit`  | default 50                                               |

**List response:** `{ items, total, nextCursor? }` — `nextCursor` omitted when roster exhausted.

## Invite resend OTP (R6 · SMK-P9-03)

`POST /users/invites/{inviteId}/resend` (owner-only, same gate as invite create):

1. Loads pending invite for actor tenant; **404** `INVITE_NOT_FOUND` when missing or cross-tenant.
2. Calls `createMobileOtpChallenge(invite.phone)` — same delivery path as `POST /auth/request-otp` (`deliverOtpCode` / Resend SMS when configured).
3. Shares login OTP rate limit (`assertOtpRequestRateLimit`) keyed by invitee mobile — **429** `OTP_RATE_LIMITED` (10 requests / 60s window).
4. Response **200** — pending row plus `otpSent: true`. **`challengeId` is never returned** to the owner (invitee obtains it only via their own login OTP request after phone preflight passes).

Invitee login after resend: preflight → request-otp (may hit rate limit if owner spammed resend) → verify-otp → pending-invite session (§5.6 in USERS-DIRECTORY-UX) → accept.

## Member context read paths (R7)

| Route | Method | Gate | Response |
| ----- | ------ | ---- | -------- |
| `/users/{userId}/role-history` | GET | **`isOwner`** · membership must exist in tenant (or existed before remove — last 50 events) | `{ items: UserRoleHistoryItem[] }` — `eventKind`: `role_change` \| `status_change` \| `rewards_change` \| `member_removed` |
| `/users/{userId}/booking-summary` | GET | **`isOwner`** · membership must exist | `UserBookingSummaryResponse` |

**Role audit write path:** `PATCH /users/{userId}/role` and `POST /workspaces/{tenantId}/ownership-transfer` append rows to `operator_user_role_audit` (memory or Prisma). Each row: `actorUserId`, `actorMobile` (trunk has no email on `User`), `oldRole`, `newRole`, `createdAt`. List capped at **50** newest-first.

**Booking summary:** tenant-scoped bookings where `submittedByUserId === userId`. Counts: `totalTrips`, `completedTrips` (approved/waitlisted/pending with departure before today UTC), `cancelledTrips` (cancelled/rejected). `trips` — up to **10** recent rows sorted by `departureAt` desc.

**Errors:** missing membership → **404** `MEMBERSHIP_NOT_FOUND`.

## Bulk mutations (R8)

| Route | Method | Body | Response |
| ----- | ------ | ---- | -------- |
| `/users/bulk/role` | PATCH | `{ userIds: string[], role }` | `{ items, failures }` |
| `/users/bulk/suspend` | PATCH | `{ userIds: string[] }` | `{ items, failures }` |
| `/users/bulk/reactivate` | PATCH | `{ userIds: string[] }` | `{ items, failures }` |
| `/users/bulk/remove` | POST | `{ userIds: string[] }` | `{ items, failures }` |

Gate: **`isOwner`**. Per-target RBAC matches single-user routes. Role changes append audit rows. Limits: 1–50 unique UUIDs.

| Code | HTTP | When |
| ---- | ---- | ---- |
| `BULK_USER_IDS_REQUIRED` | 400 | Empty or missing `userIds` |
| `BULK_USER_IDS_LIMIT_EXCEEDED` | 400 | More than 50 IDs |

## Rank policy errors

| Code                                         | HTTP | When                          |
| -------------------------------------------- | ---- | ----------------------------- |
| `RBAC_SELF_ROLE_CHANGE_FORBIDDEN`            | 403  | Actor patches self            |
| `RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN`       | 403  | PATCH or invite assigns owner |
| `RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN` | 403  | Target is owner **or** mutation would leave zero ACTIVE owners (P1.3-A policy) |
| `RBAC_INSUFFICIENT_ROLE_PRIVILEGE`           | 403  | Actor rank ≤ target           |
| `INVITE_ACCEPT_OWNER_PROTECTED`              | 403  | Accept would overwrite an existing **owner** `UserTenant` |
| `INVITE_ACCEPT_MEMBERSHIP_EXISTS`            | 409  | Accept when membership already exists (active **or** suspended); not an implicit reactivate |
| `INVITE_ALREADY_PENDING`                     | 409  | POST invite when an **INVITED** row already exists for `(tenantId, normalized phone)`; body includes existing `inviteId` |
| `INVITE_EXPIRED`                             | 410  | Accept after `expiresAt` (lazy `INVITED → EXPIRED`) |
| `INVITE_REVOKED`                             | 410  | Accept on owner-revoked row |
| `INVITE_ALREADY_ACCEPTED`                    | 410  | Accept replay on consumed invite |
| `MEMBERSHIP_ALREADY_SUSPENDED`               | 409  | PATCH suspend on SUSPENDED row |
| `MEMBERSHIP_NOT_SUSPENDED`                   | 409  | PATCH reactivate on ACTIVE row |
| `OPERATOR_FORBIDDEN`                         | 403  | Member on admin surface       |

**Invite accept invariant:** `POST /auth/invite/{token}/accept` creates a membership only when no `UserTenant` exists for `(userId, invite.tenantId)`. Existing rows are never upserted (role / status / `sessionVersion` unchanged; invite row not consumed). See [`invite-accept-membership-invariant.mdoc`](invite-accept-membership-invariant.mdoc).

**Active invite uniqueness:** `POST /users/invite` allows at most one **INVITED** row per `(tenantId, normalized phone)`. Duplicate create → **409** `INVITE_ALREADY_PENDING` (existing `inviteId` in body). See [`invite-active-uniqueness-invariant.mdoc`](invite-active-uniqueness-invariant.mdoc).

**Invite lifecycle / TTL:** Pending invites carry `expiresAt` (default 7d). Accept before expiry; after expiry → **410** `INVITE_EXPIRED`. Revoke → **410** `INVITE_REVOKED`. Rows retained as `ACCEPTED` / `EXPIRED` / `REVOKED`. Resend (R6) does **not** extend TTL or rotate token. See [`invite-lifecycle-invariant.mdoc`](invite-lifecycle-invariant.mdoc).

**Owner cardinality (P1.3-B):** exactly one `UserTenant` with `role=owner` **and** `status=ACTIVE` per tenant. Enforced in `users.service` / `invites.service` via `users-rbac.policy.ts`. See [`owner-cardinality-invariant.mdoc`](owner-cardinality-invariant.mdoc).

## Urban regression (RULE-P9-002)

Urban tenant user management surfaces that touch **owner-only product config** must still call `assertWorkspaceOwner` — not `isAdminOrOwner`.

## Literal insertion block

```typescript
export const USERS_OPERATOR_DISPATCH = [
  {
    operationId: "listUsers",
    method: "GET",
    path: "/users",
    handler: "identity/users.list.handler",
  },
  {
    operationId: "inviteUser",
    method: "POST",
    path: "/users/invite",
    handler: "identity/invites.create.handler",
  },
  {
    operationId: "listPendingInvites",
    method: "GET",
    path: "/users/invites",
    handler: "identity/invites.list.handler",
  },
  {
    operationId: "patchUserRole",
    method: "PATCH",
    path: "/users/{userId}/role",
    handler: "identity/users.role.handler",
  },
  {
    operationId: "removeUser",
    method: "DELETE",
    path: "/users/{userId}",
    handler: "identity/users.remove.handler",
  },
  {
    operationId: "suspendUser",
    method: "PATCH",
    path: "/users/{userId}/suspend",
    handler: "identity/users.suspend.handler",
  },
  {
    operationId: "reactivateUser",
    method: "PATCH",
    path: "/users/{userId}/reactivate",
    handler: "identity/users.reactivate.handler",
  },
  {
    operationId: "getUserRoleHistory",
    method: "GET",
    path: "/users/{userId}/role-history",
    handler: "identity/users.role-history.handler",
  },
  {
    operationId: "getUserBookingSummary",
    method: "GET",
    path: "/users/{userId}/booking-summary",
    handler: "identity/users.booking-summary.handler",
  },
  {
    operationId: "patchUserRewards",
    method: "PATCH",
    path: "/users/{userId}/rewards",
    handler: "identity/users.rewards.handler",
  },
  {
    operationId: "resendPendingInvite",
    method: "POST",
    path: "/users/invites/{inviteId}/resend",
    handler: "identity/invites.resend.handler",
  },
  {
    operationId: "revokePendingInvite",
    method: "DELETE",
    path: "/users/invites/{inviteId}",
    handler: "identity/invites.revoke.handler",
  },
  {
    operationId: "transferWorkspaceOwnership",
    method: "POST",
    path: "/workspaces/{tenantId}/ownership-transfer",
    handler: "identity/users.ownership-transfer.handler",
  },
  {
    operationId: "bulkPatchUserRoles",
    method: "PATCH",
    path: "/users/bulk/role",
    handler: "identity/users.bulk-role.handler",
  },
  {
    operationId: "bulkSuspendUsers",
    method: "PATCH",
    path: "/users/bulk/suspend",
    handler: "identity/users.bulk-suspend.handler",
  },
  {
    operationId: "bulkReactivateUsers",
    method: "PATCH",
    path: "/users/bulk/reactivate",
    handler: "identity/users.bulk-reactivate.handler",
  },
  {
    operationId: "bulkRemoveUsers",
    method: "POST",
    path: "/users/bulk/remove",
    handler: "identity/users.bulk-remove.handler",
  },
] as const;
```

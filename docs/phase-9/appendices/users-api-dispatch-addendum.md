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
| `listUsers`          | GET    | `/users`                                    | `identity/users.list.handler.ts`                    | `isAdminOrOwner`                               |
| `inviteUser`         | POST   | `/users/invite`                             | `identity/invites.create.handler.ts`                | `isAdminOrOwner` · role ∈ `{admin,member}`     |
| `revokeInvite`       | DELETE | `/users/invites/{inviteId}`                 | `identity/invites.revoke.handler.ts`                | `isAdminOrOwner`                               |
| `resendInvite`       | POST   | `/users/invites/{inviteId}/resend`          | `identity/invites.resend.handler.ts`                | `isAdminOrOwner`                               |
| `listPendingInvites` | GET    | `/users/invites`                            | `identity/invites.list.handler.ts`                  | `isAdminOrOwner`                               |
| `acceptInvite`       | POST   | `/auth/invite/{token}/accept`               | `identity/invites.accept.handler.ts`                | anonymous + token                              |
| `patchUserRole`      | PATCH  | `/users/{userId}/role`                      | `identity/users.role.handler.ts`                    | rank policy · **no owner assign**              |
| `removeUser`         | DELETE | `/users/{userId}`                           | `identity/users.remove.handler.ts`                  | `isAdminOrOwner` · not self · not owner target |
| `patchUserRewards`   | PATCH  | `/users/{userId}/rewards`                   | `identity/users.rewards.handler.ts`                 | `isAdminOrOwner`                               |
| `transferOwnership`  | POST   | `/workspaces/{tenantId}/ownership-transfer` | `identity/workspaces.ownership-transfer.handler.ts` | **owner only** · 9.4-R3 stub                   |

## Invite DTO (DEC-P9-015)

```typescript
export type InvitableWorkspaceRole = "admin" | "member";

export type InviteUserRequest = {
  phone: string;
  role: InvitableWorkspaceRole;
  nameNote?: string;
};
```

**Forbidden:** `leader` · `viewer` · `owner` on invite body.

## Role PATCH DTO

```typescript
export type PatchUserRoleRequest = {
  role: "admin" | "member";
};
```

**Forbidden:** `owner` in PATCH body — use `transferOwnership`.

## List query params

| Param    | Values                                                   |
| -------- | -------------------------------------------------------- |
| `search` | string                                                   |
| `role`   | `all` \| `owner` \| `admin` \| `member`                  |
| `sort`   | `name_asc` \| `name_desc` \| `email_asc` \| `email_desc` |
| `cursor` | opaque                                                   |
| `limit`  | default 50                                               |

Response row schema: [`schemas/USERS-DIRECTORY-ROW.schema.json`](schemas/USERS-DIRECTORY-ROW.schema.json).

## Rank policy errors

| Code                                         | HTTP | When                          |
| -------------------------------------------- | ---- | ----------------------------- |
| `RBAC_SELF_ROLE_CHANGE_FORBIDDEN`            | 403  | Actor patches self            |
| `RBAC_OWNER_ROLE_ASSIGNMENT_FORBIDDEN`       | 403  | PATCH or invite assigns owner |
| `RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN` | 403  | Target is owner               |
| `RBAC_INSUFFICIENT_ROLE_PRIVILEGE`           | 403  | Actor rank ≤ target           |
| `OPERATOR_FORBIDDEN`                         | 403  | Member on admin surface       |

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
] as const;
```

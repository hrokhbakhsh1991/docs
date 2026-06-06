# HTTP / tenant compliance checklist (Phase 0 — PR review)

Use for every `@apps/api` change that touches HTTP handlers, auth, RLS, or errors.

## Auth ingress

| #   | Check                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Production rejects header-only auth (`UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION`)                             |
| 2   | Dev bearer disabled outside `NODE_ENV=test`                                                                         |
| 3   | JWT `member` role requires `workspace_id` (F-10)                                                                    |
| 4   | JWT snake/camel claims must not conflict (F-11)                                                                     |
| 5   | **Staging** uses same policy as production (see [`production-auth-policy.md`](production-auth-policy.md) § Staging) |

## Tenant context

| #   | Check                                                                                   |
| --- | --------------------------------------------------------------------------------------- |
| 6   | Tour routes wrap business logic in `runWithHttpRequestContext`                          |
| 7   | `tenant-config` uses `runWithHttpRequestContext` + read-tier rate limit                 |
| 8   | Background publish/subscribers use `runWithTenantContext` (DEC-027)                     |
| 9   | `withTenantRls` / `withCanonicalTransaction` align with ALS when ALS is bound (DEC-028) |

## RLS / SQL

| #   | Check                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------- |
| 10  | App paths use `set_config(..., true)` only — CI `guard:rls-session-local` (via `guard:tenant-isolation`) |
| 11  | No unscoped Prisma reads in route layers (`guard:api-queries`)                                           |
| 12  | No admin id-only tour reads (`resolveById` / `findUnique({ id })`) — `guard:id-only-tour-read`           |
| 13  | Production: `DATABASE_URL_ADMIN` ≠ `DATABASE_URL`, `STORAGE_DRIVER=prisma`                               |

## Errors

| #   | Check                                                                     |
| --- | ------------------------------------------------------------------------- |
| 14  | Client responses use `sendHttpError` / `handleHttpError` (correlation id) |
| 15  | 500/503 bodies opaque — no stack/SQL/engine paths                         |
| 16  | 429 includes `correlationId` in JSON                                      |

## Tests

| #   | Check                                                                       |
| --- | --------------------------------------------------------------------------- |
| 17  | Auth regressions: `tenant-security.spec.ts`                                 |
| 18  | ALS isolation: `tenant-request-context-isolation.spec.ts` when touching ALS |
| 19  | RLS integration when changing `withTenantRls`                               |

**Gate:** `pnpm --filter @apps/api run guard:tenant-isolation` (runs all three static guards; also in `pretest` / `phase-3:api-gate`).

# Production auth policy (P1-8)

```yaml
decision: DEC-023
enforcement: apps/api/src/tenant-kernel/auth-env.ts
ingress: apps/api/src/tenant-kernel/tenant-kernel.ts
tests:
  - apps/api/src/tenant-kernel/auth-env.spec.ts
  - apps/api/src/tenant-kernel/tenant-kernel.spec.ts
  - apps/api/test/4-integration/clock-skew-resilience.spec.ts
```

## Rules

| Environment   | Bearer `Authorization`           | Unsigned `dev.*` bearer                   | Header-only (`x-authenticated-*`) |
| ------------- | -------------------------------- | ----------------------------------------- | --------------------------------- |
| `production`  | **Required** — RS256 JWT only    | **Forbidden** (startup + ingress)         | **Forbidden**                     |
| `development` | Optional JWT if `AUTH_JWT_*` set | Forbidden unless misconfigured flag       | **Forbidden** (MR-P0-006)         |
| `test`        | JWT when configured              | Allowed when `AUTH_ALLOW_DEV_BEARER=true` | Allowed                           |

### Production fail-closed

1. **Boot:** `assertAuthEnvironmentIntegrity()` requires `AUTH_JWT_PUBLIC_KEY`, `AUTH_JWT_ISSUER`, and `AUTH_JWT_AUDIENCE` when `NODE_ENV=production`. Missing config throws `AUTH_JWT_REQUIRED_IN_PRODUCTION` before the server listens.
2. **Ingress:** `resolveTenantContextFromRequest` rejects requests **without** a non-empty `Authorization` header in production (`UNAUTHORIZED_BEARER_AUTH_REQUIRED_IN_PRODUCTION`). Verified JWT is the only production identity path. Header-only is also rejected in `development` (`UNAUTHORIZED_HEADER_AUTH_FORBIDDEN_OUTSIDE_TEST`) — only `NODE_ENV=test` may use `x-*` auth headers (MR-P0-006). Integration proof `apps/api/test/4-integration/dynamic-config-sync.spec.ts` therefore sets `NODE_ENV=test` (not `development`) while still exercising Postgres-backed tenant theme sync when `DATABASE_URL` is present.
3. **Dev bearer:** `AUTH_ALLOW_DEV_BEARER=true` remains illegal outside `NODE_ENV=test` (`AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST`).
4. **Test harness (fail-closed):** `APPS_API_PRODUCTION_AUTH_HARNESS=1` is permitted **only** when `NODE_ENV=test`. Under `NODE_ENV=production`, the flag is **rejected at boot** (`PRODUCTION_AUTH_HARNESS_FORBIDDEN`) — not ignored. See `apps/api/src/test/production-auth-harness.ts`.
5. **Session version (MR-P0-006):** Operator JWT/cookie sessions must carry `sess_ver`. `requireOperatorSession` passes the claim into `hydrateMembershipFromDb`; mismatch or missing claim under production → `AuthTokenRevokedError` (revoked admins cannot keep operating).

### Dev bearer TTL (test only)

Unsigned dev tokens embed `exp` (Unix seconds). Default TTL: **3600s** unless `AUTH_DEV_BEARER_TTL_SECONDS` is set. Verification uses the same **5s** clock tolerance as RS256 JWT (`jose` `clockTolerance`).

`encodeDevBearerToken` always mints `exp`. Parse rejects missing or expired `exp` when dev bearer is allowed.

Production sessions must use RS256 JWT with standard `exp` — not dev bearer.

### JWT claim rules (F-10, F-11)

| Rule                                       | Enforcement                                           | Error                               |
| ------------------------------------------ | ----------------------------------------------------- | ----------------------------------- |
| `role=member` requires non-empty workspace | `tenant-kernel.ts` after JWT verify                   | `UNAUTHORIZED_MISSING_WORKSPACE_ID` |
| Conflicting aliases in same token          | `parse-jwt-bearer.ts` before `parseTenantAuthContext` | `UNAUTHORIZED_INVALID_BEARER_TOKEN` |

Alias pairs checked: `tenant_id` / `tenantId`, `workspace_id` / `workspaceId`, `membership_status` / `status`. When both forms are present they must agree; one form may be omitted.

Header path (`x-workspace-id`) already enforces workspace for `member` via `assertRequiredAuthHeaders` — JWT path must match (F-10).

## Environment variables

| Variable                                | Production                   | Test                                 |
| --------------------------------------- | ---------------------------- | ------------------------------------ |
| `AUTH_JWT_PUBLIC_KEY`                   | **Required**                 | Optional (enables JWT path in specs) |
| `AUTH_JWT_ISSUER` / `AUTH_JWT_AUDIENCE` | **Required** with public key | Same                                 |
| `AUTH_ALLOW_DEV_BEARER`                 | Must be unset / not `true`   | `true` for dev bearer specs          |
| `AUTH_DEV_BEARER_TTL_SECONDS`           | N/A                          | Optional override (default 3600)     |

## Staging (P1-11)

Treat **staging** like production for auth — not like local development:

| Setting                    | Staging                                           | Development              |
| -------------------------- | ------------------------------------------------- | ------------------------ |
| `NODE_ENV`                 | `production` (recommended) or enforce gateway JWT | `development`            |
| Header-only tenant headers | **Forbidden** on public ingress                   | **Forbidden** (use JWT or `NODE_ENV=test` harness) |
| `AUTH_ALLOW_DEV_BEARER`    | **Forbidden**                                     | N/A in prod-like stacks  |
| `AUTH_JWT_*`               | **Required**                                      | Optional                 |

If staging must use `NODE_ENV=development`, terminate TLS at an API gateway that injects verified JWT and strips raw `x-authenticated-*` from the public internet.

## Verification

```bash
pnpm --filter @apps/api test -- src/tenant-kernel/auth-env.spec.ts src/tenant-kernel/tenant-kernel.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/4-integration/clock-skew-resilience.spec.ts
```

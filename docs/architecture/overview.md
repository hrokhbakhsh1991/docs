# Architecture Overview

This backend is a multi-tenant SaaS API with tenant isolation enforced by a layered model:

1. tenant is resolved from host (`{tenant}.{baseDomain}`),
2. authenticated requests bind tenant/user context,
3. DB access runs under tenant-bound RLS context,
4. background jobs use explicit tenant envelopes and explicit DB binding.

The design goal is fail-closed isolation without relying on client-supplied tenant identifiers.

## End-to-end tenant isolation

### HTTP request path

1. `RequestContextMiddleware` initializes request context (request id, route, method, client IP).
2. `TenantResolverMiddleware` resolves host -> tenant candidate using strict host trust rules.
3. `AuthMiddleware` verifies JWT, enforces host/JWT tenant alignment, and writes user/tenant/role to context.
4. `TenantMiddleware` blocks non-public routes if trusted tenant context is missing.
5. DB calls run with tenant binding:
   - HTTP path: implicit QueryRunner patch (`TenantSessionBindingService`),
   - worker/scheduler path: explicit `TenantDbContextService.runInTenantScope(...)`.

### Worker/scheduler path

Workers do not depend on ALS request context.

- tenant id comes from job envelope / tenant iteration
- code uses `TenantDbContextService.runInTenantScope(tenantId, fn)`
- `set_config('app.tenant_id', tenantId, true)` is applied transaction-locally
- QueryRunner implicit binding is skipped when ALS context is absent

This prevents tenant bleed when multiple tenants are processed on shared pools.

### QueryRunner patch layer (HTTP)

For request-driven DB access, `TenantSessionBindingService` patches QueryRunner:

- `connect`: validates implicit binding preconditions
- `startTransaction`: guards suppressed mode and applies tenant GUC
- `query`: enforces suppressed-mode allow-list and ensures tenant GUC in normal mode
- `release`: resets tenant GUC on pooled connection return

## Key invariants

- Tenant identity is derived from trusted host/JWT context, not request body tenant fields.
- Tenant context is immutable once frozen (host/JWT mismatch is rejected).
- Tenant-scoped tables are protected by RLS policies using `current_setting('app.tenant_id')`.
- Suppressed mode is only for narrow bootstrap lookups and enforced by explicit reason allow-list.
- Privileged RLS bypass paths are operation-specific, short, and logged.

## SECURITY DEFINER and privileged DB access

Active runtime flows no longer depend on executing SECURITY DEFINER functions.
Historical migration SQL still contains legacy SECURITY DEFINER DDL for schema reproducibility.

Current privileged runtime operations are concentrated in small application-layer paths:

- workspace listing bootstrap read
- invite acceptance mutation

They use transaction-local `SET LOCAL row_security = off` in minimal, explicit SQL blocks.
See `docs/security/security-definer.md`.

## Trust and tenant resolution

Host trust model:

- `TRUST_PROXY=false`: ignore `X-Forwarded-Host`
- `TRUST_PROXY=true`: trust `X-Forwarded-Host` only when remote IP matches `TRUSTED_PROXY_CIDRS`
- otherwise fallback to direct host

Pure parsing function: `resolveTenantFromHost(host, baseDomain)`.

See `docs/architecture/tenant-resolution.md`.

## Rate limiting and abuse controls

Rate limiting is centralized in `TenantRateLimitService` with scope-specific keys:

- API (`tenant`, `user`, `ip`)
- login (`tenant`, `ip`)
- jobs (`tenant`)

Redis is primary; fallback behavior is controlled by `RATE_LIMIT_FAIL_MODE`.
See `docs/security/rate-limiting.md`.

## Where to read next

- `docs/architecture/db-tenant-binding.md` — explicit DB binding pattern
- `docs/architecture/tenant-binding.md` — normal vs suppressed request modes
- `docs/architecture/tenant-resolution.md` — host trust model and parsing
- `docs/security/security-definer.md` — privileged runtime DB operations

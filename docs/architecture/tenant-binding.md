# Tenant Binding Modes

Tenant DB binding has two explicit modes in request context:

- `normal`: default mode. The DB layer must bind `app.tenant_id` before tenant-scoped queries.
- `suppressed`: opt-in mode for a very small set of bootstrap/public flows that run before tenant identity is fully bound.

## Normal Mode

Normal mode in HTTP request scope is fail-closed:

- request context must exist
- `tenantId` must exist and be a valid UUID
- `TenantSessionBindingService` QueryRunner patch injects
  `SELECT set_config('app.tenant_id', $1, true)` in transaction scope before tenant-scoped DB work

If tenant context is missing, binding throws `TenantContextMissingError` and the request fails.

For workers/schedulers without HTTP ALS context, implicit binding patch is intentionally skipped.
Those paths must use explicit binding via `TenantDbContextService.runInTenantScope(...)`.

QueryRunner patch interception points in normal mode:

- `connect`: validates tenant context eligibility
- `startTransaction`: applies tenant GUC after transaction start
- `query`: ensures transaction + tenant GUC for request-driven queries
- `release`: resets `app.tenant_id` before returning pooled connection

## Suppressed Mode

Suppressed mode is not a general bypass. It is only entered through:

- `RequestContextService.runWithoutTenantBinding(reason, fn)`

The helper records both mode and reason in ALS context, then restores the previous mode when the callback exits.
It also sets `tenantBindingSuppressed=true`; suppressed mode without this flag is rejected as invalid state.

When mode is `suppressed`:

- no tenant binding is applied
- transactions are blocked
- only explicitly allow-listed queries are accepted for the declared suppression reason

Current allow-list:

- `tenant_host_resolution`: tenant host lookup shape (`SELECT ... FROM tenants ... LOWER(subdomain) ... deleted_at IS NULL`)
- `public_tour_bootstrap_lookup`: bootstrap tour-to-tenant routing (`SELECT tenant_id ... FROM tours WHERE id = ... AND deleted_at IS NULL`)

Any non-allow-listed query throws `TENANT_BINDING_SUPPRESSED_QUERY_FORBIDDEN`.

## Security Intent

This model removes ambiguous suppression behavior:

- there is only one normal tenant-binding path
- there is only one suppression helper
- suppressed mode is explicit, scoped, auditable, and constrained

See also: `docs/architecture/db-tenant-binding.md` for the explicit worker/scheduler binding pattern.

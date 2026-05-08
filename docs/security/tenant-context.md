# Tenant Context Fail-Closed Policy

## Security requirement

Any request that loses tenant context is considered a security error and is rejected.

## Fail-closed behavior

- The DB tenant binding layer now requires tenant context on every protected query path.
- If request context storage is unavailable, tenant binding throws a hard error.
- If `tenant_id` is missing, tenant binding throws a hard error.
- No tenant binding code path is allowed to continue silently with `undefined`.
- Tenant context is immutable for each request/job. Once derived, attempts to switch to another tenant are rejected.

## Error handling

- Missing tenant context is raised as `TenantContextMissingError`.
- The global HTTP exception filter maps this to HTTP `500`.
- The error response uses code `TENANT_CONTEXT_MISSING`.
- A security anomaly log is emitted with the request correlation id (`requestId`) and route metadata only.

## Operational guidance

- Treat `TENANT_CONTEXT_MISSING` as a production incident.
- Investigate async context breaks, middleware ordering drift, and any unscoped DB access path.
- Worker/database code must set `app.tenant_id` with LOCAL scope (`set_config(..., true)`), never session scope.

# Authorization Scope Model

## Tenant-scoped roles

- `owner`, `admin`, and `member` are tenant-level roles.
- Tenant-level `admin` is strictly scoped to the active tenant context.
- Tenant-level `admin` must never be treated as a platform-global operator.

## Payments admin listing scope

- `GET /api/v2/admin/payments` is tenant-scoped.
- The endpoint always reads tenant context and passes `tenant_id` into the service query.
- The payments query always filters by `tenant_id` and `deleted_at IS NULL`.
- If tenant context is missing, the request fails and no global payments query is executed.

## Platform-level super admin

- A platform-global payments listing is not enabled by default.
- If introduced in the future, it must use a dedicated role such as `super_admin`.
- Do not reuse tenant `admin` for any cross-tenant data access.

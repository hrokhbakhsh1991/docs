# RLS Coverage

## Tenant tables with enforced RLS

The following tenant-scoped tables are protected by PostgreSQL RLS using `app.tenant_id`:

- `workspace_invites`
- `user_role_audit`
- `tenant_usage_daily`
- `tenant_plan_limits`

## Policy model

- RLS is enabled and forced on each table.
- `tenant_isolation_select` policy restricts reads to:
  - `tenant_id = current_setting('app.tenant_id')::uuid`
- `tenant_isolation_modify` policy restricts writes with:
  - `USING (tenant_id = current_setting('app.tenant_id')::uuid)`
  - `WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid)`

## Operational requirement

Application/database paths must set `app.tenant_id` before any tenant-scoped query. Missing tenant context must fail closed.

# Finance recon tables — RLS tenant isolation

```yaml
doc_id: FINANCE_RECON_RLS
status: ACTIVE
date: "2026-07-20"
tables:
  - finance_recon_findings
  - finance_recon_actions
standard: same as payments / operator_registrations (Booking)
migration: 20260720140000_finance_recon_rls
proof: apps/api/src/workspace-finance/recon/finance-recon-rls.postgres.spec.ts
```

## Before (posture)

| Property | `finance_recon_findings` | `finance_recon_actions` | Booking (`operator_registrations`) |
| -------- | ------------------------ | ----------------------- | ---------------------------------- |
| `tenant_id` column | yes | yes | yes |
| Owner | postgres | postgres | postgres |
| GRANT to `app_tour` | SELECT/INSERT/UPDATE/DELETE | same | same |
| ENABLE RLS | **no** | **no** | yes |
| FORCE RLS | **no** | **no** | yes |
| Tenant policy | **none** | **none** | `tenant_id = current_setting('app.current_tenant_id')::uuid` |

**Risk:** any `app_tour` session (or leaked connection without tenant GUC) could read/write **all** tenants’ recon rows. Ops store (`findings-store.ts`) uses `getPrismaAdmin()` (owner/superuser bypass) for cross-tenant scan — that path is intentional; the hole is the **app role grant without RLS**.

## After (posture)

```sql
ALTER TABLE finance_recon_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_recon_findings FORCE ROW LEVEL SECURITY;
CREATE POLICY finance_recon_findings_tenant_isolation ON finance_recon_findings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
-- same for finance_recon_actions
GRANT SELECT, INSERT, UPDATE, DELETE ON … TO app_tour;  -- reaffirmed
```

| Role | Behavior |
| ---- | -------- |
| `app_tour` + `withTenantRls(tenantA)` | read/write only tenant A rows |
| `app_tour` + tenant B session | cannot see/mutate tenant A rows |
| `DATABASE_URL_ADMIN` (postgres) | bypasses RLS — recon runner / ops HTTP cross-tenant scan unchanged |

## Runtime access paths

| Path | Client | RLS impact |
| ---- | ------ | ---------- |
| `findings-store.ts` upsert/list/repair audit | `getPrismaAdmin()` | bypass — ops job |
| `repair-handlers.ts` ledger enqueue | `withTenantRls` on payments/outbox | unchanged |
| Future app-role reads of recon tables | `getPrisma()` / `withTenantRls` | **now enforced** |

## Verification

```bash
pnpm --filter @apps/api exec node --import tsx --env-file=.env --env-file=.env.local --test --test-force-exit \
  src/workspace-finance/recon/finance-recon-rls.postgres.spec.ts
```

Also: `db:migrate:deploy` on empty DB and on existing DB must apply `20260720140000_finance_recon_rls` idempotently.

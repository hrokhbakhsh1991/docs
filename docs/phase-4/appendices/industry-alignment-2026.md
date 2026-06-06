# Phase 4 — Industry alignment notes (2026)

```yaml
agent_load_tier: T2_context
doc_quality_support: true
not_implementation_spec: true
```

| Source theme | Phase 4 binding |
|--------------|-----------------|
| Shared schema + RLS FORCE | `infra/sql/001_tenant_rls.sql`, P4-E-RLS-01 |
| App-layer filter + RLS backstop | CASL `accessibleByTourWhere` + RLS |
| Session `SET LOCAL` per TX | P4-E-RLS-02, `withTenantTransaction` / Prisma TX |
| Tenant from auth context, not spoofed body | P4-E-TENANT-01 |
| Composite index `(tenant_id, …)` | `idx_tours_tenant_id`, schema_minimum 4.2 |
| Workspace slug routing (B2B) | host parse → subdomain; `workspace_type` on tenant row |

**Explicit non-adoption in Phase 4 (documented deferrals):**

- Schema-per-tenant / DB-per-tenant → Phase 7 enterprise (`forbidden_phase_4` dedicated DB)
- AsyncLocalStorage middleware doc — optional pattern; repo uses explicit TX + headers today
- Full OTel stack → Phase 7 (`observability.md` scaffold only)

**Interop workspace platform:** see [`workspace-interoperability-model.md`](workspace-interoperability-model.md).

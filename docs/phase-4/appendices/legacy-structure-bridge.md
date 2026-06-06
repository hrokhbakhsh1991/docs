# Phase 4 — Legacy ↔ app-tour structure bridge

```yaml
agent_load_tier: T0_execution
machine_readable: true
rule: "When porting or grepping, use NEW paths first; legacy/ is read-only reference"
fail_if: "Agent copies legacy/apps or legacy/packages into root without subphase spec"
```

## Repo roots

| Root | Role | Agent rule |
|------|------|------------|
| `/` (app-tour) | **Active development** | Implement Phase 4 here only |
| `legacy/` | Frozen Tour Ops monorepo | **Reference port only** — no new features |
| `docs/phase-4/` | Execution SoT | Bind to modular tree, not monolith body |

## Phase name collision (critical)

| Document | «Phase 4» means |
|----------|-----------------|
| **app-tour** `docs/MIGRATION-MAP.md` §11 | `tenant-kernel` · Postgres+RLS · tenant theme · in-process events |
| **legacy** `legacy/map.md` | Canonical SoT + `workspaces/urban` — **NOT** app-tour Phase 4 |

---

## Path migration table (legacy → app-tour)

| Legacy path | app-tour path | Subphase | Notes |
|-------------|---------------|----------|-------|
| `legacy/packages/tenant-host/` | `packages/tenant-kernel/src/host/` | 4.1 | Port `parse-workspace-tenant-label` — no Nest in package |
| `legacy/apps/api/src/database/tenant-session-binding.service.ts` | `packages/tenant-kernel/src/rls/session.ts` + `apps/api` `withTenantTransaction` | 4.1, 4.2 | `set_config('app.current_tenant_id', …, true)` transactional |
| `legacy/apps/api/src/modules/tenant/tenant-host-resolver.service.ts` | `apps/api/src/tenant-kernel/` adapter + `@app-tour/tenant-kernel` | 4.1 | Thin adapter; resolver logic in package |
| `legacy/apps/web/lib/tenant/runtime-tenant-context.ts` | `apps/web/src/tenant/*` | 4.0 R1, 4.4 | Per-request session — no static singleton |
| `legacy/packages/workspaces/denali` | **FORBIDDEN** until Phase 6 | — | `p4_no_denali_in_kernel` |
| `legacy/` TypeORM tours | `apps/api/prisma` + RLS `infra/sql/001_tenant_rls.sql` | 4.2 | Postgres SoT — not in-memory prod |
| Phase 3 in-memory `ScopedTourRepository` | `PrismaTourRepository` when `DATABASE_URL` | 4.2 | Phase 3.2 explicitly not Prisma runtime |

---

## Package graph (current — not legacy)

```yaml
packages_phase_4:
  tenant-kernel:
    path: packages/tenant-kernel/
    imports_allowed: [workspace-sdk types optional]
    imports_forbidden: [platform-core, design-tokens, workspaces/*, prisma, nest]
  platform-events:
    path: packages/platform-events/
    subphase: "4.5"
  apps/api:
    depends: [tenant-kernel, platform-events, workspace-sdk, platform-core, workspace-starter]
    tenant_adapter: apps/api/src/tenant-kernel/
  apps/web:
    subphases: ["4.0 R1", "4.4"]
  infra:
    docker: infra/docker-compose.yml
    rls_sql: infra/sql/001_tenant_rls.sql
```

**Detail:** [`dependency-graph.md`](dependency-graph.md)

---

## Phase 3 → Phase 4 handoff (execution)

| Phase 3 delivers | Phase 4 changes |
|------------------|-----------------|
| In-memory tours + CASL (`api-ability.ts`) | Same CASL rules on Prisma path 4.2 |
| `phase-3:gate` green | Prerequisite for 4.0+ |
| Red flags R0–R3 open | **4.0 blocks 4.1+** until status report + tracks PASS |
| No `packages/tenant-kernel` | **4.1** extracts package |
| No Postgres prod SoT | **4.2** `TOUR_STORAGE=postgres` |

---

## Grep hints (avoid wrong tree)

```bash
# CORRECT — app-tour
rg "tenant-kernel" packages/tenant-kernel apps/api/src/tenant-kernel

# WRONG — legacy reference only
rg "tenant-host" legacy/packages/tenant-host
```

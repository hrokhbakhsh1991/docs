# Phase 7 — Second Workspace + Platform Hardening (Research)

```yaml
agent_load_tier: T3_human
non_authoritative_for_execution: true
sole_execution_entry: docs/phase-7/phase-7-agent-router.md
decisions_authoritative: docs/phase-7/appendices/IMPLEMENTATION-DECISIONS.md
reference_workspaces: [packages/workspaces/starter, packages/workspaces/denali]
legacy_urban_reference: legacy/packages/types/src/tour-form-profile-descriptors.ts
fail_if: "Agent implements Phase 7 from this research body instead of phase-7-agent-router.md + subphases/"
```

**Role:** Principal architect research (no implementation)  
**Date:** 2026-06-04  
**Scope:** Phases 0–6 continuity + legacy urban profile + industry 2025–2026 + Platform DoD

> **Agents (T0):** [`phase-7/phase-7-agent-router.md`](../phase-7/phase-7-agent-router.md) only.  
> **T0 stub:** [`phase-7-workspace-hardening-research.ai-exec.md`](phase-7-workspace-hardening-research.ai-exec.md)

---

## Executive summary

Phase 7 closes **Platform Definition of Done** — not a heavy legacy port like Phase 6.

| Pillar               | Deliverable                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| **Genericity proof** | `packages/workspaces/urban` minimal — E2E create → publish **without** `platform-core` diff            |
| **Ops maturity**     | Full observability (MAP §10) + rate limits + runbook                                                   |
| **Enterprise tier**  | `TenantConnectionRouter` pool → silo ([`TenantRoute`](../../packages/tenant-kernel/src/route.ts) stub) |

Industry + legacy agree:

1. **Second workspace = thin plugin** — starter-plus registry, not Denali-II.
2. **Hybrid tenant tiers** — pool + RLS default; silo for enterprise contracts only.
3. **Observability in generic API layer** — not urban-only branches.
4. **Plugin registry one-way registration** — core reads registry; no `if (urban)` in platform-core.
5. **build-green ≠ Platform DoD** — `phase-7.contract.spec.ts` + `ci:integrity` + forensic ≥ 8.

**Critical:** legacy `urban_event` is a **form profile** (field strip rules), not `packages/workspaces/urban`. Phase 7 must not re-couple urban to Denali rail.

---

## Section 1 — Continuity (Phases 0–6 → 7)

### 1.1 Handoff table

| Phase   | Delivers                                      | Phase 7 consumes                               |
| ------- | --------------------------------------------- | ---------------------------------------------- |
| **0–1** | `WorkspacePlugin`, engine, canonical covenant | urban plugin surface                           |
| **2**   | theme ingress                                 | `urban/theme/tokens.css`                       |
| **3**   | `CanonicalTourService`, CASL                  | urban E2E write path                           |
| **4**   | RLS, tenant-kernel, `TenantRoute` interface   | silo implementation (7.7)                      |
| **5**   | outbox, audit, projections                    | cross-workspace adversarial re-run             |
| **6**   | Denali plugin + bootstrap pattern             | **template** for urban — not copy-paste domain |

### 1.2 Phase 7 MAP deliverables

```text
packages/workspaces/urban/     ──►  prove plugin model is generic
        │
        ├── 7.2: zero platform-core diff (guard + baseline)
        ├── 7.3–7.4: bootstrap + E2E create→publish
        │
packages/tenant-kernel/        ──►  TenantConnectionRouter (7.7)
        │
apps/api/                      ──►  observability + rate limits (7.5–7.6)
        │
ci:integrity + forensic        ──►  Platform DoD (7.9)
```

### 1.3 Prerequisites

| Gate                                        | Required for 7.0     |
| ------------------------------------------- | -------------------- |
| `pnpm run phase-6:gate`                     | exit 0               |
| Denali plugin registered                    | pattern proof exists |
| `resolveWorkspacePluginForType` generalized | not starter-only     |

---

## Section 2 — Legacy forensic (urban)

### 2.1 Assets to reuse (semantics only)

| Asset                  | Legacy path                                         | Phase 7 use                                             |
| ---------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| **Slim profile rules** | `urban_event` in `tour-form-profile-descriptors.ts` | Inspire minimal field registry (no itinerary/transport) |
| **Demo tenant**        | `urban-demo-tenant.fixture.ts`                      | Smoke fixture reference                                 |
| **Subdomain e2e**      | `subdomain-multi-tenant.e2e-spec.ts`                | Host resolution pattern                                 |
| **Audit scaffolding**  | `legacy/apps/api/src/common/audit/`                 | Align with Phase 5 audit_events                         |

### 2.2 Failures to avoid

| #   | Legacy failure                          | Evidence (file:line)                                                                                                                         | Phase 7 rule                          |
| --- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| F1  | `urban_event` → Denali wizard rail      | `legacy/apps/web/src/features/tours/wizard/workspace-wizard.config.spec.ts` L11–13: `getWizardConfig("urban_event").wizardMode === "denali"` | DEC-P7-003 — independent urban plugin |
| F2  | Profile confused with workspace package | `tour-form-profile-descriptors.ts` L283–299 — profile slug only                                                                              | URBAN-MINIMAL-SCOPE                   |
| F3  | `WorkspaceStrategyRegistry` branches    | legacy API strategies                                                                                                                        | generic resolver only                 |
| F4  | Urban scope creep → second Denali       | large registry port                                                                                                                          | DEC-P7-002 minimal                    |
| F5  | Silo without migration                  | ad-hoc DB URLs                                                                                                                               | TENANT-ROUTER-SPEC                    |

### 2.3 urban_event strip semantics (reference)

From `legacy/packages/types/src/tour-form-profile-descriptors.ts` L283–299:

```typescript
// urban_event descriptor (reference only — do not import)
slug: "urban_event",
defaultTourType: "city",
inactiveFieldGroups: ["itinerary", "participation", "logistics"],
strip: {
  clearsTripDetailsRoots: ["participation"],
  itineraryKeysToDelete: ["dayPlans", "segmentActivities"],
  clearsRootTransportModes: true,
},
```

Port as **plugin field registry policy** in URBAN-MINIMAL-SCOPE — not as shared Denali rail.

---

## Section 3 — Industry patterns (2025–2026)

### 3.1 Hybrid multi-tenant tiers

| Tier                  | Model                             | When                               |
| --------------------- | --------------------------------- | ---------------------------------- |
| **Standard (pool)**   | Shared schema + RLS + `tenant_id` | Default signup — Phases 4–6        |
| **Enterprise (silo)** | Dedicated DB or schema            | Sales/compliance trigger — Phase 7 |

Sources: [Brocoders multi-tenant 2026](https://brocoders.com/blog/multi-tenant-architecture-designing-saas-apps/), [DEV shared vs separate schema](https://dev.to/young_gao/multi-tenant-architecture-database-per-tenant-vs-shared-schema-1n2e).

**app-tour fit:** MAP §7.2 — `tenant_routes` table + `TenantConnectionRouter`; application code unchanged except connection resolver.

### 3.2 Connection routing

| Pattern                                 | Use in Phase 7                              |
| --------------------------------------- | ------------------------------------------- |
| `SET LOCAL search_path` per transaction | If silo = schema-per-tenant                 |
| PgBouncer transaction pooling           | Scale pool tier; silo may use dedicated URL |
| Per-tier connection caps                | Noisy-neighbor prevention with rate limits  |

Align with existing [`SET_LOCAL_RLS_TENANT_SQL`](../../packages/tenant-kernel/) — RLS remains backstop on pool tier.

### 3.3 Second workspace / plugin registry

| Pattern                          | Phase 7 use                                        |
| -------------------------------- | -------------------------------------------------- |
| Manifest + registry one-way load | urban plugin registers; core consumes              |
| Topological deps                 | urban may depend on SDK only — not denali package  |
| Capability contracts             | Same `WorkspacePlugin` interface as starter/denali |

Proves MAP Platform DoD: _new workspace = plugin + theme + bootstrap — no core touch_.

### 3.4 Observability + rate limits

| Layer                  | Phase 7                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| Structured JSON logs   | Extend §10.2 fields — `workspaceType`, `tenantTier`              |
| Request ID + tenant ID | Already Phase 3–4 — complete runbook in 7.5                      |
| Rate limits            | Redis per tenant + tier (Phase 4 infra) — 7.6                    |
| OpenTelemetry          | Optional — trace propagation cross API; not blocking minimal DoD |

### 3.5 Explicit non-adoption

| Pattern                     | Why not Phase 7             |
| --------------------------- | --------------------------- |
| WASM third-party sandbox    | MAP §9.2 — first-party only |
| Full CDC / warehouse        | Phase 8+                    |
| Copy legacy urban web tree  | Plugin boundary             |
| Database-per-tenant for all | Cost — silo opt-in only     |

---

## Section 4 — Recommended architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│ Host: apps/api, apps/web, ci:integrity                          │
│  resolveWorkspacePlugin(starter | denali | urban)               │
│  observability middleware · rate limit · TenantConnectionRouter │
└────────────────────────────┬────────────────────────────────────┘
                             │ WorkspacePlugin (unchanged contract)
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   starter              denali (Ph6)         urban (Ph7 minimal)
   reference            product #1           product #2 proof
```

### 4.1 Urban = starter-plus

| Component       | Urban scope                      |
| --------------- | -------------------------------- |
| Field registry  | ~10–20 fields — city tour basics |
| Rules           | Minimal validateCanonical        |
| Composites      | 1–2 widgets                      |
| Theme           | `tokens.css`                     |
| Finance / MinIO | **Out of scope** — Denali-only   |

### 4.2 TenantConnectionRouter (7.7)

```typescript
// packages/tenant-kernel — implement Phase 7
interface TenantConnectionRouter {
  resolveRoute(tenantId: string): Promise<TenantRoute>;
}
// pool → default DATABASE_URL
// silo → tenant_routes.database_url override
```

---

## Section 5 — Risk register

| ID      | Risk                                 | Mitigation                       |
| ------- | ------------------------------------ | -------------------------------- |
| R-P7-01 | Phase 6 not closed                   | 7.0 blocked on `phase-6:gate`    |
| R-P7-02 | Urban becomes Denali-II              | DEC-P7-002 + URBAN-MINIMAL-SCOPE |
| R-P7-03 | platform-core diff for urban widgets | 7.2 baseline diff guard          |
| R-P7-04 | Silo without `tenant_routes` DDL     | TENANT-ROUTER-SPEC before impl   |
| R-P7-05 | Rate limit without Redis             | document SKIP + BLOCKER in TRUTH |
| R-P7-06 | Profile/rail coupling returns        | RULE-P7-003 + contract spec      |

---

## Section 6 — Sources

### Repo

- [`docs/MIGRATION-MAP.md`](../MIGRATION-MAP.md) — Phase 7, §7.2, §10, §12, §22
- [`docs/phase-6/appendices/phase-boundaries.md`](../phase-6/appendices/phase-boundaries.md)
- [`packages/tenant-kernel/src/route.ts`](../../packages/tenant-kernel/src/route.ts)

### Web (2026-06-04)

- [Multi-tenant architecture 2026](https://brocoders.com/blog/multi-tenant-architecture-designing-saas-apps/)
- [PgBouncer multi-tenant Postgres](https://softwarecurated.com/software-development/scaling-multi-tenant-postgres-with-pgbouncer/)
- [Hybrid tier routing](https://dev.to/young_gao/multi-tenant-architecture-database-per-tenant-vs-shared-schema-1n2e)

---

**Architect, documentation status: Updated. Link to docs: `docs/research/phase-7-workspace-hardening-research.md`.**

# Phase 4 — Workspace interoperability model (app-tour SoT)

```yaml
document_meta:
  date: "2026-06-04"
  agent_load_tier: T0_execution
  purpose: "Bind tenant security boundary to workspace plugin interoperability — prevents phase confusion"
  industry_alignment_2026:
    - "Shared-schema multi-tenant + RLS FORCE (defense in depth)"
    - "tenant_id on every row; CASL/app filter primary, RLS backstop"
    - "SET LOCAL session variable per transaction (pool-safe)"
    - "Host/subdomain resolves tenant before workspace plugin runs"
  project_truth: "Interoperable workspace platform — NOT legacy Tour Ops Phase 4"
```

> **RULE:** Tenant = **who** is isolated. Workspace = **which product plugin** runs after tenant is bound. Never conflate them in code or docs.  
> **Human (T3):** [`phase-4-tenant-kernel.md` §0.4](../../phase-4-tenant-kernel.md#04-workspace-interoperability--tenant--workspace) — FA/EN summary, no duplicate tables here.

---

## Two axes (do not merge)

| Axis | Meaning in app-tour | Package / layer | Phase |
|------|---------------------|-----------------|-------|
| **Tenant** | Security + data boundary (`tenant_id`, RLS, host) | `@app-tour/tenant-kernel`, `apps/api` adapter | **4** |
| **Workspace** | Product rules + UI (`WorkspacePlugin`, starter → Denali) | `workspace-sdk`, `platform-core`, `packages/workspaces/*` | **3** (starter), **6+** (Denali) |

```text
HTTP Host (tenant-a.localhost)
    → tenant-kernel: parse host → tenantId  (P4-E-HOST-01)
    → API: TenantAuthContext + CASL          (Phase 3)
    → workspace_type on tenant row → plugin  (starter now; registry Phase 5/6)
    → CanonicalTourService write             (Phase 3 + 4 storage)
    → platform-events (4.5) → outbox (5.4)
```

---

## Interoperability contracts (repo paths)

| Contract | Owner | Consumed by |
|----------|-------|-------------|
| `CanonicalDocument` | `packages/workspace-sdk` | API, engine, Phase 5 `canonical_data` |
| `WorkspacePlugin` / `PlatformWizardEngine` | `platform-core` + starter | `apps/api` `canonical-validation.ts` |
| `createApiAbility` / `accessibleByTourWhere` | `apps/api/src/casl` | All tenant-scoped queries |
| Host parse / RLS SQL constants | `packages/tenant-kernel` | API middleware + Prisma TX |
| `TenantThemeConfig` | `workspace-sdk` theme contract | Web `TenantThemeProvider` (4.4) |
| `publishDomainEvent` | `platform-events` | Hook after persist (4.5) |

**Forbidden interop breaks:**

- Static import `packages/workspaces/denali` before Phase 6 (`p4_no_denali_in_kernel`)
- `platform-core` → `tenant-kernel` import
- `tenant-kernel` → `workspaces/*` import
- Resolve workspace plugin **before** tenant context is verified

---

## Phase handoff map (workspace platform)

| Phase | Delivers for interoperability |
|-------|------------------------------|
| **0–2** | SDK contracts, design tokens, theme chain |
| **3** | starter plugin, API/Web thin shell, CASL, canonical SoT path |
| **4** | tenant-kernel, Postgres+RLS, two-tenant proof, theme from API, in-process events |
| **5** | `canonical_data` column, validate-before-persist, outbox, projections — **same tenant_id** |
| **6** | Denali workspace plugin, dynamic registry |

**MAP refs:** [`map-bridge.md`](map-bridge.md) · [`../../MIGRATION-MAP.md`](../../MIGRATION-MAP.md) §7 · §6 · §11

---

## 2026 industry fit (why this doc set is correct for your project)

| Industry recommendation (2026 B2B SaaS) | app-tour Phase 4 doc + code intent |
|----------------------------------------|-----------------------------------|
| Shared schema + `tenant_id` default | `tours.tenant_id`, pool tier; silo Phase 7 |
| RLS as safety net, not sole authz | CASL + RLS + P4-E-* tests |
| `SET LOCAL` per transaction | `SET_LOCAL_RLS_TENANT_SQL`, P4-E-RLS-02 |
| Tenant from JWT/headers, not body | P4-E-TENANT-01, tenant-security.spec |
| Workspace/tenant routing by host slug | subdomain parse, reserved labels |
| Defense in depth (4 layers) | host → API auth → CASL → RLS |

---

## Phase 5 entry (modular — not monolith-only)

See [`../phase-4-enforcement.md`](../phase-4-enforcement.md) `phase_5_entry_requires_modular`.

| Phase 5 doc | Role |
|-------------|------|
| [`../../phase-5/phase-5-agent-router.md`](../../phase-5/phase-5-agent-router.md) | Agent SoT |
| [`../../phase-5/appendices/workspace-data-layer-model.md`](../../phase-5/appendices/workspace-data-layer-model.md) | Canonical + plugin + tenant layers |
| [`../../phase-5-canonical-schema.md`](../../phase-5-canonical-schema.md) | DDL / outbox / RLS |

Human narrative optional: [`../../phase-4-tenant-kernel.md`](../../phase-4-tenant-kernel.md) (T3) · research [`../../research/phase-5-data-architecture-research.md`](../../research/phase-5-data-architecture-research.md) (T3).

---

## Agent check (T0)

```yaml
interop_check_before_subphase:
  - "Tenant-boundary task? → subphase 4.x + tenant-kernel"
  - "Workspace rules/UI? → phase-3 docs + workspace-starter — do not patch in 4.1 package"
  - "Cross-phase doc change? → update knowledge-index owner only"
```

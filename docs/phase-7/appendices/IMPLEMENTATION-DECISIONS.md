# Phase 7 — Implementation decisions (agent SoT)

```yaml
decision_doc_version: "2026-06-04-v1"
extends_pek: docs/phase-6/appendices/IMPLEMENTATION-DECISIONS.md
reference_workspaces: [packages/workspaces/starter, packages/workspaces/denali]
legacy_urban_reference: legacy/packages/types/src/tour-form-profile-descriptors.ts
```

> Resolves ambiguities before urban code. **If conflict, this file wins** for Phase 7.

---

## DEC-P7-001 — platform-core unchanged for urban

```yaml
rule: "If Phase 7 needs a platform-core PR, Phases 1–6 failed the genericity proof"
allowed_in_platform_core:
  - "Generic types already supporting WorkspacePlugin (Phase 1)"
  - "Optional export surface docs — no urban-specific branches"
forbidden:
  - "if (workspaceType === 'urban') in platform-core"
  - "URBAN_* field kinds hard-coded in core registry"
source: docs/phase-7/subphases/7.2-genericity-proof.md
```

---

## DEC-P7-002 — Urban minimal scope (not Denali-II)

```yaml
rule: "Urban is starter-plus — not a second Denali port"
in_scope:
  - "~10–20 field registry entries (city tour basics)"
  - "1–2 composites + theme/tokens.css"
  - "validateCanonical in plugin"
out_of_scope:
  - "Finance hooks, MinIO photos, migrateCanonical bulk port"
  - "Full legacy urban web tree"
source: appendices/URBAN-MINIMAL-SCOPE.md
```

---

## DEC-P7-003 — urban_event semantics via plugin registry only

```yaml
rule: "Legacy urban_event is a form profile — Phase 7 implements slim registry in plugin"
forbidden:
  - "urban_event → denali wizard rail (legacy anti-pattern)"
  - "WorkspaceStrategyRegistry branches for urban"
allowed:
  - "Field strip rules ported as plugin fieldRegistry policy"
source: appendices/LEGACY-URBAN-REFERENCE.md
```

---

## DEC-P7-004 — TenantConnectionRouter

```yaml
rule: "Pool default; silo opt-in via tenant_routes"
implementation_home: packages/tenant-kernel
pool_tier:
  - "Default DATABASE_URL + RLS SET LOCAL"
silo_tier:
  - "tenant_routes.database_url override per tenant"
  - "Optional schema-per-tenant via SET LOCAL search_path"
source: appendices/TENANT-ROUTER-SPEC.md
```

---

## DEC-P7-005 — Observability in generic API layer

```yaml
rule: "MAP §10 completion in apps/api middleware — not urban-only"
required_fields:
  - "requestId, tenantId, workspaceType, tenantTier"
  - "structured JSON logs per §10.2"
deliverable: appendices/OBSERVABILITY-RUNBOOK.md
```

---

## DEC-P7-006 — Rate limit keys per tenant + tier

```yaml
rule: "Redis keys: ratelimit:{tenantId}:{tier}:{route}"
default_tier: pool
enterprise_tier: silo
skip_when: "REDIS_URL unset — document BLOCKER in TRUTH"
source: subphases/7.6-rate-limits.md
```

---

## DEC-P7-007 — Package layout (`packages/workspaces/urban`)

```text
packages/workspaces/urban/
  package.json          # @app-tour/workspace-urban
  src/
    index.ts            # export getUrbanWorkspacePlugin
    urban.plugin.ts     # WorkspacePlugin implementation
    field-registry/
    composites/
  theme/tokens.css
  test/
    phase-7.contract.spec.ts
```

**Today:** package **absent** — see [`audits/IMPLEMENTATION-TRUTH.md`](../audits/IMPLEMENTATION-TRUTH.md).

---

## DEC-P7-008 — Plugin registry (api + web)

| App | Target 7.3                                     |
| --- | ---------------------------------------------- |
| API | Register `urban` → `getUrbanWorkspacePlugin()` |
| Web | Lazy import urban plugin module                |

**Pattern:** Same as Denali 6.5 — **no** starter fallback when tenant is urban.

---

## DEC-P7-009 — Genericity proof (7.2)

```yaml
baseline: "git diff platform-core between phase-6-closure tag and urban merge"
guard: "phase-7.contract.spec.ts asserts zero urban-only platform-core diff"
```

---

## DEC-P7-010 — Cross-workspace adversarial (7.8)

Re-run Phase 4 RLS + Phase 5 validation matrix with **both** denali and urban tenants — no regression.

---

## DEC-P7-011 — Silo migration prerequisite

`tenant_routes` DDL must land before `TenantConnectionRouter` behavioral tests — see TENANT-ROUTER-SPEC.

---

## DEC-P7-012 — OTel optional

OpenTelemetry trace propagation is **optional** for 7.9 closure — structured logs + runbook are required.

---

## DEC-P7-013 — No runtime legacy import

Same as DEC-P6-008 — urban port reads legacy descriptors as **reference only**.

---

## DEC-P7-014 — Platform DoD contract spec

`packages/workspaces/urban/test/phase-7.contract.spec.ts` + root `phase-7.contract.spec.ts` prove second workspace without core diff.

---

## DEC-P7-015 — Closure requires ci:integrity

7.9 PASS requires `pnpm run ci:integrity` — not doc guard alone.

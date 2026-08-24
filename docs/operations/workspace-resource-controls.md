# Workspace resource controls (MAT-011)

**Program:** Enterprise Maturity MAT-M2  
**Status:** IMPLEMENTED — per-workspace quota primitives  
**Date:** 2026-08-24

---

## Goal

Minimum per-workspace resource protection before multiple paying customers share API/DB/queue capacity. This is **not** hyperscale distributed quota infrastructure.

---

## Primitives

| Primitive | Location | Identity key |
|-----------|----------|--------------|
| Request rate quota | `apps/api/src/middleware/tenant-rate-limiter.ts` | `tenantId:workspaceType:connectionTier:operationTier:method:path` |
| Theme quota override | `apps/api/src/middleware/workspace-resource-policy.ts` | `theme.workspaceResourceQuotas[workspaceType]` |
| Write concurrency slot | `apps/api/src/http/tour-write-concurrency-budget.ts` | `tenantId:workspaceType` |
| Policy resolver | `workspace-resource-policy.ts` | `workspaceType` + optional theme override |

---

## Defaults (fail-safe)

| Control | Default | Override path |
|---------|---------|---------------|
| Read RPM | 600 | `theme.workspaceResourceQuotas.<ws>.readRpm` |
| Write RPM | 120 | `theme.workspaceResourceQuotas.<ws>.writeRpm` |
| Max concurrent tour writes | 8 | `theme.workspaceResourceQuotas.<ws>.maxConcurrentWrites` or `TENANT_MAX_CONCURRENT_TOUR_WRITES` |

Unknown/empty `workspaceType` → policy resolver returns `null`; tenant-level platform rate limit remains.

---

## Exemptions

- `resolveWorkspaceResourcePolicy({ systemExempt: true })` bypasses workspace quota enforcement for platform admin/system jobs.
- Platform tenant rate-limit config (`resolveTenantRateLimitConfig`) remains the outer envelope.

---

## Observability hooks

| Event | Metric |
|-------|--------|
| Rate limit exceeded | existing tenant rate-limit response (`429`) + trace id |
| Tour write concurrency shed | `tour_write_concurrency_shed_total{tenant_id}` |

MAT-012 adds `workspace_slo_event_total` for throttling-adjacent journey failures where applicable.

---

## Theme JSON example

```json
{
  "workspaceResourceQuotas": {
    "denali": {
      "readRpm": 900,
      "writeRpm": 60,
      "maxConcurrentWrites": 4
    },
    "urban": {
      "writeRpm": 30
    }
  }
}
```

---

## Invariants

1. Workspace A quota exhaustion must not throttle workspace B (separate consumer keys).
2. Tenant/workspace identity is required — no IP-only tenancy control.
3. No Denali hardcoding — workspace type is data-driven.
4. Queue fairness inherits existing outbox per-tenant defer metrics (`outbox_relay_tenant_deferred_total`).

---

## Tests

- `apps/api/src/middleware/workspace-resource-policy.spec.ts`
- `tenant-rate-limiter` integration via existing API specs
- Urban/Denali regression in M2 aggregate gates

*Architect, documentation status: Updated. Link to docs: `docs/operations/workspace-resource-controls.md`.*

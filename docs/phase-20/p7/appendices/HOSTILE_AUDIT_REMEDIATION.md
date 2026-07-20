# Hostile audit remediation (2026-07-20)

```yaml
doc_id: HOSTILE_AUDIT_REMEDIATION
status: LANDED
branch: booking/capacity-concurrency-cert
source: hostile production review of HEAD f607c376 + dirty WT
```

## P0 — capacity authority

**Problem:** `tourCapacityMax` accepted from client `registrationIntake` on create; approve reused stored intake. Public/operator clients could inflate the ceiling while advisory locks still succeeded.

**Model (updated):** Booking still owns occupancy SoT and fail-closed enforcement. **Tour canonical `capacityMax` is the capacity ceiling authority** when present. Client `registrationIntake.tourCapacityMax` is never allowed to raise the ceiling above the tour SoT (server max always wins when resolved). When tour SoT is missing, intake remains last-resort for fixture/workspaces without the field — production Denali tours publish `capacityMax` and close the inflation path.

**Port:** `BookingTourCapacityPort.resolveTourCapacityMax(tenantId, tourId)` — host adapter reads `Tour.canonical.data.capacityMax` via `createTourStorageRepository().getById`.

## P0 — finance recon authz

**Problem:** Recon/repair reused `metrics:read` scope and admin Prisma with ID-only finding access; prodlike+development skipped JWT.

**Model:** Dedicated ops scope `finance:recon`; finding get/mark require `tenantId`; JWT required whenever `requiresProductionGradeIntegrity()` is true.

## P0 — outbox external worker

**Problem:** `OUTBOX_RELAY_EXTERNAL_WORKER=true` alone passed boot.

**Model:** External mode also requires `APPS_API_WORKER_ROLE=outbox-relay` (or documented worker role env) so boot cannot claim relay without a worker identity.

## P0 — codegen merge safety

**Problem:** Tip `generateOutboxSideEffects` double-declared `reexportsBySpecifier` → SyntaxError.

**Model:** Single Map + `assertNoDuplicateEmittedSymbols` + drop-in unique-const guard on domain emitters.

## Cross-links

- [BOOKING_CAPACITY_OWNERSHIP.md](./BOOKING_CAPACITY_OWNERSHIP.md)
- [workspace-registry-codegen-modularization.mdoc](../../../dev/workspace-registry-codegen-modularization.mdoc)
- [STABILIZATION_WP0_DEV_RECONCILE.md](./STABILIZATION_WP0_DEV_RECONCILE.md)
- [STABILIZATION_WP_GATE.md](./STABILIZATION_WP_GATE.md)
- [SaaS Shared Kernel charter](../../phase-saas-kernel/CHARTER.md)

## Residual (not code-fixed this train)

| Item | Severity | Notes |
| ---- | -------- | ----- |
| 19 commits behind `origin/DEV` | P1 process (closed for Stabilization WP0) | Reconcile filed: [STABILIZATION_WP0_DEV_RECONCILE.md](./STABILIZATION_WP0_DEV_RECONCILE.md) — **no blind merge**; all 19 have tip twins |
| Portal login modal on WIP only | P1 product | Lives on `wip/portal-psc-20260718`, not this tip |
| Package-boundary allowlist includes finance/booking workspaces | P1 rubber-stamp | Required by codegen bindings; isolation enforced by import-boundary AST + workspace isolation guards, not package.json set equality |
| Tours without `capacityMax` still fall back to intake | P1 residual | Closed when tour SoT present; booking-ws2 without field remains fixture-compat path |

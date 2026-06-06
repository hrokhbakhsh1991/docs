# Enterprise gap register (TEMP sprint — closed)

> **Sprint status:** **CLOSED** 2026-06-05 (Phase 4–5 enterprise hardening; Phase 6 entry items done)  
> **Archive:** [`TEMP/enterprise-gap-priority-list.md`](../../../TEMP/enterprise-gap-priority-list.md)  
> **Official gap tracking:** [`PHASE-5-GAP-REGISTER.md`](PHASE-5-GAP-REGISTER.md)  
> **Decisions:** [`../appendices/IMPLEMENTATION-DECISIONS.md`](../appendices/IMPLEMENTATION-DECISIONS.md)

## Scope

| In scope (closed)       | Out of scope (deferred)                        |
| ----------------------- | ---------------------------------------------- |
| P0–P2 per TEMP list     | P1-14 OpenTelemetry (post–Phase 6 main)        |
| P1-8 JWT prod (DEC-023) | P1-19 Bulk import API                          |
| P2-5 design doc only    | P2-5 runtime semaphore (Phase 7 multi-replica) |

Phase 6 **main** work (Denali workspace port) is tracked in [`docs/phase-6/`](../phase-6/README.md) — not this register.

---

## P0 — closed

All P0 items are **implemented** (idempotency, errors, workspace auth, tenant-config, shutdown, outbox throughput, fairness, RLS, rate limit, envelope guard, atomic persist).

---

## P1 — closed (in-scope)

| ID                           | Status | Notes                                       |
| ---------------------------- | ------ | ------------------------------------------- |
| P1-1 Redis rate limiter      | Done   | `RedisRateLimiterStore` when `REDIS_URL`    |
| P1-3 Reconciliation          | Done   | `projection-reconciliation.ts`              |
| P1-4 Parallel outbox         | Done   | DEC-017                                     |
| P1-5 Warm engine             | Done   | DEC-016                                     |
| P1-6 PATCH + `row_version`   | Done   | `tour-update-api.md`                        |
| P1-7 SCHEMA_VERSION_MISMATCH | Done   | DEC-019                                     |
| P1-8 JWT prod TTL            | Done   | DEC-023, `production-auth-policy.md`        |
| P1-9 RuleEngine tenant cap   | Done   | DEC-018                                     |
| P1-20 phase-5:gate           | Waiver | PASS@850ms; DEC-022 trunk tier              |
| P1-21 GAP-P5-03              | Done   | Contract scaffold; 5.2–5.5 behavioral specs |

## P1 — deferred (post–Phase 6 main)

| ID                    | Status   | Notes                                                |
| --------------------- | -------- | ---------------------------------------------------- |
| P1-14 OpenTelemetry   | Deferred | ALS + GUC sufficient for Phase 5–6; OTel spans later |
| P1-19 Bulk import API | Deferred | Phase 6+ product API                                 |

---

## P2 — closed

| ID                           | Status      | Notes                                                                       |
| ---------------------------- | ----------- | --------------------------------------------------------------------------- |
| P2-1 CI tiering              | Done        | DEC-022                                                                     |
| P2-2 noise-neighbor nightly  | Done        | HTTP probe nightly-only                                                     |
| P2-3 RUN_SOAK nightly        | Done        | `test:nightly:soak`                                                         |
| P2-4 This register           | Done        | Sprint closed                                                               |
| P2-5 Connection budget       | Design done | [`connection-budget.md`](../appendices/connection-budget.md); code deferred |
| P2-6 test-inventory          | Done        | CI tiers                                                                    |
| P2-7 Doc composite GAP-P5-01 | Done        | behavioral 86% in IMPLEMENTATION-TRUTH                                      |

---

## Verification

```bash
# Trunk (PR / phase-5:gate)
pnpm --filter @apps/api test

# Nightly probes
pnpm run test:nightly
```

## Cross-links

| Doc                                                  | Role                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------- |
| [`IMPLEMENTATION-TRUTH.md`](IMPLEMENTATION-TRUTH.md) | Subphase ledger + § Enterprise sprint deferred             |
| [`PHASE-5-GAP-REGISTER.md`](PHASE-5-GAP-REGISTER.md) | GAP-P5-\* audit rows                                       |
| [`../phase-6/README.md`](../phase-6/README.md)       | Phase 6 main scope (Denali) — excludes deferred rows above |

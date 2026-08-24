# Service level objectives — internal baseline (MAT-015)

**Program:** Enterprise Maturity MAT-M1  
**Status:** INTERNAL BASELINE — not an external customer SLA  
**Date:** 2026-08-24  
**Telemetry:** `apps/api/src/observability/logger.ts`, `apps/api/src/http/request-logging.ts` (`event: http.request`)

External SLA promises require production evidence from `docs/dev/production-closure-ledger.md` — **not available in M1**.

---

## Terminology

| Term | Definition |
|------|------------|
| **SLI** | Quantitative measure of service behavior |
| **SLO** | Internal target for an SLI over a rolling window |
| **SLA** | Contractual commitment to customers — **unset until closure ledger green** |
| **Error budget** | Allowed bad events before freeze: `(1 - SLO) × eligible events` |
| **Paging threshold** | Alert that wakes on-call — stricter than ticket alerts |

---

## Service areas

### 1. API availability

| Field | Value |
|-------|-------|
| **SLI** | Ratio of `http.request` with `statusCode < 500` to total `http.request` |
| **Measurement** | Structured logs / log aggregator; metric derivation in staging+ |
| **SLO** | **99.5%** over 30d rolling (internal) |
| **Error budget** | **0.5%** of requests may 5xx |
| **Alert threshold** | **> 1%** 5xx in 5m → P1 page (per OBSERVABILITY-RUNBOOK) |
| **Ticket threshold** | **> 0.5%** 5xx in 15m → P2 ticket |
| **Owner** | Platform API on-call |
| **Review** | Weekly ops review |
| **Gaps** | **IMPLEMENTED_NOT_MEASURABLE** in dev/memory-driver env — needs staging log sink (MAT-012) |

### 2. Critical registration journey

| Field | Value |
|-------|-------|
| **SLI** | Successful `POST` registration/booking create (2xx, no `BOOKING_*` / `REGISTRATION_*` 5xx) |
| **Measurement** | `http.request` filtered by route + `workspaceType` |
| **SLO** | **99.0%** success over 7d (internal) |
| **Error budget** | **1.0%** failed creates |
| **Alert threshold** | **> 2%** failure rate in 15m for single `workspaceType` → P1 page |
| **Ticket threshold** | **> 1%** in 1h → P2 ticket |
| **Owner** | Booking + portal squad |
| **Review** | Weekly |
| **Gaps** | Per-journey metric not automated — **dependency MAT-012** (tenant dashboards) |

### 3. Publish / write path

| Field | Value |
|-------|-------|
| **SLI** | Tour persist/publish requests completing without `CANONICAL_VALIDATION_FAILED` or 5xx |
| **Measurement** | API logs on tour write routes + validation pipeline stage tag (future) |
| **SLO** | **99.5%** over 30d |
| **Error budget** | **0.5%** |
| **Alert threshold** | Spike in `CANONICAL_VALIDATION_FAILED` **> 3×** 7d baseline in 1h → P2 ticket |
| **Paging** | Only if paired with 5xx **> 1%** (shared API SLO) |
| **Owner** | Tour core + workspace adapters |
| **Review** | Bi-weekly |
| **Gaps** | Stage-level SLI not in logs today — add `validationStage` field (**MAT-012**) |

### 4. Portal / auth

| Field | Value |
|-------|-------|
| **SLI** | Member session bootstrap + OTP verify success rate |
| **Measurement** | Portal smoke (`SMK-PTL-*`) in CI; production via `http.request` on auth routes |
| **SLO** | **99.5%** auth success over 30d |
| **Error budget** | **0.5%** |
| **Alert threshold** | OTP failure rate **> 2%** in 15m → P1 page |
| **Ticket** | Elevated 401/403 on portal host → P2 |
| **Owner** | Portal squad (PCMS-001) |
| **Review** | Weekly |
| **Gaps** | No per-tenant auth burn — **MAT-012** |

### 5. Finance critical operations

| Field | Value |
|-------|-------|
| **SLI** | Finance mutation success (payment post, receipt submit, ledger append) without 5xx |
| **Measurement** | `/finance/*` route logs + finance event outbox depth |
| **SLO** | **99.9%** over 30d (higher bar — money movement) |
| **Error budget** | **0.1%** |
| **Alert threshold** | Any silo DB error on finance route → P1 (OBSERVABILITY-RUNBOOK) |
| **Ticket** | Outbox lag **> 5 min** p95 → P2 |
| **Owner** | Finance platform |
| **Review** | Weekly |
| **Gaps** | Outbox depth metric not exported to alertmanager — **MAT-012** |

---

## Paging vs ticket matrix (consolidated)

| Severity | Trigger | Channel |
|----------|---------|---------|
| **P0** | Missing tenant context on tenant route (audit sample) | Page immediately |
| **P1** | API 5xx **> 1%** / 5m; silo DB failure; registration **> 2%** fail / 15m; finance silo error | Page on-call |
| **P2** | Rate limit storm; log queue drop; elevated validation failures | Ticket + Slack |

Runbook cross-ref: `docs/phase-7/appendices/OBSERVABILITY-RUNBOOK.md`

---

## Error budget policy

1. When monthly error budget **exhausted** for an SLO → freeze risky releases for that area until burn recovers or Architect approves exception.
2. Budget burn from deploy regression → roll back deployment stamp (MAT-010, M3 design).
3. Do not publish external SLA until `production-closure-ledger` shows staging/prod smoke PASS.

*Architect, documentation status: Updated. Link to docs: `docs/operations/service-level-objectives.md`.*

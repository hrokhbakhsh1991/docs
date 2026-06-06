# Phase 7 — Enforcement (RULE-P7 + subphase DoD)

```yaml
enforcement_version: "2026-06-04-v1"
fail_token: FAIL
verification_matrix: audits/verification-matrix.md
```

## RULE-P7-001: platform-core unchanged

Urban-specific logic **must not** land in `packages/platform-core`. Violation = FAIL + revert.

## RULE-P7-002 — urban minimal scope

No finance, MinIO, or Denali-scale registry in urban plugin. See URBAN-MINIMAL-SCOPE.

## RULE-P7-003 — no Denali rail coupling

`urban_event` profile semantics only via plugin registry — **never** route urban wizard through Denali rail.

## RULE-P7-004 — TenantConnectionRouter home

Silo routing implementation lives in `packages/tenant-kernel` — not ad-hoc in apps/api.

## RULE-P7-005 — observability generic

Log fields and runbook apply to **all** workspaces — no `if (urban)` logging branches.

## RULE-P7-006 — rate limits per tenant tier

Redis keys include tenantId + tier — pool and silo may differ caps.

## RULE-P7-007 — no legacy runtime import

Same as RULE-P6-008 — trunk apps must not import `legacy/`.

## RULE-P7-008 — genericity proof required

7.2 must produce zero urban-only platform-core diff before 7.3 bootstrap merges.

## RULE-P7-009 — parallel 7.5 / 7.6

Observability and rate limits may proceed in parallel after 7.4 — **both** required before 7.7 (TG-P7-005).

## RULE-P7-011 — TG-P7-005 enforcement

7.7 FAIL if either 7.5 or 7.6 not VERIFIED_BEHAVIORAL — see [`phase-7-state-machine.md`](phase-7-state-machine.md).

## RULE-P7-010 — ci:integrity at closure

7.9 FAIL if `ci:integrity` red — doc guard alone insufficient.

## subphase_dod

| Subphase | DoD token    | Proof                       |
| -------- | ------------ | --------------------------- |
| 7.0      | ENTRY_PASS   | `phase-6:gate` + entry yaml |
| 7.1      | URBAN_SHELL  | package builds              |
| 7.2      | GENERICITY   | platform-core diff guard    |
| 7.3      | BOOTSTRAP    | resolve tests green         |
| 7.4      | E2E_PUBLISH  | HTTP create→publish         |
| 7.5      | OBS_COMPLETE | runbook + log audit         |
| 7.6      | RATE_LIMITS  | Redis test or BLOCKER       |
| 7.7      | ROUTER_SILO  | tenant-kernel tests         |
| 7.8      | ADVERSARIAL  | ci:integrity                |
| 7.9      | PLATFORM_DOD | phase-7:gate + forensic ≥8  |

## Forbidden IDs (P7-F-\*)

| ID       | Rule                         |
| -------- | ---------------------------- |
| P7-F-001 | Urban Denali-II scope creep  |
| P7-F-002 | platform-core urban branch   |
| P7-F-003 | Denali rail for urban        |
| P7-F-004 | Silo default for all tenants |
| P7-F-005 | Closure from doc guard only  |

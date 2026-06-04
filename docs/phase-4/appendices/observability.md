# Phase 4 — Observability scaffold

```yaml
agent_load_tier: T1_gate
machine_readable: true
scope: tenant-boundary hooks only
contracts: no new mandatory P4-E-* for merge
```

> **Scope:** tenant-boundary observability hooks — **not** full OpenTelemetry stack (Phase 7)

## Industry patterns adopted (Phase 4)

| Pattern | Phase 4 obligation | Verification |
|---------|-------------------|--------------|
| **Correlation ID** | Propagate `x-request-id` / `traceparent` on API ingress; include in structured logs | Code review + **recommended** middleware smoke (see below) |
| **Structured logging** | JSON or key=value logs with `tenantId`, `subdomain`, `route` — never log secrets | Lint / sample log audit |
| **Fail-closed tenant context** | Missing tenant → 401/403 before handler (P4-E-TENANT-01) | tenant-security.spec.ts |
| **Event envelope metadata** | `tenantId` on every domain event (P4-E-EVT-01) | events.spec.ts |
| **Health/readiness** | `/health` liveness; readiness includes Postgres when `DATABASE_URL` set | ops runbook |

## Deferred (explicit — preserve architecture)

| Capability | Target phase | Rationale |
|------------|--------------|-----------|
| OpenTelemetry collectors + exporters | 7 | MAP observability §10 full stack |
| Per-tenant metrics cardinality explosion | 7 | Requires silo routing design |
| Distributed trace across outbox relay | 5+ | Outbox not in Phase 4 |
| SLO dashboards / alerting | Post-5 | Needs stable data layer |

## Subphase observability hooks

| Subphase | Hook |
|----------|------|
| 4.1 | Log host-parse outcome (reserved vs tenant) at debug — no PII |
| 4.2 | Log `set_config` tenant scope in integration failures only |
| 4.3 | Log provision actions with `tenantId` in dev route |
| 4.4 | Log tenant-config fetch miss vs hit |
| 4.5 | Log `TourCreated` publish with `tenantId` + `eventId` |
| 4.6 | Gate report `reports/phase-4-gate-*.json` as CI artifact |

## Recommended verification (non-gating)

```yaml
correlation_id_smoke:
  status: RECOMMENDED_NOT_P4_E
  when: "new API middleware or global exception filter"
  assert:
    - "response includes x-request-id or echoes traceparent"
    - "structured log line contains same id as request header"
  fail_action: "fix before merge — does not add P4-E-*"
```

## AI agent rules

- Do **not** add mandatory OTel dependencies in Phase 4 PRs  
- Do **not** replace P4-E-* tests with log-grep closure  
- **Do** ensure new API paths extend tenant-security + structured log fields

**Cross-ref:** [`../phase-4-enforcement.md`](../phase-4-enforcement.md) `forensic_truth` — JWT/OTel aspirational rows

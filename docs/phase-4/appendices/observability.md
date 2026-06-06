# Phase 4 — Observability scaffold

```yaml
agent_load_tier: T1_gate
machine_readable: true
scope: tenant-boundary hooks only
contracts: no new mandatory P4-E-* for merge
```

> **Scope:** tenant-boundary observability hooks — **not** full OpenTelemetry stack (Phase 7)

## Industry patterns adopted (Phase 4)

| Pattern                        | Phase 4 obligation                                                                                                        | Verification                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Correlation ID**             | Propagate `x-request-id` / `traceparent` on API ingress; include in structured logs                                       | Code review + **recommended** middleware smoke (see below) |
| **Structured logging**         | JSON logs — shared SIEM stream uses `tenant_hash` + stable codes only (DEC-037); never log secrets or raw `Error.message` | `log-privacy.spec.ts`, `error-enrichment.spec.ts`          |
| **Zero `console` in `src/`**   | Production runtime forbids `console.*` under `apps/api/src/` (Phase 2 LOG-V-01 / STD-BYPASS-02)                           | `guard-no-console-in-src.mjs`, `graceful-shutdown.spec.ts` |
| **Fail-closed tenant context** | Missing tenant → 401/403 before handler (P4-E-TENANT-01)                                                                  | tenant-security.spec.ts                                    |
| **Event envelope metadata**    | `tenantId` on every domain event (P4-E-EVT-01)                                                                            | events.spec.ts                                             |
| **Health/readiness**           | `/health` liveness; readiness includes Postgres when `DATABASE_URL` set                                                   | ops runbook                                                |

## Deferred (explicit — preserve architecture)

| Capability                               | Target phase | Rationale                        |
| ---------------------------------------- | ------------ | -------------------------------- |
| OpenTelemetry collectors + exporters     | 7            | MAP observability §10 full stack |
| Per-tenant metrics cardinality explosion | 7            | Requires silo routing design     |
| Distributed trace across outbox relay    | 5+           | Outbox not in Phase 4            |
| SLO dashboards / alerting                | Post-5       | Needs stable data layer          |

## Subphase observability hooks

| Subphase | Hook                                                          |
| -------- | ------------------------------------------------------------- |
| 4.1      | Log host-parse outcome (reserved vs tenant) at debug — no PII |
| 4.2      | Log `set_config` tenant scope in integration failures only    |
| 4.3      | Log provision actions with `tenantId` in dev route            |
| 4.4      | Log tenant-config fetch miss vs hit                           |
| 4.5      | Log `TourCreated` publish with `tenantId` + `eventId`         |
| 4.6      | Gate report `reports/phase-4-gate-*.json` as CI artifact      |

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
- Do **not** replace P4-E-\* tests with log-grep closure
- **Do** ensure new API paths extend tenant-security + structured log fields

## Shared-stream fields (DEC-037 / LOG-COL-01…04)

| Event                            | Structured fields                                                                                           | Never on shared stream                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `http.error.internal`            | `correlation_id`, `tenant_hash`, `error_code`                                                               | `tenant_id`, `message`, `stack`                    |
| `projection.inconsistency`       | `tenant_hash`, `domain_event_id`, `reason_code`                                                             | `tenantId`, `tourId`, `reason`                     |
| `graceful_shutdown.failed`       | `code`                                                                                                      | `console.*`, interpolated error text               |
| `client.validation_failed`       | `error_code`, `tenant_hash`, `correlation_id`                                                               | `message`, `detail`, raw `tenant_id` (DEC-038)     |
| `client.schema_version_mismatch` | `error_code`, `tenant_hash`, `correlation_id`                                                               | version text in log fields                         |
| `http.request`                   | `http.method`, `http.path` (normalized), `http.statusCode`, `correlation_id` when trace ALS bound (DEC-048) | raw query strings, UUID segments in path (DEC-042) |
| `outbox.relay.error`             | `error_code`                                                                                                | `message`, raw Prisma/SQL text (DEC-042)           |

Env: `LOG_HASH_KEY` (or `AUDIT_PSEUDONYM_KEY`) for HMAC tenant pseudonym in logs.

**Cross-ref:** [`../phase-4-enforcement.md`](../phase-4-enforcement.md) `forensic_truth` — JWT/OTel aspirational rows

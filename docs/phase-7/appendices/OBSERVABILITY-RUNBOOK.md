# Observability runbook (MAP §10)

```yaml
runbook_version: "2026-06-04-v1"
decision: DEC-P7-005
map_ref: docs/MIGRATION-MAP.md §10
```

## Required log fields (§10.2)

| Field           | Source                 | Required      |
| --------------- | ---------------------- | ------------- |
| `requestId`     | middleware             | yes           |
| `tenantId`      | tenant context         | yes           |
| `workspaceType` | plugin resolver        | yes (Phase 7) |
| `tenantTier`    | TenantConnectionRouter | yes (Phase 7) |
| `level`         | logger                 | yes           |
| `message`       | logger                 | yes           |
| `durationMs`    | request lifecycle      | yes           |

## Alert matrix (target)

| Alert                  | Condition                    | Severity | Threshold                  |
| ---------------------- | ---------------------------- | -------- | -------------------------- |
| High 5xx rate          | `statusCode >= 500`          | P1       | >1% over 5m rolling window |
| Rate limit spike       | HTTP 429 rate                | P2       | >50/min per tenant         |
| Silo connection fail   | router resolve error         | P1       | any in 1m                  |
| Missing tenant context | log audit missing `tenantId` | P0       | any request in sample      |
| Missing workspaceType  | log audit Phase 7            | P1       | >0.1% of requests          |

## On-call steps

1. Identify `requestId` from user report
2. Filter logs by `tenantId` + time window
3. Check `tenantTier` — silo may need dedicated DB failover
4. Escalate if RLS leak suspected — run Phase 4 adversarial subset

## Optional OTel (DEC-P7-012)

- Trace propagation via `traceparent` header
- Exporter: `OTEL_EXPORTER_OTLP_ENDPOINT` — see env-runtime-matrix
- **Not blocking** 7.9 minimal DoD

## Verification

- REQ-P7-015..017 — subphase 7.5

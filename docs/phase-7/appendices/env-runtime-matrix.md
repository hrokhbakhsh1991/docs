# Phase 7 — Environment & runtime matrix

```yaml
matrix_version: "2026-06-04-v1"
```

| Variable                      | Required         | Subphase | Purpose                                 |
| ----------------------------- | ---------------- | -------- | --------------------------------------- |
| `DATABASE_URL`                | yes (behavioral) | 7.4+     | Pool tier default                       |
| `REDIS_URL`                   | optional         | 7.6      | Rate limits — BLOCKER if unset          |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | optional         | 7.5      | Trace export (DEC-P7-012)               |
| `SILO_DATABASE_URL_*`         | optional         | 7.7      | Per-tenant override via `tenant_routes` |
| `RATE_LIMIT_POOL_RPM`         | optional         | 7.6      | Pool tier default cap                   |
| `RATE_LIMIT_SILO_RPM`         | optional         | 7.6      | Enterprise tier cap                     |

## Skip matrix

| Env missing | Behavior                         | Document in          |
| ----------- | -------------------------------- | -------------------- |
| `REDIS_URL` | Rate limit disabled; 7.6 BLOCKER | IMPLEMENTATION-TRUTH |
| `OTEL_*`    | Logs only — acceptable for 7.9   | DEC-P7-012           |

## Verification

- REQ-P7-018..020 reference this matrix

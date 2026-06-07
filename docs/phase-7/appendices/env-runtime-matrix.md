# Phase 7 — Environment & runtime matrix

```yaml
matrix_version: "2026-06-07-v2"
```

| Variable                         | Required         | Subphase | Purpose                                 |
| -------------------------------- | ---------------- | -------- | --------------------------------------- |
| `DATABASE_URL`                   | yes (behavioral) | 7.4+     | Pool tier default                       |
| `REDIS_URL`                      | optional         | 7.6      | Redis rate-limit store when set         |
| `OTEL_EXPORTER_OTLP_ENDPOINT`    | optional         | 7.5      | Trace export (DEC-P7-012)               |
| `OTEL_SERVICE_NAME`              | optional         | 7.5      | Service name in OTLP resource           |
| `SILO_DATABASE_URL_*`            | optional         | 7.7      | Per-tenant override via `tenant_routes` |
| `RATE_LIMIT_POOL_RPM`            | optional         | 7.6      | Pool connection-tier cap (RPM, 60s win) |
| `RATE_LIMIT_SILO_RPM`            | optional         | 7.6      | Silo connection-tier cap (≥ pool)       |
| `TENANT_RATE_LIMIT_POINTS`       | optional         | 5.6/7.6  | In-memory fallback / legacy override    |
| `TENANT_RATE_LIMIT_DURATION_SEC` | optional         | 5.6/7.6  | Bucket window when not using RPM env    |
| `TENANT_RATE_LIMIT_ENABLED`      | optional         | 5.6/7.6  | `false` disables limiter                |

### Rate limit resolution (7.6)

When `RATE_LIMIT_POOL_RPM` or `RATE_LIMIT_SILO_RPM` is set, effective bucket is `points = RPM`, `durationSec = 60`.
`TENANT_RATE_LIMIT_POINTS` remains the fallback when RPM vars are unset (DEC-015 in-memory tests).

Redis consumer key shape: `ratelimit:{tenantId}:{connectionTier}:{operationTier}:{method}:{path}`.

## Skip matrix

| Env missing | Behavior                         | Document in          |
| ----------- | -------------------------------- | -------------------- |
| `REDIS_URL` | Rate limit disabled; 7.6 BLOCKER | IMPLEMENTATION-TRUTH |
| `OTEL_*`    | Logs only — acceptable for 7.9   | DEC-P7-012           |

## Verification

- REQ-P7-018..020 reference this matrix

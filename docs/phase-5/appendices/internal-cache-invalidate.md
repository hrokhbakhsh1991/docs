# Internal cache invalidate + Redis rate-limit flush (DEC-106 / RB-GAP-13)

```yaml
status: implemented
phase: 5 evolution — P2 Phase 3 (+ Platform 5.2 DEC-120)
closes: RB-GAP-13 (partial), RB-GAP-12 (partial)
related: prod-cache-invalidate-service-jwt.md DEC-120, production-deploy-checklist.md § Bad deploy rollback
```

## Problem

Bad-deploy rollback leaves stale tenant registry cache and Redis `ratelimit:*` keys — no in-repo flush API ([RB-GAP-13](phase5-evolution-audit.md)).

## Decision

`POST /internal/cache/invalidate` (dev/test only):

| Field                             | Effect                                                          |
| --------------------------------- | --------------------------------------------------------------- |
| `tenantId` + optional `subdomain` | `invalidateTenantRegistryCache`                                 |
| `flushRateLimit: true`            | `SCAN` + `DEL` keys matching `ratelimit:*` when `REDIS_URL` set |

**Production (DEC-120):** same route with RS256 service JWT (`ops_scope: cache:invalidate`) — see [`prod-cache-invalidate-service-jwt.md`](prod-cache-invalidate-service-jwt.md). `/internal/*` remains cluster-internal only.

## Verification

```bash
cd apps/api && pnpm run guard:internal-cache-invalidate
node --import tsx --test test/4-integration/internal-cache-invalidate.spec.ts
```

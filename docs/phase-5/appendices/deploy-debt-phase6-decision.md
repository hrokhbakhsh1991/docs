# Deployment debt — Phase 6 version strategy (DEC-100)

```yaml
status: decided
phase: 5 evolution — P1 Phase 2
closes: DEPLOY-DEBT-01, DEPLOY-DEBT-02 (decision only — implementation Phase 6)
related: phase5-evolution-audit.md § API versioning
```

## Current posture (unchanged in Phase 2)

| Dimension                          | Verdict                             |
| ---------------------------------- | ----------------------------------- |
| Header routing (`Accept-Version`)  | **No** — pathname-only dispatch     |
| Tours URL                          | Unversioned `/tours`                |
| Tenant config                      | `GET /api/v2/tenant-config` only    |
| Breaking workspace `schemaVersion` | Strict equality → **400** (DEC-019) |

## Phase 6 decision (lockstep until then)

**Defer parallel API versions to Phase 6.** Until `migrateCanonical` + dual-read (MAP §8.3) land:

1. **Breaking HTTP or canonical changes** require **lockstep** deploy: API + workspace plugin + all clients in one window.
2. **URL versioning** — when tours move to `/api/v2/tours`, ship **expand** migration first (optional alias route or gateway rewrite), then **contract** old path in a later release — not before Phase 6.1.
3. **No `Accept-Version` fan-out** in trunk before Phase 6 — documented debt, not a bug.

## Operator runbook (today)

- Bump `schemaVersion` in workspace plugin → coordinate client releases; expect **400** for stale payloads until clients upgrade.
- Do **not** rely on legacy `openapi.json` for thin API routing — use [`openapi/openapi.json`](../../../apps/api/openapi/openapi.json) from `pnpm run openapi:generate`.

## Verification

Decision doc only — behavioral gates unchanged until Phase 6 subphases.

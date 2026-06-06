# db:test-reset production guard (DEC-095 / CAE-GAP-05)

```yaml
status: implemented
phase: 5 evolution — P0 Phase 1
closes: CAE-GAP-05, AR-30-10
related: phase5-evolution-audit.md § Catastrophic Admin Error
```

## Problem

`pnpm run db:test-reset` runs `TRUNCATE … CASCADE` on all tenant tables via `DATABASE_URL_ADMIN`. A misconfigured admin URL against production wipes canonical data and audit — no in-script guard ([CAE-GAP-05](phase5-evolution-audit.md)).

## Decision

`scripts/db-test-reset.sh` fail-closed rules:

| Condition                                                                                          | Action                                      |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `NODE_ENV=production`                                                                              | **exit 1** immediately                      |
| URL host matches prod heuristics (`prod`, `production`, `.rds.`, `azure`, `cloudsql`, `neon.tech`) | **exit 1** unless `CONFIRM_TEST_RESET=1`    |
| `CONFIRM_TEST_RESET=1` with prod-like URL                                                          | Allow (explicit operator ack) + log warning |

Heuristics apply to `DATABASE_URL_ADMIN` and `DATABASE_URL` (whichever is used).

`phase-5:gate` continues to call `db:test-reset` under `NODE_ENV=test` against local compose — unchanged.

## Verification

```bash
node apps/api/scripts/guard-db-test-reset-prod.mjs
NODE_ENV=production bash scripts/db-test-reset.sh  # expect exit 1
```

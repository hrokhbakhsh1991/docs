# Phase 5 evolution — Phase 4 gate rollup (DEC-117)

```yaml
status: implemented
phase: 5 evolution — Phase 4.8
closes: evolution CI pack extension (DEC-109 → DEC-117)
related: phase5-evolution-p0-phase1.md … phase5-evolution-p2-phase3.md
```

## Problem

Phase 4 evolution work (DEC-110…115) added **six** new static guards incrementally, but only `phase-5:evolution-gate` (DEC-109) listed them inline — no dedicated **Phase 4 closure** artifact for CI / PR verification.

## Decision

| Item          | Choice                                                           |
| ------------- | ---------------------------------------------------------------- |
| Rollup script | `phase-5-evolution-phase4-gate.mjs`                              |
| Command       | `pnpm run phase-5:evolution-phase4-gate`                         |
| Parent gate   | `phase-5:evolution-gate` invokes phase-4 rollup **first**        |
| Meta guard    | `guard:evolution-phase4-gate` — wiring lock                      |
| Phase 4.7     | Covered by `guard:relay-backoff` (DEC-111 / idempotency backoff) |

### Phase 4 guard pack (6 steps)

| Step                                 | DEC               | Closes                |
| ------------------------------------ | ----------------- | --------------------- |
| `guard:outbox-auto-retry`            | DEC-110           | SH-GAP-07             |
| `guard:relay-backoff`                | DEC-111 + DEC-116 | SH-GAP-06/09/10/11/12 |
| `guard:canonical-tx-transient-retry` | DEC-112           | SH-GAP-01/02/03       |
| `guard:pool-saturation-retry-after`  | DEC-113           | SH-GAP-05             |
| `guard:priority-load-shed`           | DEC-114           | SCAL-LIM-05/12        |
| `guard:projection-auto-reconcile`    | DEC-115           | F-04                  |

## Verification

```bash
cd apps/api
pnpm run phase-5:evolution-phase4-gate
pnpm run phase-5:evolution-gate   # parent — phase4 + phases 1–3
```

# Open Work Ledger (truth-synced)

```yaml
doc_role: temporary_work_ledger
created: 2026-07-21
updated: 2026-07-21
tip: pending_next_commit
canonical_branch: booking/capacity-concurrency-cert
```

Status legend: `DONE` · `PARTIAL` · `OPEN` · `BLOCKED_ON_ARCHITECT` · `PARKED` · `DECIDED`

## A — Doc truth

| ID | Item | Status |
| -- | ---- | ------ |
| A1 | TEMP roadmap §2.2 match tip/WT | DONE |
| A2 | TRAIN_CLOSURE tip SHA | DONE (refresh on next commit) |
| A3 | This ledger | DONE |

## B — Stabilization evidence gaps

| ID | Item | Status | Notes |
| -- | ---- | ------ | ----- |
| B4 | Targeted tsc/build for touched packages | **DONE** | tenant-kernel / finance-core build; `@apps/api` tsc --noEmit |
| B5 | `test:booking-capacity-stress` on tip | **DONE** | 3/3 PASS |
| B6 | DEV asymmetry decision (19 behind) | **DECIDED** | [STABILIZATION_B6_DEV_ASYMMETRY_DECISION.md](../../phase-20/p7/appendices/STABILIZATION_B6_DEV_ASYMMETRY_DECISION.md) — no merge; DEV pointer needs Architect `YES — DEV-POINTER` |
| B7 | Stash quarantine / reclaim tickets | **DONE** | [STABILIZATION_B7_STASH_QUARANTINE.md](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_QUARANTINE.md) — 10 stashes quarantined |

## C — Hostile / product residuals (P1)

| ID | Item | Status | Notes |
| -- | ---- | ------ | ----- |
| C8 | Tours without `capacityMax` intake fallback | **DONE** | Prodlike/production fail-closed in `resolveEffectiveTourCapacityMax`; test fixture path retained; authority spec covers both |
| C9 | Portal login modal on `wip/portal-psc-*` | **PARKED** | [STABILIZATION_C9_C10_PARKED.md](../../phase-20/p7/appendices/STABILIZATION_C9_C10_PARKED.md) |
| C10 | Package-boundary allowlist rubber-stamp | **PARKED** | Same doc — isolation via AST guards |

## D — Kernel implementation

| ID | Item | Status |
| -- | ---- | ------ |
| D-* | All `IMPL-SK*` rows | BLOCKED_ON_ARCHITECT | See `IMPLEMENTATION_BACKLOG.md` + `AGENT_STOP_GATE.md` |

## E — Explicit non-work

- Hollow notification/entitlement/file packages
- Blind `git merge origin/DEV`
- Auto `git stash pop`
- Full `phase-*:gate` without YES
- Kernel IMPL without `YES — IMPL-SK*`

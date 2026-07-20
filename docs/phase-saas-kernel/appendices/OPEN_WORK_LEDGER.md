# Open Work Ledger (truth-synced)

```yaml
doc_role: temporary_work_ledger
created: 2026-07-21
tip: pending_next_commit
canonical_branch: booking/capacity-concurrency-cert
```

Status legend: `DONE` · `PARTIAL` · `OPEN` · `BLOCKED_ON_ARCHITECT`

## A — Doc truth

| ID | Item | Status |
| -- | ---- | ------ |
| A1 | TEMP roadmap §2.2 match tip/WT | DONE (this sync) |
| A2 | TRAIN_CLOSURE tip SHA | DONE (this sync) |
| A3 | This ledger | DONE |

## B — Stabilization evidence gaps

| ID | Item | Status | Notes |
| -- | ---- | ------ | ----- |
| B4 | Targeted tsc/build for touched packages | **DONE** | tenant-kernel build PASS; finance-core build PASS; `@apps/api` `tsc --noEmit` PASS after removing unused import |
| B5 | `test:booking-capacity-stress` on tip | **DONE** | 3/3 PASS (~52s) on Postgres |
| B6 | DEV asymmetry decision (19 behind) | OPEN | WP0 filed; no merge yet |
| B7 | Stash quarantine / reclaim tickets | OPEN | 10 stashes |

## C — Hostile / product residuals (P1)

| ID | Item | Status |
| -- | ---- | ------ |
| C8 | Tours without `capacityMax` intake fallback | OPEN |
| C9 | Portal login modal on `wip/portal-psc-*` | OPEN (product ticket) |
| C10 | Package-boundary allowlist rubber-stamp | OPEN (owners via AST guards) |

## D — Kernel implementation

| ID | Item | Status |
| -- | ---- | ------ |
| D-* | All `IMPL-SK*` rows | BLOCKED_ON_ARCHITECT | See `docs/phase-saas-kernel/appendices/IMPLEMENTATION_BACKLOG.md` |

## E — Explicit non-work

- Hollow notification/entitlement/file packages
- Blind `git merge origin/DEV`
- Full `phase-*:gate` without YES

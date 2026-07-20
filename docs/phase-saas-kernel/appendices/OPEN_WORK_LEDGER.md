# Open Work Ledger (truth-synced)

```yaml
doc_role: temporary_work_ledger
created: 2026-07-21
updated: 2026-07-21
tip: 9f442601
canonical_branch: booking/capacity-concurrency-cert
```

Status legend: `DONE` · `PARTIAL` · `OPEN` · `BLOCKED_ON_ARCHITECT` · `PARKED` · `DECIDED`

**Unlock menu:** [ARCHITECT_UNLOCK_MENU.md](./ARCHITECT_UNLOCK_MENU.md) · **Stop gate:** [AGENT_STOP_GATE.md](./AGENT_STOP_GATE.md)

## A — Doc truth

| ID | Item | Status |
| -- | ---- | ------ |
| A1 | TEMP roadmap §2.2 match tip/WT | DONE (re-synced with B6–C10 + tip `9f442601`) |
| A2 | TRAIN_CLOSURE tip SHA | DONE |
| A3 | This ledger | DONE |
| A4 | Stale residual tables (maturity / WP-GATE note / stop gate) | DONE (this sync) |

## B — Stabilization evidence gaps

| ID | Item | Status | Notes |
| -- | ---- | ------ | ----- |
| B4 | Targeted tsc/build for touched packages | **DONE** | tenant-kernel / finance-core build; `@apps/api` tsc --noEmit |
| B5 | `test:booking-capacity-stress` on tip | **DONE** | 3/3 PASS |
| B6 | DEV asymmetry decision (19 behind) | **DECIDED** | No merge; pointer move needs `YES — DEV-POINTER` |
| B7 | Stash quarantine / reclaim tickets | **DONE** | Quarantine filed; reclaim needs `YES — STASH-RECLAIM-{n}` |

## C — Hostile / product residuals (P1)

| ID | Item | Status | Notes |
| -- | ---- | ------ | ----- |
| C8 | Tours without `capacityMax` intake fallback | **DONE** | Prodlike/production fail-closed; test fixture path retained |
| C9 | Portal login modal on `wip/portal-psc-*` | **PARKED** | Needs `YES — IMPL-PORTAL-MODAL` |
| C10 | Package-boundary allowlist rubber-stamp | **PARKED** | Isolation via AST guards — not a tip code defect |

## D — Kernel implementation

| ID | Item | Status |
| -- | ---- | ------ |
| D-* | All `IMPL-SK*` rows | BLOCKED_ON_ARCHITECT | Paste from unlock menu |

## E — Explicit non-work

- Hollow notification/entitlement/file packages
- Blind `git merge origin/DEV`
- Auto `git stash pop`
- Full `phase-*:gate` without YES
- Kernel IMPL from «ادامه بده» alone

## F — Honesty gaps (optional unlock only)

| ID | Item | Status |
| -- | ---- | ------ |
| F1 | Full monorepo `pnpm build` | OPEN until `YES — FULL-MONOREPO-BUILD` (WP4 deferred_clear) |

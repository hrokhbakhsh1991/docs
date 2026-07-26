# B7 — Stash reclaim `0` (archaeological)

```yaml
doc_id: STABILIZATION_B7_STASH_RECLAIM_0
status: RECLAIMED_SUPERSEDED
unlock: YES — STASH-RECLAIM-0
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_at_reclaim: e4e58665
stash_ref: stash@{0}
stash_sha: 6b9503b2dfb0f4378ad7504fb1e4234ad098a394
stash_message: "wip-before-finance-clean-replay: HostIo+WS3+docs"
base_branch_when_stashed: finance/phase-1-platform-boundaries
```

## Policy followed

1. Architect `YES — STASH-RECLAIM-0`
2. Inspected `git stash show --stat` + `git diff stash@{0}^1 stash@{0}`
3. Compared stash WIP tree to tip `e4e58665` (not blind `stash apply` / `pop`)
4. **No apply** — tip already carries the intent; applying would regress
5. **No drop** — B7 forbids cleaning the list by drop; entry remains for archaeology

## Intent of stash@{0}

Hostile Phase **1.9.2** finance event-surface cleanup + **WS3** packaging notes:

| Change | Stash intent |
| ------ | ------------ |
| HostIo | Rename to `PlatformFinanceEventReactionHostIo`; inject `tryClaimProcessedEvent` + `logReactionFailed` |
| Boot | Delete `register-workspace-finance-deps.ts` (Denali façade) |
| Denali adapter | Pass HostIo-derived deps into `runTourCreatedFinanceSideEffect` |
| Docs | Evolution plan §1.9.2 / §1.10.2 |
| Registry | finance-ws3 discovery in drop-in spec + package.json deps |

## Tip verdict (already landed)

| Check | Tip evidence |
| ----- | ------------ |
| `register-workspace-finance-deps.ts` | **Absent** on tip |
| `PlatformFinanceEventReactionHostIo` + claim/log | Present in `finance-event-reaction-registry.ts` |
| Denali `sideEffectDeps()` / explicit deps arg | Present in reaction adapter + `api-tour-created-adapter.ts` |
| Ownership specs forbid boot registrar | `finance-outbox-ownership.spec.ts` |
| `@app-tour/workspace-finance-ws3` | In `apps/api/package.json`; package exists |
| Drop-in discovers `finance-ws3` | `scripts/test/workspace-registry-drop-in.spec.mjs` |

**Conclusion:** stash@{0} is **superseded archaeology**. Zero file land required. Working tree (C9 modal / F1 docs) left untouched.

## Explicit non-actions

- Did **not** `git stash apply` / `pop` / `drop`
- Did **not** merge finance WIP branch
- Did **not** touch `stash@{3}` or other indices

## Companion

- Quarantine ledger: [STABILIZATION_B7_STASH_QUARANTINE.md](./STABILIZATION_B7_STASH_QUARANTINE.md)
- Unlock menu: [`docs/phase-saas-kernel/appendices/ARCHITECT_UNLOCK_MENU.md`](../../phase-saas-kernel/appendices/ARCHITECT_UNLOCK_MENU.md)

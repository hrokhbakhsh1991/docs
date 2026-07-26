# B7 — Stash reclaim `1` (archaeological)

```yaml
doc_id: STABILIZATION_B7_STASH_RECLAIM_1
status: RECLAIMED_SUPERSEDED
unlock: YES — STASH-RECLAIM-1
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_at_reclaim: e4e58665
stash_ref: stash@{1}
stash_sha: 7c939535dc2ceb87ee290c41e1a8159953d1734a
stash_message: "phase-1-wip-before-isolation"
base_branch_when_stashed: finance/phase-0-ownership-enforcement
```

## Policy followed

1. Architect `YES — STASH-RECLAIM-1` (Persian numeral ۱ accepted as `1`)
2. Inspected `git stash show --stat` + `git diff stash@{1}^1 stash@{1}`
3. Compared intent to tip `e4e58665`
4. **No apply** — tip already past this WIP; applying would regress Denali-hardcoded paths
5. **No drop** — B7 quarantine retention

## Intent of stash@{1}

Early Phase-1 finance **isolation** WIP:

| Change | Stash intent |
| ------ | ------------ |
| Delete | `resolve-finance-ledger-policy.ts` (Denali-only hand resolver) |
| Boot | `lazy-finance-service` → registry `resolveFinanceLedgerPolicy(workspaceType)` + `resolveFinanceReceiptDefaults` |
| Service | Remove default `DenaliFinanceReceiptDefaultsAdapter` construction |
| Web nav | Move `shouldShowFinanceNav` off extended-operator heuristic toward enablement module |
| Codegen | finance domain / orchestrator ownership hooks |
| Docs | Evolution plan + payment-ledger boundary notes |

## Tip verdict (already landed — further evolved)

| Check | Tip evidence |
| ----- | ------------ |
| `resolve-finance-ledger-policy.ts` | **Absent** |
| Boot composition | `lazy-finance-service.ts` uses `finance-dependency-registry` + per-workspaceType service map (beyond stash) |
| Nav enablement | `finance-nav-enablement.ts` + generated nav bindings; `finance-nav-access.ts` is ops-tab helpers only |
| Registry specs | `finance-dependency-registry.spec.ts` covers Denali / WS2 / fail-closed |

**Conclusion:** stash@{1} is **superseded archaeology**. Zero file land. Current WT (C9/F1/DEV docs) untouched.

## Explicit non-actions

- Did **not** `git stash apply` / `pop` / `drop`
- Did **not** reclaim overlapping docs hunks from older evolution-plan drafts

## Companion

- Quarantine: [STABILIZATION_B7_STASH_QUARANTINE.md](./STABILIZATION_B7_STASH_QUARANTINE.md)
- Prior: [STABILIZATION_B7_STASH_RECLAIM_0.md](./STABILIZATION_B7_STASH_RECLAIM_0.md)

# B6 — DEV pointer move (executed)

```yaml
doc_id: STABILIZATION_B6_DEV_POINTER_MOVE
status: EXECUTED
unlock: YES — DEV-POINTER
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_sha: e4e58665
previous_origin_DEV: 2f9bf664
```

## Decision reminder (B6)

- Tip remains product SoT — **no** `git merge origin/DEV` into tip.
- Material unique product on old `origin/DEV` tip: **none** (WP0 + B6 cherry audit).
- 19 DEV-only commits were twins / near-eq already represented on tip.

## Action

```bash
# Non-FF: DEV is not an ancestor of tip → force-with-lease required
git push --force-with-lease=refs/heads/DEV:2f9bf664 origin HEAD:DEV
```

Expected result: `origin/DEV` == tip `e4e58665` (same commit as `booking/capacity-concurrency-cert` at push time).

## Explicit non-claims

| Item | Status after pointer |
| ---- | -------------------- |
| Uncommitted WT (F1 ledger sync + C9 portal modal reclaim) | **Not** on `DEV` until committed + tip push |
| Stash reclaim (B7) | Still quarantined — needs `YES — STASH-RECLAIM-{n}` |
| Blind merge DEV → tip | Still forbidden (nothing left to merge after pointer) |

## Verify

```bash
git fetch origin
git rev-parse --short origin/DEV
# expect: e4e58665 (or newer tip if capacity branch advanced first)
git rev-list --left-right --count origin/DEV...origin/booking/capacity-concurrency-cert
# expect: 0  0
```

## Companion

- Decision: [STABILIZATION_B6_DEV_ASYMMETRY_DECISION.md](./STABILIZATION_B6_DEV_ASYMMETRY_DECISION.md)
- Unlock: [`docs/phase-saas-kernel/appendices/ARCHITECT_UNLOCK_MENU.md`](../../phase-saas-kernel/appendices/ARCHITECT_UNLOCK_MENU.md)

## Push result (verified)

| Check | Value |
| ----- | ----- |
| Before | `origin/DEV` = `2f9bf664` |
| After | `origin/DEV` = `e4e58665` |
| vs capacity tip | `0  0` (`origin/DEV...origin/booking/capacity-concurrency-cert`) |
| Method | `git push --force-with-lease=refs/heads/DEV:2f9bf664 origin HEAD:DEV` |


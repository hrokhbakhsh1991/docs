# B6 — DEV asymmetry decision (locked)

```yaml
doc_id: STABILIZATION_B6_DEV_ASYMMETRY
status: DECIDED
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_at_decision: d60b88d2
compared_to: origin/DEV @ 2f9bf664
decision: NO_MERGE — tip remains canonical; origin/DEV is historical until Architect YES
```

**Depends on:** [STABILIZATION_WP0_DEV_RECONCILE.md](./STABILIZATION_WP0_DEV_RECONCILE.md)

## 1. Refreshed divergence (2026-07-21)

| Metric | Value |
| ------ | ----- |
| `origin/DEV...HEAD` (left/right) | **19** behind / **81** ahead |
| `git cherry HEAD origin/DEV` | **15** already (`-`) / **4** near-eq (`+`) |
| Material unique product on DEV tip | **None** (WP0 §3–§4 still holds) |

Ahead count grew from WP0’s 66 → 81 because Stabilization/Kernel design commits landed on tip after the original WP0 snapshot. Behind count stays **19** — the same DEV-only set; no new DEV commits since `2f9bf664`.

## 2. Decision (B6 closed)

| Option | Verdict |
| ------ | ------- |
| Blind `git merge origin/DEV` → tip | **Forbidden** |
| Re-cherry the 4 `git cherry +` commits | **Forbidden** — tip twins exist; patch drift is base-context only |
| Leave dual tips indefinitely | **Accepted short-term** — tip is product SoT; DEV is archaeology |
| Fast-forward / reset `origin/DEV` → tip | **Parked** — requires explicit Architect `YES — DEV-POINTER` |

## 3. Owner next action (not auto)

When Architect wants a single tip:

```bash
# After YES — DEV-POINTER only
git push origin HEAD:DEV   # or open PR tip → DEV and merge
```

Until then: agents treat `booking/capacity-concurrency-cert` as canonical; never merge DEV “to catch up.”

## 4. Explicit non-claims

- This decision does **not** reclaim portal modal WIP (`wip/portal-psc-20260718`) — see C9.
- This decision does **not** authorize stash pops — see B7.

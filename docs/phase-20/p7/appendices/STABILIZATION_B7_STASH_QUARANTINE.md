# B7 — Stash quarantine ledger

```yaml
doc_id: STABILIZATION_B7_STASH_QUARANTINE
status: QUARANTINED
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
policy: never auto-pop; reclaim only with Architect-named ticket
```

**Companion:** [STABILIZATION_WP0_DEV_RECONCILE.md](./STABILIZATION_WP0_DEV_RECONCILE.md) §5–§6 · [STABILIZATION_B6_DEV_ASYMMETRY_DECISION.md](./STABILIZATION_B6_DEV_ASYMMETRY_DECISION.md)

## Locked policy

1. **Do not** `git stash pop` / `apply` / `drop` during Stabilization or Kernel design work without an Architect-named reclaim ticket (`YES — STASH-RECLAIM-{n}`).
2. Inventory below is **archaeology** — not merge fuel.
3. Prefer `git stash show -p stash@{n}` + selective file reclaim over full apply.
4. After any successful reclaim, update this ledger (status → `RECLAIMED` + PR/commit SHA).

## Inventory (2026-07-21)

| Ref | Base branch (message) | Scale | Risk | Recommendation |
| --- | --------------------- | ----- | ---- | -------------- |
| `stash@{0}` | `finance/phase-1-platform-boundaries` — HostIo+WS3+docs | 27 files / +335−110 | Medium | Finance reclaim ticket only; diff vs tip finance-core first |
| `stash@{1}` | `finance/phase-0-ownership-enforcement` — phase-1 isolation | 16 files / +130−75 | Medium | Likely superseded by tip ownership specs — verify before apply |
| `stash@{2}` | `wip/portal-psc-20260718` — before finance phase-0 | 9 files / +136−47 | Medium | Overlaps C9 portal WIP; do not mix with capacity tip |
| `stash@{3}` | `DEV` — local uncommitted | **509 files** / +8661−4872 | **Critical** | **Hard quarantine** — never pop; archaeological extract only |
| `stash@{4}` | `DEV` — WIP @ `dab1a510` | 3 files | Low | Historical CI/guard noise; lowest priority |
| `stash@{5}` | `feat/next-change` — hero-3d damavand | 12 files / large CSS+lock | Medium | Product/design branch work; separate marketing ticket |
| `stash@{6}` | `DEV` — clean-start 20260621 | 5 files | Low | design-tokens WIP; likely stale |
| `stash@{7}` | `feat/denali-draft-systemic-fixes` | **372 files** / large deletions | High | Draft-era; treat as dead unless ticket proves otherwise |
| `stash@{8}` | `feat/denali-draft-systemic-fixes` — p0 wizard wt | 82 files | High | Gate/script spike; quarantine |
| `stash@{9}` | `feat/denali-draft-systemic-fixes` — p0 isolate | 13 files | Medium | Denali manifest/theme; product ticket only |

## Explicit non-actions

- Do **not** drop stashes “to clean the list” — loss is irreversible without reflog luck.
- Do **not** apply `stash@{3}` onto tip “to see what happens.”
- B6 DEV pointer move does **not** authorize stash reclaim.

## Reclaim checklist (when ticket opens)

```text
1. Architect YES — STASH-RECLAIM-{n}
2. git stash show --stat stash@{n}
3. git stash show -p stash@{n} -- <paths>
4. Apply to a throwaway branch off tip; never onto main/DEV blind
5. Run targeted guards for touched packages only
6. Update this ledger + OPEN_WORK_LEDGER
```

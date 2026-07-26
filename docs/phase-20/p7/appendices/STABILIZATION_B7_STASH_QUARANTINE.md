# B7 — Stash quarantine ledger

```yaml
doc_id: STABILIZATION_B7_STASH_QUARANTINE
status: QUARANTINED — reclaim tickets 0–9 CLOSED (2026-07-21); stashes retained
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
| `stash@{0}` | `finance/phase-1-platform-boundaries` — HostIo+WS3+docs | 27 files / +335−110 | Medium | **RECLAIMED_SUPERSEDED** (2026-07-21) — tip already has HostIo/WS3; no apply — [STABILIZATION_B7_STASH_RECLAIM_0.md](./STABILIZATION_B7_STASH_RECLAIM_0.md) |
| `stash@{1}` | `finance/phase-0-ownership-enforcement` — phase-1 isolation | 16 files / +130−75 | Medium | **RECLAIMED_SUPERSEDED** (2026-07-21) — tip past registry isolation; no apply — [STABILIZATION_B7_STASH_RECLAIM_1.md](./STABILIZATION_B7_STASH_RECLAIM_1.md) |
| `stash@{2}` | `wip/portal-psc-20260718` — before finance phase-0 | 9 files / +136−47 | Medium | **RECLAIMED_SUPERSEDED** (2026-07-21) — finance payment-port WIP (not modal); tip has Option C; no apply — [STABILIZATION_B7_STASH_RECLAIM_2.md](./STABILIZATION_B7_STASH_RECLAIM_2.md) |
| `stash@{3}` | `DEV` — local uncommitted | **509 files** / +8661−4872 | **Critical** | **RECLAIMED_ARCHAEOLOGY_NO_LAND** (2026-07-21) — never pop; unique Damavand TSX parked unwired — [STABILIZATION_B7_STASH_RECLAIM_3.md](./STABILIZATION_B7_STASH_RECLAIM_3.md) |
| `stash@{4}` | `DEV` — WIP @ `dab1a510` | 3 files | Low | **RECLAIMED_SUPERSEDED** (2026-07-21) — tip already uses build-workspace-sdk-for-guards — [STABILIZATION_B7_STASH_RECLAIM_4.md](./STABILIZATION_B7_STASH_RECLAIM_4.md) |
| `stash@{5}` | `feat/next-change` — hero-3d damavand | 12 files / large CSS+lock | Medium | **RECLAIMED_ARCHAEOLOGY_NO_LAND** (2026-07-21) — tip uses hero-static; stash CSS monolith incompatible — [STABILIZATION_B7_STASH_RECLAIM_5.md](./STABILIZATION_B7_STASH_RECLAIM_5.md) |
| `stash@{6}` | `DEV` — clean-start 20260621 | 5 files | Low | **RECLAIMED_SUPERSEDED** (2026-07-21) — guest-shell already on tip — [STABILIZATION_B7_STASH_RECLAIM_6.md](./STABILIZATION_B7_STASH_RECLAIM_6.md) |
| `stash@{7}` | `feat/denali-draft-systemic-fixes` | **372 files** / large deletions | High | **RECLAIMED_ARCHAEOLOGY_NO_LAND** (2026-07-21) — tip modular codegen supersedes; never apply — [STABILIZATION_B7_STASH_RECLAIM_7.md](./STABILIZATION_B7_STASH_RECLAIM_7.md) |
| `stash@{8}` | `feat/denali-draft-systemic-fixes` — p0 wizard wt | 82 files | High | **RECLAIMED_SUPERSEDED** (2026-07-21) — P4 club-product already on tip — [STABILIZATION_B7_STASH_RECLAIM_8.md](./STABILIZATION_B7_STASH_RECLAIM_8.md) |
| `stash@{9}` | `feat/denali-draft-systemic-fixes` — p0 isolate | 13 files | Medium | **RECLAIMED_SUPERSEDED** (2026-07-21) — tip Denali wizard/host exports ahead — [STABILIZATION_B7_STASH_RECLAIM_9.md](./STABILIZATION_B7_STASH_RECLAIM_9.md) |

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

## Reclaim log

| Ticket | Result | Evidence |
| ------ | ------ | -------- |
| `YES — STASH-RECLAIM-0` | **SUPERSEDED** — no apply / no drop | [STABILIZATION_B7_STASH_RECLAIM_0.md](./STABILIZATION_B7_STASH_RECLAIM_0.md) |
| `YES — STASH-RECLAIM-1` | **SUPERSEDED** — no apply / no drop | [STABILIZATION_B7_STASH_RECLAIM_1.md](./STABILIZATION_B7_STASH_RECLAIM_1.md) |
| `YES — STASH-RECLAIM-2` | **SUPERSEDED** — no apply / no drop | [STABILIZATION_B7_STASH_RECLAIM_2.md](./STABILIZATION_B7_STASH_RECLAIM_2.md) |
| `YES — STASH-RECLAIM-3` | **NO_LAND** — archaeology only; stash retained | [STABILIZATION_B7_STASH_RECLAIM_3.md](./STABILIZATION_B7_STASH_RECLAIM_3.md) |
| `YES — STASH-RECLAIM-4` | **SUPERSEDED** — no apply / no drop | [STABILIZATION_B7_STASH_RECLAIM_4.md](./STABILIZATION_B7_STASH_RECLAIM_4.md) |
| `YES — STASH-RECLAIM-5` | **NO_LAND** — archaeology; stash retained | [STABILIZATION_B7_STASH_RECLAIM_5.md](./STABILIZATION_B7_STASH_RECLAIM_5.md) |
| `YES — STASH-RECLAIM-6` | **SUPERSEDED** — no apply / no drop | [STABILIZATION_B7_STASH_RECLAIM_6.md](./STABILIZATION_B7_STASH_RECLAIM_6.md) |
| `YES — STASH-RECLAIM-7` | **NO_LAND** — draft-era; stash retained | [STABILIZATION_B7_STASH_RECLAIM_7.md](./STABILIZATION_B7_STASH_RECLAIM_7.md) |
| `YES — STASH-RECLAIM-8` | **SUPERSEDED** — no apply / no drop | [STABILIZATION_B7_STASH_RECLAIM_8.md](./STABILIZATION_B7_STASH_RECLAIM_8.md) |
| `YES — STASH-RECLAIM-9` | **SUPERSEDED** — series complete; stash retained | [STABILIZATION_B7_STASH_RECLAIM_9.md](./STABILIZATION_B7_STASH_RECLAIM_9.md) |

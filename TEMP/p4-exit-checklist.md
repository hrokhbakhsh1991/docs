# P4 — Exit checklist

```yaml
phase: P4
version: 1.0-aligned
status: complete
current_task: P4-complete
nano_total: 48
nano_done: 48
agent_entry: TEMP/p4/AGENT-START.md
file_map: TEMP/p4/FILE-MAP.md
prerequisite: TEMP/p2-exit-checklist.md ✅ · TEMP/p3-exit-checklist.md ✅
verified: 2026-06-21
```

## Product gates (§J closure)

- [x] Tour publish → marketing catalog (P4-A + P4-D) — RV/CP/PW-01 in `p4:gate` · E2E-01 Playwright optional (`p4:e2e-gate`)
- [x] Portal registration (P4-B) — PR/BR/M17 unit specs in `p4:gate`
- [x] Club surfaces Super Admin (P4-C) — SF specs + Sites tab badges
- [x] `pnpm run p4:gate` unit chain — API + marketing + portal + web specs green
- [x] `pnpm run p4:gate` — **P4_CLUB_PRODUCT_GATE_OK** (2026-06-21)

## Phase exit

- [x] P4-A + P4-B + P4-C + P4-D v1
- [x] EX-01…EX-03 (`platform-club-product-exit.spec.ts`)
- [x] ROADMAP P4 marked complete
- [x] TEMP agent pack synced (2026-06-21)

## Progress (2026-06-21)

- [x] Doc pack phase-17 (5 mdoc @ 9.9)
- [x] P4-A complete (12/12)
- [x] P4-B complete (14/14)
- [x] P4-C complete (12/12)
- [x] P4-D complete (10/10) — gate script + EX spec
- [x] denali covenant PASS — minimal exports staged (`./clone` + `./finance/api-tour-created-adapter`)

## Denali merge strategy (2026-06-21)

**Gate fix:** stage only API-required export additions on HEAD `package.json`:

- `./finance/api-tour-created-adapter` (new source file staged)
- `./clone` (index export for generated API bindings)

Wizard/UI WIP remains unstashed separately — not required for `p4:gate`.
**P4 PR:** commit staged denali export slice + P4 apps changes; wizard WIP in follow-up PR.

## Execution closure (in progress)

- [ ] Commit 1 — denali export slice
- [ ] Commit 2 — P4 product + docs/phase-17
- [ ] PR merged

## Operational (post-merge)

- [ ] `p4:e2e-gate` green (Architect YES)
- [ ] Prod `MARKETING_REVALIDATE_*` set per club env

## PR pack

- [x] `TEMP/p4-PR-PACK.md` + `scripts/stage-p4-club-product.sh` (2026-06-21)

## Gate commands

```bash
pnpm run guard:import-boundary
pnpm run guard:public-catalog-m17
pnpm run p4:gate
pnpm run p4:e2e-gate   # Architect YES only
git diff --quiet packages/workspaces/denali   # must PASS before P4 PR
```

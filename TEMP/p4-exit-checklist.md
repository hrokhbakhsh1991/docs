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
execution_closed: 2026-06-21
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
- [x] denali export slice committed (`22b47566`)

## Denali merge strategy (2026-06-21)

**Gate fix:** stage only API-required export additions on HEAD `package.json`:

- `./finance/api-tour-created-adapter` (new source file staged)
- `./clone` (index export for generated API bindings)

Wizard/UI WIP remains unstashed separately — not required for `p4:gate`.
**P4 PR:** commit staged denali export slice + P4 apps changes; wizard WIP in follow-up PR.

## Execution closure

- [x] Commit 1 — denali export slice (`22b47566`)
- [x] Commit 2 — P4 product + docs/phase-17 (`e17f36e9`)
- [ ] PR merged to main (branch push pending)
- [x] Commit 3 — P4 closure holes (`36d37663`)

## Known v1.1 deferrals (not P4 holes)

- PATCH toggle for `site_surfaces` in Super Admin
- Portal maintenance when `portal: false`
- Live Playwright publish→catalog (G2 browser path) — use `p4:e2e-gate`

## Operational (post-merge)

- [ ] `p4:e2e-gate` green (Architect YES)
- [ ] Prod `MARKETING_REVALIDATE_*` set per club env

### Prod deploy checklist (G4)

```bash
# API host (per environment)
MARKETING_REVALIDATE_URL=https://shop.{club-domain}
MARKETING_REVALIDATE_SECRET=<shared-secret>

# Marketing app (same secret)
MARKETING_REVALIDATE_SECRET=<shared-secret>
```

Unset → publish persists but catalog stays stale until manual revalidate.

## PR pack

- [x] `TEMP/p4-PR-PACK.md` + `scripts/stage-p4-club-product.sh` (2026-06-21)

## Gate commands

```bash
pnpm run guard:import-boundary
pnpm run guard:public-catalog-m17
pnpm run p4:gate
pnpm run p4:e2e-gate   # Architect YES only
pnpm run guard:p3-denali-covenant   # scoped overlay gate
```

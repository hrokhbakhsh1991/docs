# Roadmap truth sync (2026-07-21)

```yaml
doc_id: ROADMAP_TRUTH_SYNC
tip: fd54e6ca
source_temp: TEMP/SAAS_PLATFORM_ROADMAP_CONTEXT.md (gitignored; local handoff)
```

`TEMP/SAAS_PLATFORM_ROADMAP_CONTEXT.md` §2.2 is re-synced with tip `fd54e6ca` (B6–C10 closed; stress PASS; DEV decision locked).

Tracked ledger: [OPEN_WORK_LEDGER.md](./OPEN_WORK_LEDGER.md) · Unlock: [ARCHITECT_UNLOCK_MENU.md](./ARCHITECT_UNLOCK_MENU.md)

## Evidence closed

| ID | Result |
| -- | ------ |
| B4 | `@app-cloud/tenant-kernel` / `finance-core` build PASS; `@apps/api` `tsc --noEmit` PASS |
| B5 | `test:booking-capacity-stress` — **3/3 PASS** |
| B6 | DEV asymmetry **DECIDED** — no merge |
| B7 | 10 stashes **QUARANTINED** |
| C8 | Prodlike fail-closed when tour SoT lacks `capacityMax` |
| C9/C10 | **PARKED** with tickets |
| A4 | Stale residual tables + unlock menu filed |

## Waiting on Architect (paste unlock)

| Unlock | Effect |
| ------ | ------ |
| `YES — IMPL-SK*` | Kernel demand-driven impl |
| `YES — DEV-POINTER` | Point `origin/DEV` at tip |
| `YES — STASH-RECLAIM-{n}` | Selective stash reclaim |
| `YES — IMPL-PORTAL-MODAL` | Portal modal from WIP |
| `YES — FULL-MONOREPO-BUILD` | Optional full build honesty check |

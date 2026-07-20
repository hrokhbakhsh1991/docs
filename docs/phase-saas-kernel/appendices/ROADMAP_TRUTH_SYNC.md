# Roadmap truth sync (2026-07-21)

```yaml
doc_id: ROADMAP_TRUTH_SYNC
tip: see git HEAD
source_temp: TEMP/SAAS_PLATFORM_ROADMAP_CONTEXT.md (gitignored; local handoff)
```

`TEMP/SAAS_PLATFORM_ROADMAP_CONTEXT.md` §2.2 was **stale** (claimed tip `f607c376` and dirty WT). Local TEMP was corrected.

Tracked ledger of remaining work: [OPEN_WORK_LEDGER.md](./OPEN_WORK_LEDGER.md).

## Evidence closed this sync

| ID | Result |
| -- | ------ |
| B4 | `@app-cloud/tenant-kernel` build PASS; `@app-cloud/finance-core` build PASS; `@apps/api` `tsc --noEmit` PASS (unused import removed in `require-operator-session.ts`) |
| B5 | `pnpm --filter @apps/api run test:booking-capacity-stress` — **3/3 PASS** |
| B6 | DEV asymmetry **DECIDED** — no merge; tip canonical ([STABILIZATION_B6…](../../phase-20/p7/appendices/STABILIZATION_B6_DEV_ASYMMETRY_DECISION.md)) |
| B7 | 10 stashes **QUARANTINED** ([STABILIZATION_B7…](../../phase-20/p7/appendices/STABILIZATION_B7_STASH_QUARANTINE.md)) |
| C8 | Prodlike fail-closed when tour SoT lacks `capacityMax` |
| C9/C10 | **PARKED** ([STABILIZATION_C9_C10…](../../phase-20/p7/appendices/STABILIZATION_C9_C10_PARKED.md)) |

## Still open / blocked

| ID | Status |
| -- | ------ |
| DEV pointer → tip | Needs Architect `YES — DEV-POINTER` |
| Stash reclaim | Needs `YES — STASH-RECLAIM-{n}` |
| C9 portal modal product reclaim | Parked on `wip/portal-psc-20260718` |
| D-* Kernel IMPL | BLOCKED — `YES — IMPL-SK*` |
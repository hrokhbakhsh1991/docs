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

## Still open

B6 DEV asymmetry decision · B7 stashes · C8–C10 residuals · D-* Kernel IMPL unlocks

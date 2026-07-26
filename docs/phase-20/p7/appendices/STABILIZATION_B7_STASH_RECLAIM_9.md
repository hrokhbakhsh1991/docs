# B7 — Stash reclaim `9` (archaeological — series close)

```yaml
doc_id: STABILIZATION_B7_STASH_RECLAIM_9
status: RECLAIMED_SUPERSEDED
unlock: YES — STASH-RECLAIM-9
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_at_reclaim: e4e58665
stash_ref: stash@{9}
stash_sha: e14ed415f09610335f3fa1f6dc3d73bac3460c6e
stash_message: "p0-denali-wip-isolate-for-p2-exit"
base_branch_when_stashed: feat/denali-draft-systemic-fixes
scale: 13 files / +875 −11
series: B7 stash@{0}–@{9} reclaim train COMPLETE
```

## Policy followed

1. Architect `YES — STASH-RECLAIM-9` (Persian numeral ۹ accepted as `9`)
2. Full file list + tip existence checks
3. **No apply / pop / drop**
4. Marks end of named B7 reclaim tickets `0`–`9`

## Intent of stash@{9}

P0 Denali wizard isolate for P2 exit:

| Area | Stash intent |
| ---- | ------------ |
| Wizard | `denali-wizard-catalog-sanitize`, validation/submit/host-hooks, initial step |
| Theme | `wizard-calendar.css`, `wizard-review.css` |
| Package exports | Broad `./wizard/*`, `./ui/*`, `./draft/tour-wizard` export map spike |
| Manifest | Denali `workspace.manifest.json` expansion |

## Tip verdict

| Path | Tip |
| ---- | --- |
| `denali-wizard-catalog-sanitize.ts` | **Exists** (richer API than stash era) |
| `wizard-calendar.css` / `wizard-review.css` | **Exist** |
| `src/draft/index.ts` / `src/photos/index.ts` | **Exist** |
| Package exports | Tip uses `./host/wizard/catalog-sanitize`, `./host/draft/tour-wizard`, … — evolved naming |
| Manifest | Tip ~568 lines vs stash ~178 — tip SoT ahead |

**Conclusion:** superseded Denali isolate WIP. Zero file land. Stash retained.

## B7 series rollup (2026-07-21)

| Ref | Result |
| --- | ------ |
| `0`–`2`, `4`, `6`, `8`, `9` | **SUPERSEDED** |
| `3`, `5`, `7` | **NO_LAND** archaeology (dangerous / product-parked) |

No stash was popped or dropped. Quarantine inventory remains for reflog archaeology.

## Companion

- Quarantine: [STABILIZATION_B7_STASH_QUARANTINE.md](./STABILIZATION_B7_STASH_QUARANTINE.md)
- Prior: [STABILIZATION_B7_STASH_RECLAIM_8.md](./STABILIZATION_B7_STASH_RECLAIM_8.md)

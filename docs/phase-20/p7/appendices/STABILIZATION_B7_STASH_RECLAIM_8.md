# B7 — Stash reclaim `8` (archaeological)

```yaml
doc_id: STABILIZATION_B7_STASH_RECLAIM_8
status: RECLAIMED_SUPERSEDED
unlock: YES — STASH-RECLAIM-8
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_at_reclaim: e4e58665
stash_ref: stash@{8}
stash_sha: dfdca475ea5795cc77d91673beea64cdc0e4c16c
stash_message: "p0-denali-wizard-wt-for-p4-staging"
base_branch_when_stashed: feat/denali-draft-systemic-fixes
scale: 82 files / +6860 −84
```

## Policy followed

1. Architect `YES — STASH-RECLAIM-8` (Persian numeral ۸ accepted as `8`)
2. Inspected `A/M/D`, path clusters, key adds vs tip
3. **No apply / pop / drop**
4. Wizard/manifest deltas not overlaid — tip SoT diverged

## Intent of stash@{8}

P0 Denali wizard + **Phase 4 club-product / tenant site surfaces** staging pack:

| Cluster | Examples |
| ------- | -------- |
| Platform API | `read-tenant-site-surfaces`, `check-tenant-sites-health`, tenant detail DTO/repo |
| Marketing | `resolve-marketing-site-surfaces`, catalog revalidate schedule |
| Gates | `scripts/p4-club-product-gate.sh`, `p4-club-product-e2e-gate.sh` |
| Specs | `platform-club-product-exit`, catalog publish tests |
| TEMP | `TEMP/p4/*` agent packs (historical) |
| Denali wizard | validation / submit / calendar CSS / manifest spikes |

## Tip verdict

All sampled product paths **already exist on tip**:

- `apps/api/src/platform/read-tenant-site-surfaces.ts`
- `apps/api/src/platform/check-tenant-sites-health.ts`
- `apps/api/src/marketing/maybe-schedule-marketing-catalog-revalidate.ts`
- `apps/marketing/src/tenant/resolve-marketing-site-surfaces.ts`
- `scripts/p4-club-product-gate.sh` / `p4-club-product-e2e-gate.sh`
- `apps/api/test/platform-club-product-exit.spec.ts`

Phase 4 production docs live under `docs/phase-4/` (not TEMP agent packs).

Denali `workspace.manifest.json` / wizard validation: tip differs substantially — applying stash would **regress** current manifest/wizard SoT.

**Conclusion:** superseded P4 staging spike. Zero file land. Stash retained.

## Companion

- Quarantine: [STABILIZATION_B7_STASH_QUARANTINE.md](./STABILIZATION_B7_STASH_QUARANTINE.md)
- Sibling draft: [STABILIZATION_B7_STASH_RECLAIM_7.md](./STABILIZATION_B7_STASH_RECLAIM_7.md)

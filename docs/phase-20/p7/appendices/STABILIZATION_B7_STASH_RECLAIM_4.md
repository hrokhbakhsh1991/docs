# B7 — Stash reclaim `4` (archaeological)

```yaml
doc_id: STABILIZATION_B7_STASH_RECLAIM_4
status: RECLAIMED_SUPERSEDED
unlock: YES — STASH-RECLAIM-4
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_at_reclaim: e4e58665
stash_ref: stash@{4}
stash_sha: 8138389eaf69bc894d1e873123de860409d4d63a
stash_message: "WIP on DEV: dab1a510 fix(ci): build workspace-sdk before guest_seo…"
base_branch_when_stashed: DEV
scale: 3 files / +16 −12
```

## Policy followed

1. Architect `YES — STASH-RECLAIM-4` (Persian numeral ۴ accepted as `4`)
2. Full patch reviewed (`git diff stash@{4}^1 stash@{4}`)
3. Compared to tip `e4e58665`
4. **No apply / pop / drop**

## Intent of stash@{4}

Low-risk CI/guard hygiene:

| File | Stash intent |
| ---- | ------------ |
| `.github/workflows/phase-10-guard.yml` | Use `bash scripts/ci/build-workspace-sdk-for-guards.sh` instead of bare `pnpm --filter … workspace-sdk build` |
| `scripts/guards/guard-guest-plugin-conformance.mjs` | Build `catalog-registration-auth` then `workspace-sdk` when dist missing |
| `scripts/phase-g-h-fast-track.sh` | Same shared build script |

## Tip verdict

| Check | Tip evidence |
| ----- | ------------ |
| `scripts/ci/build-workspace-sdk-for-guards.sh` | Present |
| `phase-10-guard.yml` | Already runs `build-workspace-sdk-for-guards.sh` |
| `guard-guest-plugin-conformance.mjs` | Already builds catalog-registration-auth + workspace-sdk |
| `phase-g-h-fast-track.sh` | **SAME** as stash WIP for this line |

**Conclusion:** superseded CI noise. Zero file land. Stash retained.

## Companion

- Quarantine: [STABILIZATION_B7_STASH_QUARANTINE.md](./STABILIZATION_B7_STASH_QUARANTINE.md)

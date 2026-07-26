# B7 — Stash reclaim `7` (hard archaeology — draft-era)

```yaml
doc_id: STABILIZATION_B7_STASH_RECLAIM_7
status: RECLAIMED_ARCHAEOLOGY_NO_LAND
unlock: YES — STASH-RECLAIM-7
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_at_reclaim: e4e58665
stash_ref: stash@{7}
stash_sha: b9c4496632834c91d9636ec96e6a586925583021
stash_message: "wip-before-dev-checkout-20260621"
base_branch_when_stashed: feat/denali-draft-systemic-fixes
scale: 372 files / +6051 −26495
```

## Policy followed

1. Architect `YES — STASH-RECLAIM-7` (Persian numeral ۷ accepted as `7`)
2. Scale + `A/M/D` + path clusters + freshness samples
3. **No apply / pop / drop** — 144 deletes + 26k-line deletion volume would smash tip
4. **No selective land** — tip registry architecture diverged (modular codegen)

## Inventory snapshot

| Class | Count |
| ----- | ----- |
| Added (`A`) | **0** |
| Modified (`M`) | 228 |
| Deleted (`D`) | 144 (mostly `TEMP/*` roadmaps + large `apps/web` surface) |

### Path clusters

| Prefix | Files |
| ------ | ----- |
| `apps/web` | 205 |
| `apps/api` | 83 |
| packages / portal / marketing / TEMP | remainder |

### Notable stash intent (registry)

Stash **inflated** monolithic `scripts/generate-workspace-registry.mjs` by ~+1153 lines and added drop-in specs.

Tip SoT is the **opposite**: thin `generate-workspace-registry.mjs` (~211 lines) + modular `scripts/codegen/workspace-registry/**`. Applying stash registry hunks would **regress** modular codegen.

### Freshness samples

| File | Tip ahead (approx) | Stash ahead (approx) |
| ---- | ------------------ | -------------------- |
| `apps/api/src/app.ts` | ~246 | ~29 |
| `scripts/generate-workspace-registry.mjs` | modular tip | stash monolith delta |
| `packages/workspace-sdk/src/public-api.ts` | ~251 | ~0 |

## Verdict

Draft-era systemic WIP — **dead relative to tip**. Archaeology complete; **no code land**. Stash retained at `b9c44966`.

Related high-risk siblings: `stash@{8}` / `stash@{9}` (same draft branch family) — reclaim only with named YES.

## Companion

- Quarantine: [STABILIZATION_B7_STASH_QUARANTINE.md](./STABILIZATION_B7_STASH_QUARANTINE.md)

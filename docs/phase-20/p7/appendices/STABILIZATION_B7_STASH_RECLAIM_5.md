# B7 — Stash reclaim `5` (archaeological — marketing hero-3d)

```yaml
doc_id: STABILIZATION_B7_STASH_RECLAIM_5
status: RECLAIMED_ARCHAEOLOGY_NO_LAND
unlock: YES — STASH-RECLAIM-5
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_at_reclaim: e4e58665
stash_ref: stash@{5}
stash_sha: 32ec4a9b063c86ff4ca032bf141bdf0b2ab12d3e
stash_message: "wip: hero-3d damavand on feat/next-change 20260705"
base_branch_when_stashed: feat/next-change
scale: 12 files / +1879 −185
```

## Policy followed

1. Architect `YES — STASH-RECLAIM-5` (Persian numeral ۵ accepted as `5`)
2. Inspected full file list + key patches vs tip
3. **No apply / pop / drop**
4. **No selective land** — tip marketing SoT is `hero-static`; stash CSS tree is incompatible with tip’s split partials

## Intent of stash@{5}

Optional Damavand **WebGL hero** behind `MARKETING_HERO_3D=true`:

| Path | Role |
| ---- | ---- |
| `apps/marketing/src/home/hero-3d/*` | Canvas / stage / spotlights |
| `home-hero.tsx` | Bridge: 3D when enabled, else static parallax |
| `guest-home-full.tsx` | Pass `enable3D` from env |
| `package.json` | GLB/STL conversion scripts + vtk/geotiff/sharp devDeps |
| `denali-marketing.css` | Large style delta (stash tree is **monolithic-era**) |
| `marketing-landing-visual.mdoc` | Visual design notes |
| `pnpm-lock.yaml` | Lock churn |

## Tip verdict

| Check | Tip evidence |
| ----- | ------------ |
| Hero SoT | `hero-static/` carousel + parallax — **no** `hero-3d/` directory |
| three.js deps | Present in `apps/marketing/package.json` but **unwired** (leftover) |
| CSS architecture | `denali-marketing.css` = **43-line** `@import` barrel of ≤500-line partials (incl. damavand-ascent **p1/p2** CSS) |
| Stash CSS tree | ~9.5k-line `denali-marketing.css` — applying would **regress** split-skin architecture |
| Related | `stash@{3}` Damavand ascent TSX (different, also unwired) — do not conflate |

**Conclusion:** product/design WIP superseded by tip’s static hero path. Reclaim = archaeology catalog only. Future land requires an explicit marketing hero-3d ticket that:

1. Adds `hero-3d/` as opt-in (`MARKETING_HERO_3D`) without removing `hero-static`
2. Adds **new CSS partials** under `theme/marketing/components/` — never replace the import barrel with a monolith
3. Avoids blind `pnpm-lock.yaml` from this stash (regenerate)

## Explicit non-actions

- Did **not** switch tip home to 3D
- Did **not** apply stash CSS / lockfile
- Did **not** drop stash

## Companion

- Quarantine: [STABILIZATION_B7_STASH_QUARANTINE.md](./STABILIZATION_B7_STASH_QUARANTINE.md)
- Related: [STABILIZATION_B7_STASH_RECLAIM_3.md](./STABILIZATION_B7_STASH_RECLAIM_3.md) (ascent TSX)

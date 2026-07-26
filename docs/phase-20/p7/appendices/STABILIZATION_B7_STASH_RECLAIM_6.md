# B7 — Stash reclaim `6` (archaeological)

```yaml
doc_id: STABILIZATION_B7_STASH_RECLAIM_6
status: RECLAIMED_SUPERSEDED
unlock: YES — STASH-RECLAIM-6
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_at_reclaim: e4e58665
stash_ref: stash@{6}
stash_sha: c57725e806a0bb2221455fc0f2ad99229ff01539
stash_message: "local-wip-before-dev-clean-start-20260621"
base_branch_when_stashed: DEV
scale: 5 files / +106 −121
```

## Policy followed

1. Architect `YES — STASH-RECLAIM-6` (Persian numeral ۶ accepted as `6`)
2. Full patch reviewed
3. Compared to tip `e4e58665`
4. **No apply / pop / drop**

## Intent of stash@{6}

Early design-tokens guest-shell wiring (2026-06-21):

| File | Stash intent |
| ---- | ------------ |
| `packages/design-tokens` | Export + copy `guest-shell.css` |
| `apps/marketing|portal/app/globals.css` | `@import` guest-shell; tokenized spacing/colors |
| Portal registration flow | Extract shared `public-registration-logic` helpers (still monolithic page-local flow) |

## Tip verdict

| Check | Tip evidence |
| ----- | ------------ |
| `guest-shell.css` | Present under `src/` + `dist/` + package export + `build.mjs` copy |
| Portal flow | Lives at `apps/portal/src/catalog/public-catalog-registration-flow.tsx` — plugin/stepper SoT (far past stash) |
| Guest globals | Tip skins/tokens evolved via Denali theme partials + guest-shell — do not overlay June WIP CSS |

**Conclusion:** superseded design-tokens WIP. Zero file land. Stash retained.

## Companion

- Quarantine: [STABILIZATION_B7_STASH_QUARANTINE.md](./STABILIZATION_B7_STASH_QUARANTINE.md)

# B7 — Stash reclaim `3` (hard quarantine — archaeological only)

```yaml
doc_id: STABILIZATION_B7_STASH_RECLAIM_3
status: RECLAIMED_ARCHAEOLOGY_NO_LAND
unlock: YES — STASH-RECLAIM-3
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
tip_at_reclaim: e4e58665
stash_ref: stash@{3}
stash_sha: 017e7124d0c1524b0528cd31547120557abf7340
stash_message: "wip-local-uncommitted"
base_branch_when_stashed: DEV
scale: 509 files / +8661 −4872
```

## Policy followed

1. Architect `YES — STASH-RECLAIM-3` (Persian numeral ۳ accepted as `3`)
2. **Hard quarantine** from [STABILIZATION_B7_STASH_QUARANTINE.md](./STABILIZATION_B7_STASH_QUARANTINE.md) — never pop / full apply
3. Inspected scale, `A/M/D` mix, path clusters, unique adds vs tip
4. **No `git stash apply` / `pop` / `drop`**
5. **No selective land** of orphan marketing TSX (would be dead code without hero switch ticket)

## Inventory snapshot

| Class | Count | Notes |
| ----- | ----- | ----- |
| Modified (`M`) | 487 | Dominated by `apps/api` (181) + `apps/web` (140) — tip is **newer** on sampled platform files |
| Deleted (`D`) | 15 | Do not resurrect blindly |
| Added (`A`) | **7** | Only unique net-new paths vs stash base |

### Path clusters (stash name-only)

| Prefix | Files |
| ------ | ----- |
| `apps/api` | 181 |
| `apps/web` | 140 |
| `packages/workspaces` | 76 |
| `apps/marketing` | 27 |
| `apps/portal` | 7 |
| other | remainder |

### Unique adds (`A`) — marketing Damavand ascent

| Path | On tip? |
| ---- | ------- |
| `apps/marketing/instrumentation.ts` | Tip has its own instrumentation patterns — not extracted |
| `apps/marketing/src/bootstrap/workspace-guest-manifest-themes.generated.ts` | Tip has codegen equivalents |
| `apps/marketing/src/home/home-damavand-ascent-mountain.tsx` | **No** TSX on tip |
| `apps/marketing/src/home/home-damavand-ascent-stage.tsx` | **No** TSX on tip |
| `apps/marketing/src/home/home-damavand-ascent-waypoint-ids.ts` | **No** on tip |
| `packages/workspaces/denali/theme/marketing/components/30-pr-damavand-ascent-p1.css` | **Yes** (imported from `denali-marketing.css`) |
| `…/30-pr-damavand-ascent-p2.css` | **Yes** |

Tip home still uses `home-hero.tsx` / `hero-static` — Damavand ascent **CSS is present**, TSX from this stash is **unwired**. Landing those TSX without a marketing hero-switch ticket = dead code.

Related archaeology: `stash@{5}` holds a **different** hero-3d mountain canvas set — do not conflate; reclaim only with `YES — STASH-RECLAIM-5` + product owner.

### Portal files in this stash

Seven portal paths (register flow, layout, providers, package.json, …). Tip + C9 modal reclaim (`YES — IMPL-PORTAL-MODAL`) are ahead / different SoT — **do not** overlay from `stash@{3}`.

### Freshness sample (tip vs stash WIP)

| File | Tip ahead (approx) | Stash ahead (approx) |
| ---- | ------------------ | -------------------- |
| `apps/api/src/app.ts` | ~36 | ~2 |
| `apps/portal/src/shell/portal-providers.tsx` | tip has C9 modal provider | stash older PSC-era delta |

## Verdict

| Action | Result |
| ------ | ------ |
| Full apply / pop | **Forbidden** — would smash tip with 509-file DEV WIP |
| Selective platform extract | **None justified** — tip supersedes |
| Selective Damavand TSX extract | **Parked** — needs marketing product ticket (wire hero) or `STASH-RECLAIM-5` coordination |
| Drop stash | **Forbidden** — irreversible |

**Status:** archaeology complete; **no code land**. Stash retained at `017e7124`.

## Companion

- Quarantine ledger: [STABILIZATION_B7_STASH_QUARANTINE.md](./STABILIZATION_B7_STASH_QUARANTINE.md)
- C9 modal (separate): [STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md](./STABILIZATION_C9_PORTAL_MODAL_RECLAIM.md)

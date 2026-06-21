# P4 — PR pack (Club Product Surfaces)

```yaml
phase: P4
status: ready-for-review
gate: pnpm run p4:gate
verified: 2026-06-21
```

## Stage

```bash
bash scripts/stage-p4-club-product.sh
pnpm run p4:gate
```

## Recommended commits (split)

### Commit 1 — denali export surface

- `packages/workspaces/denali/package.json` — `./finance/api-tour-created-adapter`, `./clone`
- `packages/workspaces/denali/src/finance/api-tour-created-adapter.ts`

### Commit 2 — P4 product

- apps/api marketing revalidate + platform surfaces
- apps/marketing revalidate route + maintenance
- apps/portal BFF registration specs
- apps/web club-detail Sites tab
- docs/phase-17 + scripts/p4-\* + TEMP/p4

## Verify

```bash
pnpm run p4:gate
git diff --quiet packages/workspaces/denali
```

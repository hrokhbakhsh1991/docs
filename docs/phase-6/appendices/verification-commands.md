# Phase 6 — Verification commands

```yaml
binding: REPO_SCRIPTS_OVER_STALE_MD
atlas: req-p6-command-atlas.md
```

## 6.0

```bash
pnpm run phase-5:gate
# update reports/phase-6-entry-verified.yaml — phase_5_gate.status: PASS
```

## 6.1

```bash
pnpm --filter @app-tour/workspace-denali build
pnpm --filter @app-tour/workspace-denali test test/phase-6.contract.spec.ts
```

## 6.2

```bash
pnpm --filter @app-tour/workspace-denali run denali:codegen
git diff --exit-code packages/workspaces/denali/src/rules/generated
pnpm --filter @app-tour/workspace-denali test test/registry-parity.spec.ts
```

## 6.3 — REQ-P6-010 (theme + composites)

```bash
pnpm --filter @app-tour/workspace-denali test test/composites.contract.spec.ts
# Theme ingress: packages/workspaces/denali/theme/tokens.css imported via plugin export
test -f packages/workspaces/denali/theme/tokens.css
pnpm run phase-2:gate  # Phase 2 theme contract still green for workspace ingress pattern
```

## 6.4

```bash
pnpm --filter @app-tour/workspace-denali test test/finance-outbox-consumer.spec.ts
```

## 6.5 — REQ-P6-013,014,026

```bash
pnpm --filter @apps/api exec node --import tsx --test test/denali-workspace-plugin.spec.ts
pnpm --filter @app-tour/workspace-sdk test test/denali-workspace-binding.contract.spec.ts
# REQ-P6-014 web lazy load — chunk contains workspace-denali when workspace_type=denali:
pnpm --filter @apps/web build
rg '@app-tour/workspace-denali' apps/web/.next/static/chunks || rg 'workspace-denali' apps/web/dist
```

## 6.6

```bash
export SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://denali.localhost:3000}"
pnpm --filter @apps/web exec playwright test tests/smoke/denali-wizard.spec.ts
```

## 6.7

```bash
export MINIO_ENDPOINT MINIO_ACCESS_KEY MINIO_SECRET_KEY MINIO_BUCKET
pnpm --filter @apps/api exec node --import tsx --test test/minio-photo.spec.ts
```

## 6.8

```bash
pnpm --filter @apps/api exec node --import tsx --test test/migrate-canonical-denali.spec.ts
```

## 6.9

```bash
pnpm run phase-6:gate
node scripts/guards/lib/anti-hollow-phase6.mjs
```

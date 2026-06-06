# Phase 6 — Smoke scenario map (6.6)

> **REQ:** REQ-P6-015 · **Legacy reference paths**

| ID        | Legacy spec / script                                                                | Trunk target                               | Pass signal                    |
| --------- | ----------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------ |
| SMK-P6-01 | `legacy/apps/web/src/features/tours/__tests__/smoke/10-denali-wizard-shell.spec.ts` | `apps/web` or Playwright trunk suite       | wizard shell loads             |
| SMK-P6-02 | `legacy/apps/web/tests/e2e/denali-ux-integrity.spec.ts`                             | trunk e2e (adapt selectors)                | no console errors              |
| SMK-P6-03 | `legacy/apps/api/src/scripts/provision-denali-tenant.ts` flow                       | trunk provision script or test tenant seed | denali workspace_type          |
| SMK-P6-04 | `/tours/new` on denali tenant host                                                  | HTTP 200 + plugin chunk loaded             | REQ-P6-014                     |
| SMK-P6-05 | Golden `tour-minimal.json` validate                                                 | registry-parity + API POST                 | 201 + canonical persisted      |
| SMK-P6-06 | Golden `tour-publish-ready.json`                                                    | validateCanonical pass                     | no CANONICAL_VALIDATION_FAILED |

## Host / env

```bash
# legacy reference: legacy/AGENTS.md denali.localhost
export SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://denali.localhost:3000}"
pnpm --filter @apps/web exec playwright test tests/smoke/denali-wizard.spec.ts
```

## Golden fixtures (create in 6.2/6.6)

| File                                                                         | Source                          |
| ---------------------------------------------------------------------------- | ------------------------------- |
| `packages/workspaces/denali/test/fixtures/golden/tour-minimal.json`          | legacy audit minimal tour       |
| `packages/workspaces/denali/test/fixtures/golden/tour-template-overlay.json` | template overlay case           |
| `packages/workspaces/denali/test/fixtures/golden/tour-publish-ready.json`    | publishReadinessRules pass case |

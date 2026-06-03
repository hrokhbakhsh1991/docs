# P3-E-PRIM-BARREL — enforcement plan (`@apps/web`)

## Objective

Zero barrel imports of `@app-tour/ui-primitives` in application code. Consumers must use **subpath** entrypoints only.

## Layers (defense in depth)

| Layer | Mechanism | When it runs |
|-------|-----------|----------------|
| L1 | `no-restricted-imports` in `apps/web/.eslintrc.cjs` | `pnpm --filter @apps/web run lint` |
| L2 | `scripts/guards/audit-ui-primitives-boundary.mjs` (`audit-boundary`) | `predev` / `prebuild` / `prelint` (P3-E-APP-HOOK) |
| L3 | `scripts/guards/import-boundary-ast.mjs` | Same hooks + monorepo CI |
| L4 | `dependency-cruiser` rule `apps-web-no-workspaces-except-starter` | `pnpm run guard:architecture` |

## Allowed subpaths (Phase 3.3)

- `@app-tour/ui-primitives/button`
- `@app-tour/ui-primitives/input`
- `@app-tour/ui-primitives/field-shell`
- `@app-tour/ui-primitives/alert`
- `@app-tour/ui-primitives/badge`

## PR contract (P3-E-PRIM-NEW)

When adding a new primitive:

1. Add `package.json` `exports` + `files` + `sideEffects` in `ui-primitives`.
2. Wire tokens + visual/wiring test in `packages/ui-primitives`.
3. Prove **zero barrel leakage**: `pnpm --filter @apps/web run audit-boundary` + ESLint on the PR branch.

## Forbidden

```ts
import { Button } from "@app-tour/ui-primitives"; // FAIL — barrel
```

## Required

```ts
import { Button } from "@app-tour/ui-primitives/button"; // OK
```

# Phase 3.1 validation — 2026-09-25

## Scope

Validate the `workspace-starter` subphase against the current implementation before changing code.

## Current-SHA evidence

- SHA: `6df212b29e00ef57370360a7f785e114d6465b30`
- `pnpm --filter @app-tour/workspace-starter run build`: PASS
- `pnpm --filter @app-tour/workspace-starter run test`: PASS, `34/34`
- focused Web/generated-loader/boundary tests: PASS, `35/35`
- `pnpm run phase-2:gate`: PASS on the same SHA
- `pnpm run doc-gate`: PASS
- `pnpm run phase-3:guard`: PASS, `11/11`

## Finding

The old EC-31-1 wording claimed that `listBootstrapWorkspacePlugins` directly consumes the `workspace-starter` package. The active implementation intentionally splits these paths:

1. `apps/web/src/bootstrap/workspace-plugins.ts` uses the generic SDK starter reference so the hand-written host has no static product-workspace import.
2. `apps/web/src/bootstrap/workspace-plugin-loaders.generated.ts` dynamically imports `@app-tour/workspace-starter` from the generated manifest registry and calls `getWorkspacePlugin()`.
3. `packages/workspaces/starter` owns the published package, theme assets, manifest, build, and package tests.

This is an architecture/documentation mismatch, not a runtime defect.

Classification: `false-positive — stale contract wording`.

## Decision

- Keep the current split; it enforces the host boundary and avoids duplicate plugin state.
- Update EC-31-1 to describe both the SDK bootstrap reference and generated package loader.
- Do not add a static import from `apps/web` to `@app-tour/workspace-starter`.
- Do not add a second starter plugin registry or state machine.

## Next gate

Phase 3.1 is source- and boundary-verified on this SHA. Remaining Phase 3 runtime work must proceed one subphase at a time; this finding does not authorize starting 3.2 or closing the whole Phase 3.

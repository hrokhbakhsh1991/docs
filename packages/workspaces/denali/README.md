# @app-tour/workspace-denali (test-only probe)

**Phase:** 6.x product workspace — **not** Phase 0 deliverable.

This package exists on trunk **only** as a negative-test probe for foundation guards:

- [`denali-coupling.contract.spec.ts`](../../workspace-sdk/test/denali-coupling.contract.spec.ts) — depcruise must block product imports of Denali paths (H-01).
- [`__fixtures__/denali-breach.ts`](../../workspace-sdk/test/__fixtures__/denali-breach.ts) — intentional corruption fixture for import-purity audit.
- [`denali-workspace-binding.contract.spec.ts`](../../workspace-sdk/test/denali-workspace-binding.contract.spec.ts) — `resolveWorkspacePluginIdForType("denali")` returns `null` until Phase 6.

## Policy

| Rule | Detail |
|------|--------|
| **Do not** import from app/product packages | `dependency-cruiser` rule `no-denali-product-ids` |
| **Do not** add to `pnpm-workspace` consumers | No `dependencies` on `@app-tour/workspace-denali` in apps or platform packages |
| **Do not** treat as shipped workspace | Full Denali shell ships in Phase 6 per `docs/MIGRATION-MAP.md` |

## Contents

- `index.ts` — exports `DENALI_BREACH_PROBE` for fixture imports only.
- No theme, domain, or plugin implementation on trunk.

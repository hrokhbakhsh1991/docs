# Denali wizard field registry (single source of truth)

Authoritative registry sources live in **`packages/denali-domain/src/registry/`**:

| File | Purpose |
|------|---------|
| `denaliFieldRegistryData.ts` | All field rows (canonical path, step, RHF/Zod, matrix tags, overrides) |
| `denaliRuleMatrixRecipes.ts` | Category × duration → which matrix tags are active |

This directory holds web-local re-exports and codegen helpers only. Do not add a shadow `denaliFieldRegistryData.ts` here.

## After every registry change

```bash
pnpm --filter web generate:denali-wizard
pnpm --filter web audit:denali-registry   # also runs on git pre-commit (husky)
```

## Generated (do not edit)

Artifacts are emitted under `packages/denali-domain/src/` and re-exported into the web wizard tree.

- `../rules/generated/denaliRuleSet.generated.ts`
- `../rules/generated/denaliCanonicalPathMap.generated.ts`
- `../../schemas/denaliTourCreateBaseSchema.generated.ts`

`denaliRuleModel.ts` and `denaliTourCreateBaseSchema.ts` are thin hand-maintained wrappers (types, test fixtures, re-exports).

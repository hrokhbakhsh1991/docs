# Denali wizard field registry (single source of truth)

## What to edit

| File | Purpose |
|------|---------|
| `denaliFieldRegistryData.ts` | All field rows (canonical path, step, RHF/Zod, matrix tags, overrides) |
| `denaliRuleMatrixRecipes.ts` | Category × duration → which matrix tags are active |

Helpers and exports: `DenaliFieldRegistry.ts`.

## After every change

```bash
pnpm --filter web generate:denali-wizard
pnpm --filter web audit:denali-registry   # also runs on git pre-commit (husky)
```

## Generated (do not edit)

- `../rules/generated/denaliRuleSet.generated.ts`
- `../rules/generated/denaliCanonicalPathMap.generated.ts`
- `../../schemas/denaliTourCreateBaseSchema.generated.ts`

`denaliRuleModel.ts` and `denaliTourCreateBaseSchema.ts` are thin hand-maintained wrappers (types, test fixtures, re-exports).

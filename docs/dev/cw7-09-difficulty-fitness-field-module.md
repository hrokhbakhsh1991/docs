# CW7-09 — Difficulty/Fitness field-registry fragment module (implementation)

**Verdict:** Implementation  
**Ledger task:** CW7-09  
**Status:** Optional `workspaceDifficultyFitness.fieldModule` → codegen bindings + Denali adapter fragment  
**Prepared:** 2026-08-24  
**Design contract:** [`cw7-09-workspace-difficulty-fitness-contract.md`](cw7-09-workspace-difficulty-fitness-contract.md)

---

## 1. Scope

| Deliverable | Location |
| ----------- | -------- |
| Generic fragment builder | `packages/workspace-sdk/src/difficulty-fitness/workspace-difficulty-fitness-field-module.ts` |
| Denali adapter fragment | `denali-difficulty-fitness-field-module.ts` — difficulty + fitness rows |
| Manifest binding | Denali `workspaceDifficultyFitness.fieldModule` |
| Codegen | `difficulty-fitness.mjs` — `generateWorkspaceDifficultyFitnessFieldModuleBindings` |
| Generated registry | `apps/web/src/bootstrap/workspace-difficulty-fitness-field-module-bindings.generated.ts` |
| Merge seam | `merge-workspace-field-registry-with-difficulty-fitness-fragments.ts` |
| Golden parity | `denali-difficulty-fitness-field-parity.spec.ts` |

**Integration flow:**

```text
workspaceDifficultyFitness.capabilities.wizardTourField === true
  → manifest fieldModule binding required at codegen assert
  → generated import table keyed by workspaceType
  → Denali adapter consumes generic `defineWorkspaceDifficultyFitnessFieldFragment`
```

**Out of scope:** Denali difficulty scale UI, marketing filter labels, publish-readiness matrix thresholds.

---

## 2. Fragment contract

Workspace adapters export a frozen `WorkspaceDifficultyFitnessFieldRegistryFragment` via manifest `fieldModule` export. Generic layer owns fragment shape and merge mechanics; workspace owns paths, step ids, tags, zod kinds, and presentation metadata.

Tour-field configs use `defineWorkspaceDifficultyFitnessFieldFragment(fields[])` — multiple rows per capability (difficulty + fitness).

---

## 3. Tests

| Spec | Coverage |
| ---- | -------- |
| `denali-difficulty-fitness-field-parity.spec.ts` | Fragment canonical paths + ids match full registry rows |
| `workspace-difficulty-fitness-codegen.spec.mjs` | Denali fieldModule binding emitted in generated registry |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw7-09-difficulty-fitness-field-module.md`.*

# Phase 6 — Legacy port checklist (6.2)

> **Source:** `legacy/packages/denali-domain/src/` (115 files) · **Target:** `packages/workspaces/denali/src/`

## Must port (P0)

| Legacy file / dir                                      | Plugin target         | Parity test           |
| ------------------------------------------------------ | --------------------- | --------------------- |
| `registry/denaliFieldRegistryData.ts`                  | `field-registry/`     | field id count        |
| `registry/DenaliFieldRegistry.ts`                      | `field-registry/`     | resolve()             |
| `registry/denaliRuleMatrixRecipes.ts`                  | `field-registry/`     | matrix rows           |
| `rules/evaluateFormRules.ts`                           | `rules/`              | golden fixture        |
| `rules/generated/*.generated.ts`                       | `rules/generated/`    | codegen diff          |
| `schemas/denaliCanonicalTourSchema.unified.ts`         | `schemas/`            | zod parse             |
| `validation/denaliWizardFormZod.ts`                    | `validation/`         | invalid → fail        |
| `validation/publishReadinessRules.ts`                  | `validation/`         | publish-ready fixture |
| `adapters/denaliCanonicalFormAdapter.ts`               | `adapters/` (not acl) | round-trip            |
| `projection/buildDenaliCreateTourPayloadProjection.ts` | `projection/`         | payload snapshot      |

## Port with ACL wrapper (P1)

| Legacy                        | ACL function                        |
| ----------------------------- | ----------------------------------- |
| Legacy trip_details shape     | `acl/normalizeLegacyTripDetails.ts` |
| Legacy create-tour DTO strips | `acl/toCanonicalDocument.ts`        |

## Do NOT port into trunk

| Legacy path                                                  | Reason                                       |
| ------------------------------------------------------------ | -------------------------------------------- |
| `legacy/apps/web/.../wizard/denali/**`                       | Duplicate SoT — composites only after domain |
| `legacy/apps/api/.../mountain-outdoor.workspace.strategy.ts` | Replaced by WorkspacePlugin                  |
| `legacy/apps/api/.../modules/finance/**`                     | 6.4 handler pattern only                     |

## Verify command

```bash
pnpm --filter @app-tour/workspace-denali test test/registry-parity.spec.ts
```

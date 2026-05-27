# Denali Development Protocol

Before implementing any new feature or changing existing logic, every developer (and AI collaborator) must pass the following 5-step "Acid Test":

## The 5-Step Protocol

1.  **Contract-First (Data Safety):**
    * Is there a new field or model? **Define it in `@repo/shared-contracts` first.** Never introduce raw DTOs or unchecked JSONB fields in services.
2.  **Strategy-Based (Workspace Logic):**
    * Is this logic workspace-specific? **Do NOT write `if (profile === ...)` or `switch (tenant)`.** Add a method to `IWorkspaceStrategy` and register it in `WorkspaceStrategyRegistry`.
3.  **Access-Controlled (RBAC):**
    * Who can do this? **Use `workspace-access.helper.ts`.** Never perform ad-hoc role checking or string-based role comparisons in services.
4.  **Atomic (Transaction Integrity):**
    * Does this change involve multiple modules or payment states? **Use an `Orchestrator` to wrap the operation in a single database transaction.**
5.  **UI/Settings (Centralized Config):**
    * Does this impact the settings UI? **Use the centralized helpers** (e.g., `getTourFormProfileOptions`). Do not hardcode lists of options in React components.

## "The Acid Test"

If your feature requires adding new conditional logic (`if`/`switch`) to a service, **STOP.** You are likely violating the architecture. Re-read the `WorkspaceStrategy` pattern and integrate your logic there instead.

---

## Denali Create Wizard — Rail Layout (Phase 3 Migration)

Source of truth for step order: `apps/web/src/features/tours/wizard/denaliStepConfig.ts` (`getDenaliWizardSteps()`).

### Current rail (layout version 2)

| Index | Step id | UI component | Primary content |
|------:|---------|--------------|-----------------|
| 0 | `denali_basic` | `DenaliBasicInfoStep` | Category, dates, capacity, zones |
| 1 | `denali_photos` | `DenaliPhotosStep` | **Program copy** (themes, short/long desc) + gallery |
| 2 | `denali_program` | `DenaliProgramNatureStep` | Outdoor metrics + daily itinerary |
| 3 | `denali_logistics` | `DenaliLogisticsStep` | Gathering, transport, gear, custom services |
| 4 | `denali_pricing` | `DenaliPricingStep` | Price + participant requirements |
| 5 | `review` | `DenaliReviewStep` | Read-only mirror of steps 0–4 (+ pricing section) |

Registry `stepId` values in `denaliFieldRegistryData.ts` match this layout (e.g. `program.themeIds` → `denali_photos`, `program.itinerary` → `denali_program`).

### Legacy rail (layout version 1 — pre–phase 3)

`basic → program → logistics → pricing → photos → review`

Photos and program content were on different steps; **do not** assume `currentStepIndex` from old drafts maps 1:1 to the new rail.

### Draft autosave & ghost-state cleanup

- Draft key: `denali-create` (see `apps/web/src/features/tours/drafts/denali-adapter.ts`).
- Snapshots store `{ form, currentStepIndex, railLayoutVersion? }`.
- On fetch/merge/push, `sanitizeDenaliWizardDraftSnapshot` (web) and `migrateDenaliCreateDraftData` (`@repo/shared-contracts`) remap legacy indices by **step id**, set `railLayoutVersion: 2`, and run `normalizeDenaliWizardForm` + `applyDenaliInvariantState` to purge hidden/ghost fields.
- Validation grouping for review errors uses registry `stepId`, not numeric index (`denaliWizardSubmitIssuePresentation.ts`).

### After changing registry or rail order

1. Run `pnpm --filter @apps/web generate:denali-wizard`.
2. Update co-located tests under `apps/web/src/features/tours/wizard/denali/steps/__tests__/`.
3. Run phase 4 compliance tests (`denali-adapter.spec.ts`, `DenaliReviewValidationSummary.integration.test.tsx`, `DenaliStepFocusBridge.integration.test.tsx`).

Progress log for the migration phases: `MAP.MD` and `DENALI_WIZARD_MIGRATION.md` (repo docs root). Roadmap checklist: `maplog2.md`.

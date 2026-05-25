# Legacy classic tour-create wizard

Nine-step (classic) rail UI and Zod schemas. **Do not import these modules from new code.**

| Entry | Use instead |
|-------|-------------|
| `ClassicTourCreateWizardRoot` | `@/components/tours/wizard/TourCreateWizard` (orchestrator) |
| `steps/*` (except shared combobox) | Denali steps under `@/features/tours/wizard/denali/steps` |
| `schemas/*` | Denali schemas under `@/features/tours/wizard/schemas` |

Shared control: `../steps/DestinationCombobox.tsx` (used by Denali basic step).

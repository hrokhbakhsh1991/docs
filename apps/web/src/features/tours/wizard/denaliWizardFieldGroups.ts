import type { FieldGroupId } from "@/features/tours/wizard/fieldGroups";
import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";

/**
 * Maps each Denali MVP step to classic wizard field groups (enterprise registry).
 * @see docs/20-architecture/tour-wizard-field-groups.md §8
 */
export const DENALI_STEP_TO_FIELD_GROUPS: Record<
  DenaliCreateWizardStepId,
  readonly FieldGroupId[]
> = {
  denali_basic: ["basic_info", "pricing_capacity", "schedule_location"],
  denali_program: ["basic_info"],
  denali_logistics: ["logistics"],
  denali_pricing: ["pricing_capacity", "participation"],
  denali_legal: ["policies"],
  denali_photos: [],
  review: ["policies", "participation"],
};

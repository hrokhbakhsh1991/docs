import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

/** Denali create-wizard draft snapshot persisted via draft-engine. */
export type DenaliWizardDraftSnapshot = {
  form: DenaliCreateTourWizardForm;
  currentStepIndex: number;
  /** Wizard rail layout generation; see {@link DENALI_WIZARD_RAIL_LAYOUT_VERSION}. */
  railLayoutVersion?: number;
};

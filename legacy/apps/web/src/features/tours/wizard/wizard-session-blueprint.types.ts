import type { TourFormProfile } from "@repo/types";

import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import type { WorkspaceWizardConfig } from "@/features/tours/wizard/workspace-wizard.config";

/** Pinned wizard layout snapshot for the duration of a create-tour editing session. */
export type WizardSessionBlueprint = {
  readonly template: TenantWizardTemplate;
  readonly profile: TourFormProfile;
  readonly shellConfig: WorkspaceWizardConfig;
};

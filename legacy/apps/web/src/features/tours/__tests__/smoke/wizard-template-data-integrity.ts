import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import { DATA_LEGACY_PROFILE_MISMATCH_MESSAGE } from "@/features/tours/wizard/validation/data-legacy-error";
import { isDenaliStructuredTemplate } from "@/features/tours/wizard/validation/denali-template-shape";
import { StrictProfileValidator } from "@/features/tours/wizard/validation/strict-profile-validator";

export const DATA_MISMATCH_LEGACY_PROFILE_ON_DENALI_TEMPLATE = DATA_LEGACY_PROFILE_MISMATCH_MESSAGE;

export type WizardTemplateEnvelope = {
  template: TenantWizardTemplate | null;
};

export type WizardTemplateRow = TenantWizardTemplate;

export { isDenaliStructuredTemplate };

export function assertDenaliTemplateNotLegacyGeneral(template: TenantWizardTemplate): void {
  StrictProfileValidator.assertNoLegacyGeneralOnDenaliStructure(template);
}

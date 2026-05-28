import type { TenantWizardTemplate } from "@/features/tours";
import { DATA_LEGACY_PROFILE_MISMATCH_MESSAGE } from "@/features/tours";
import { isDenaliStructuredTemplate } from "@/features/tours";
import { StrictProfileValidator } from "@/features/tours";

export const DATA_MISMATCH_LEGACY_PROFILE_ON_DENALI_TEMPLATE = DATA_LEGACY_PROFILE_MISMATCH_MESSAGE;

export type WizardTemplateEnvelope = {
  template: TenantWizardTemplate | null;
};

export type WizardTemplateRow = TenantWizardTemplate;

export { isDenaliStructuredTemplate };

export function assertDenaliTemplateNotLegacyGeneral(template: TenantWizardTemplate): void {
  StrictProfileValidator.assertNoLegacyGeneralOnDenaliStructure(template);
}

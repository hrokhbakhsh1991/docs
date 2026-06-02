import type { TourFormProfile } from "@repo/types";

import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";

import { DATA_LEGACY_PROFILE_MISMATCH_MESSAGE, DataLegacyError } from "./data-legacy-error";
import { isDenaliStructuredTemplate } from "./denali-template-shape";

export type StrictProfileValidationInput = {
  readonly template: TenantWizardTemplate;
  readonly resolvedProfile: TourFormProfile;
};

/**
 * Guards workspace template authority at wizard load.
 * Fails closed when Denali-shaped storage carries the legacy `general` profile.
 */
export class StrictProfileValidator {
  static validate(input: StrictProfileValidationInput): void {
    StrictProfileValidator.assertNoLegacyGeneralOnDenaliStructure(input.template);
    StrictProfileValidator.assertResolvedMatchesTemplate(input);
  }

  static assertNoLegacyGeneralOnDenaliStructure(template: TenantWizardTemplate): void {
    if (!isDenaliStructuredTemplate(template)) {
      return;
    }
    if (template.baseProfile === "general") {
      throw new DataLegacyError(DATA_LEGACY_PROFILE_MISMATCH_MESSAGE);
    }
  }

  static assertResolvedMatchesTemplate(input: StrictProfileValidationInput): void {
    const { template, resolvedProfile } = input;
    if (!isDenaliStructuredTemplate(template)) {
      return;
    }
    if (resolvedProfile === "general") {
      throw new DataLegacyError(DATA_LEGACY_PROFILE_MISMATCH_MESSAGE);
    }
  }
}

export function validateWorkspaceTemplateAtWizardLoad(
  template: TenantWizardTemplate,
  resolvedProfile: TourFormProfile,
): void {
  StrictProfileValidator.validate({ template, resolvedProfile });
}

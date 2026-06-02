import { DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS } from "@repo/types/denali";
import { isTourFormProfile, type TourFormProfile } from "@repo/types";

import { getWizardConfig } from "@/features/tours/wizard/workspace-wizard.config";

import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/** True when stored template JSON follows Denali canonical / rule-engine shape (not classic 9-step). */
export function isDenaliStructuredTemplate(
  template: Pick<
    TenantWizardTemplate,
    "baseProfile" | "canonicalData" | "fieldRulesOverlay"
  >,
): boolean {
  const canonical = template.canonicalData;
  if (isPlainObject(canonical)) {
    const hasCanonicalField = DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS.some(
      (key) => canonical[key] !== undefined,
    );
    if (hasCanonicalField) {
      return true;
    }
  }

  const overlay = template.fieldRulesOverlay;
  if (isPlainObject(overlay) && Object.keys(overlay).length > 0) {
    return true;
  }

  const profile = template.baseProfile;
  if (typeof profile === "string" && isTourFormProfile(profile)) {
    if (getWizardConfig(profile as TourFormProfile).wizardMode === "denali") {
      return true;
    }
  }

  return false;
}

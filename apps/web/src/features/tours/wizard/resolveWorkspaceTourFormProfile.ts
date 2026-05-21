import { DEFAULT_TOUR_FORM_PROFILE, normalizeTourFormProfileInput, type TourFormProfile } from "@repo/types";

import type {
  TenantWizardTemplate,
  TenantWizardTemplateEnvelope,
} from "@/features/tours/wizard/template/tenant-wizard-template.types";

/**
 * Web mirror of API {@link resolveWorkspaceTourFormProfile} (map-phase §1).
 * Reads only `workspace_tour_wizard_templates.base_profile` from the settings envelope or template row.
 */
export function resolveWorkspaceTourFormProfileFromTemplate(
  source: TenantWizardTemplateEnvelope | TenantWizardTemplate | null | undefined,
): TourFormProfile {
  const raw =
    source != null && "baseProfile" in source
      ? source.baseProfile
      : source?.template?.baseProfile;
  if (raw == null || String(raw).trim() === "") {
    return DEFAULT_TOUR_FORM_PROFILE;
  }
  return normalizeTourFormProfileInput(raw);
}

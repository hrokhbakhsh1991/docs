import {
  denaliCanonicalBasicsFromTourKind,
  isDenaliMountainCategory,
  type DenaliTourKind,
} from "@repo/types";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

/** Denali `basicInfo.tourType` values in the mountaineering (mountain) category. */
export function isDenaliMountaineeringTourType(
  tourType: DenaliTourKind | string | null | undefined,
): boolean {
  if (tourType == null || tourType === "") return false;
  const basics = denaliCanonicalBasicsFromTourKind(tourType as DenaliTourKind);
  return basics != null && isDenaliMountainCategory(basics.category);
}

/**
 * Whether the peak auto-approval threshold field should render.
 *
 * Predicate parameters map to wizard form fields:
 * - `tourType === 'mountaineering'` → {@link isDenaliMountaineeringTourType} on `basicInfo.tourType`
 * - `adminApproval === true` → `basicInfo.requiresManualAdminApproval === true`
 */
export function isPeakExperienceVisible(form: DenaliCreateTourWizardForm): boolean {
  return (
    isDenaliMountaineeringTourType(form.basicInfo.tourType) &&
    form.basicInfo.requiresManualAdminApproval === true
  );
}

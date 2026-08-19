import { denaliRegistrationApprovalFromManualFlag } from "../booking/resolve-denali-registration-approval-mode";
import {
  denaliCanonicalBasicsFromTourKind,
  isDenaliMountainCategory,
  type DenaliTourKind,
} from "../types/legacy/repo-types";

import type { DenaliCreateTourWizardForm } from "../schemas/denaliCore.schema";

/** Denali `basicInfo.tourType` values in the mountaineering (mountain) category. */
export function isDenaliMountaineeringTourType(
  tourType: DenaliTourKind | string | null | undefined
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
    isManualAdminApprovalRequired(form)
  );
}

/**
 * Recent-tour auto-approve threshold — all categories, only when the operator
 * checkbox is on. Must not use `whenTruthy` (`"false"` strings are truthy).
 */
export function isManualAdminApprovalRequired(form: DenaliCreateTourWizardForm): boolean {
  return denaliRegistrationApprovalFromManualFlag(form.basicInfo.requiresManualAdminApproval) ===
    "manual";
}

/** Organizer group liability insurance — always offered on the pricing step. */
export function isGroupInsuranceVisible(): boolean {
  return true;
}

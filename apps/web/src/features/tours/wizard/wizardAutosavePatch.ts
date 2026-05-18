import type { TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import type { TenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { stripTenantGatedTourCreateGroups } from "@/features/tours/contracts/tenant-tour-form-contract";
import {
  GROUP_TO_TOUR_CREATE_ROOT_KEYS,
  sanitizeInactiveRootsForProfile,
} from "@/features/tours/wizard/fieldGroups";
import type { TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";
import { wizardStepEngine } from "@/features/tours/wizard/wizardStepEngine";

/**
 * Top-level form roots owned by the step's primary field group (Phase 2.5 autosave).
 * Returns `{}` for `review` (no owning group).
 */
export function pickTourCreateRootsForStep(
  values: TourCreateFormValues,
  stepKey: TourCreateWizardStepId,
): Partial<TourCreateFormValues> {
  const group = wizardStepEngine.getPrimaryGroupForStep(stepKey);
  if (!group) {
    return {};
  }
  const patch: Partial<TourCreateFormValues> = {};
  for (const root of GROUP_TO_TOUR_CREATE_ROOT_KEYS[group]) {
    const slice = values[root];
    if (slice !== undefined) {
      Object.assign(patch, { [root]: slice });
    }
  }
  return patch;
}

/**
 * Merges a sanitized slice for `stepKey` into the existing draft patch so localStorage
 * payloads stay small while preserving data from other steps.
 */
export function mergeWizardAutosavePatch(
  existing: Partial<TourCreateFormValues> | undefined,
  values: TourCreateFormValues,
  stepKey: TourCreateWizardStepId,
  profile: TourFormProfile,
  tenantFormContract: TenantTourFormContract,
): Partial<TourCreateFormValues> {
  const sanitized = stripTenantGatedTourCreateGroups(
    tenantFormContract,
    sanitizeInactiveRootsForProfile(values, profile),
  );
  const stepSlice = pickTourCreateRootsForStep(sanitized, stepKey);
  if (Object.keys(stepSlice).length === 0) {
    return { ...existing };
  }
  return { ...existing, ...stepSlice };
}

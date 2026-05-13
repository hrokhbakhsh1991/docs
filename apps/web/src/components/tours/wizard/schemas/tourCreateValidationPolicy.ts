import type { TourFormProfile } from "@repo/types";

import { getStepRule } from "@/features/tours/wizard/profileRules/getProfileRules";

/**
 * Runtime flags for `tourCreateSchema` refinements when the **resolved form profile**
 * hides wizard steps (urban / cinema). Mutated only from the tour create wizard shell
 * (`useLayoutEffect`) so Zod sees the latest profile before submit/Next validation.
 *
 * Phase 3 bridge until Phase 4 composes schema from `fieldGroups` + `withProfileRefinements`.
 */
export type TourCreateWizardValidationFlags = {
  /** When true, `itinerary.days` may be empty (cinema_event / urban_event). */
  relaxItineraryMinDays: boolean;
  /** When true, `logistics.primaryTransportMode` is not required (urban_event). */
  relaxLogisticsPrimary: boolean;
};

const DEFAULT_FLAGS: TourCreateWizardValidationFlags = {
  relaxItineraryMinDays: false,
  relaxLogisticsPrimary: false,
};

let flags: TourCreateWizardValidationFlags = { ...DEFAULT_FLAGS };

/**
 * Optional flags for flat `TourForm` (edit path); OR-merged in
 * {@link mergeTourValidationFlagsForSchema}.
 *
 * @deprecated Cross-feature mutable singleton. Phase D replaces this with the
 * rules-layer derivation already used by {@link tourFormProfileToWizardValidationFlags}:
 * Edit will call `getStepRule`/`getFieldRule` directly instead of pushing flags into
 * the wizard schema's hidden state. Do not add new flat-form flags.
 */
let flatFormFlags: TourCreateWizardValidationFlags = { ...DEFAULT_FLAGS };

export function getTourCreateWizardValidationFlags(): TourCreateWizardValidationFlags {
  return flags;
}

export function mergeTourValidationFlagsForSchema(): TourCreateWizardValidationFlags {
  return {
    relaxItineraryMinDays: flags.relaxItineraryMinDays || flatFormFlags.relaxItineraryMinDays,
    relaxLogisticsPrimary: flags.relaxLogisticsPrimary || flatFormFlags.relaxLogisticsPrimary,
  };
}

/**
 * @deprecated Edit→wizard mutable-flag bridge. New code must not introduce additional
 * callers. Replacement path (Phase D): consume `getStepRule`/`getFieldRule` from
 * `@/features/tours/wizard/profileRules/getProfileRules` directly in Edit so the
 * schema's hidden flag state is no longer needed.
 */
export function setTourFlatFormProfileValidationFlags(patch: Partial<TourCreateWizardValidationFlags>): void {
  flatFormFlags = { ...flatFormFlags, ...patch };
}

/** @deprecated See {@link setTourFlatFormProfileValidationFlags}. */
export function resetTourFlatFormProfileValidationFlags(): void {
  flatFormFlags = { ...DEFAULT_FLAGS };
}

export function setTourCreateWizardValidationFlags(patch: Partial<TourCreateWizardValidationFlags>): void {
  flags = { ...flags, ...patch };
}

export function resetTourCreateWizardValidationFlags(): void {
  flags = { ...DEFAULT_FLAGS };
}

/**
 * Resolved-profile → Zod refinement flags. `tourCreateSchema` reads the merged flags via
 * {@link mergeTourValidationFlagsForSchema}; this function is the canonical translation step.
 *
 * Phase B alignment (closes the M-2 mismatch from the unified-domain discovery): derives
 * the flags from the rules layer rather than hardcoding `profile === "..."` checks. The
 * rules-layer step visibility is itself sourced from `fieldGroups.ts:getInactiveFieldGroupsForProfile`,
 * so urban/cinema agreement is structural — adding a new profile that hides one of these
 * steps automatically relaxes the corresponding refinement.
 */
export function tourFormProfileToWizardValidationFlags(profile: TourFormProfile): TourCreateWizardValidationFlags {
  const itineraryHidden = getStepRule(profile, "itinerary")?.visibility === "hidden";
  const logisticsHidden = getStepRule(profile, "logistics")?.visibility === "hidden";
  return {
    relaxItineraryMinDays: itineraryHidden,
    relaxLogisticsPrimary: logisticsHidden,
  };
}

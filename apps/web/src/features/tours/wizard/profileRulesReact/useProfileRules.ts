"use client";

import { useMemo } from "react";

import type { TourFormProfile } from "@repo/types";

import { useTourWizardProfile } from "@/features/tours/wizard/TourWizardProfileContext";
import {
  getFieldRule,
  getStepRule,
  getStepRules,
  isFieldRecommended,
  isFieldRequiredAtLevel,
  isFieldVisible,
} from "@/features/tours/wizard/profileRules/getProfileRules";
import type {
  FieldRule,
  ProfileRules,
  StepRule,
  StepRules,
  ValidationLevel,
  WizardFieldPath,
} from "@/features/tours/wizard/profileRules/types";
import type { TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";

/**
 * React bindings (L3) over the pure rules layer in `profileRules/`. These hooks read the
 * current `resolvedProfile` from `TourWizardProfileContext` and delegate to pure helpers.
 *
 * Pure rules (the table itself, parity helpers) live in `profileRules/` and must not import
 * React. Anything in this folder may import React.
 */

/** Convenience: the currently resolved Tour Form Profile from the wizard context. */
export function useCurrentProfile(): TourFormProfile {
  return useTourWizardProfile().resolvedProfile;
}

/** Memoized rules table for the current profile (provided by the context). */
export function useProfileRules(): ProfileRules {
  return useTourWizardProfile().rules;
}

export function useFieldRule(path: WizardFieldPath | string): FieldRule | undefined {
  const profile = useCurrentProfile();
  return useMemo(() => getFieldRule(profile, path), [profile, path]);
}

export function useStepRule(stepId: TourCreateWizardStepId): StepRule | undefined {
  const profile = useCurrentProfile();
  return useMemo(() => getStepRule(profile, stepId), [profile, stepId]);
}

/** Step rail rule plus all {@link FieldRule} entries whose `belongsToStep` is `stepId`. */
export function useStepRules(stepId: TourCreateWizardStepId): StepRules {
  const profile = useCurrentProfile();
  return useMemo(() => getStepRules(profile, stepId), [profile, stepId]);
}

/** True iff the field's derived rule is not `"hidden"` for the current profile. */
export function useIsFieldVisible(path: WizardFieldPath | string): boolean {
  const profile = useCurrentProfile();
  return useMemo(() => isFieldVisible(profile, path), [profile, path]);
}

/**
 * True iff the field's derived rule marks it as `"recommended"` (non-blocking hint tier)
 * for the **current** wizard profile. Mirrors {@link isFieldRecommended} from the pure rules
 * layer (Phase P12) — see also `FieldRequiredness` in `profileRules/types.ts`.
 *
 * Pair with `FormField`'s `recommendedLabel` prop, supplying the translated badge text from
 * the caller's i18n table (e.g. `t("tourWizard.fieldHint.recommended")`).
 */
export function useIsFieldRecommended(path: WizardFieldPath | string): boolean {
  const profile = useCurrentProfile();
  return useMemo(() => isFieldRecommended(profile, path), [profile, path]);
}

/**
 * Effective required-ness for the current profile at the given validation level.
 * Defaults to `"submit"`. Pass `cursor` + `visibleSteps` at `"stepNav"` to opt into the
 * position-aware relaxation (mirrors the legacy `relaxItineraryMinDays` /
 * `relaxLogisticsPrimary` runtime flags).
 */
export function useIsFieldRequired(
  path: WizardFieldPath | string,
  level: ValidationLevel = "submit",
  cursor?: TourCreateWizardStepId,
  visibleSteps?: readonly TourCreateWizardStepId[],
): boolean {
  const profile = useCurrentProfile();
  return useMemo(
    () => isFieldRequiredAtLevel(profile, path, level, cursor, visibleSteps),
    [profile, path, level, cursor, visibleSteps],
  );
}

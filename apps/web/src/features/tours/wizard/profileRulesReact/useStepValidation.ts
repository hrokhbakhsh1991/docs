"use client";

import { useCallback } from "react";

import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";
import {
  requiredFieldsForProfile,
  requiredFieldsForStep,
  validateForAutosave,
  validateForStepNavigation,
  validateForSubmit,
  type ValidationResult,
} from "@/features/tours/wizard/profileRules";
import type { WizardFieldPath } from "@/features/tours/wizard/profileRules/types";
import type { TourCreateWizardStepId } from "@/features/tours/wizard/stepConfig";

import { useCurrentProfile } from "./useProfileRules";

/**
 * React bindings (L3) over the pure validation helpers in `profileRules/validation.ts`.
 * These hooks read the resolved profile from `TourWizardProfileContext` and return stable,
 * memoized callbacks that the caller invokes with current form values.
 *
 * Three flavours mirror the three validation levels:
 *
 * - {@link useAutosaveValidator} — returns a callback
 *   `(data) => validateForAutosave(profile, stepId, data)` for the current profile + fixed step.
 *   Used (or composable) by the wizard shell's debounced localStorage writer.
 * - {@link useStepValidator} — used by the wizard shell's `handleNext` to enforce required-
 *   ness for the step the user is leaving. Hidden steps short-circuit to "ok".
 * - {@link useSubmitValidator} — used by the wizard shell's `onSubmit` to gate the create
 *   mutation alongside Zod.
 *
 * Step components do **not** call these hooks today: they consume the cheaper
 * `useIsFieldRequired(path)` for per-field `aria-required` / `*` markers and rely on the
 * wizard shell to enforce step + submit transitions. The hooks are still exposed here so a
 * future "what's still missing on this step?" hint can be added inside a step in one line.
 */

export function useAutosaveValidator(
  stepId: TourCreateWizardStepId,
): (data: Partial<TourCreateFormValues>) => ValidationResult {
  const profile = useCurrentProfile();
  return useCallback((data) => validateForAutosave(profile, stepId, data), [profile, stepId]);
}

export function useStepValidator(
  stepId: TourCreateWizardStepId,
  visibleSteps: readonly TourCreateWizardStepId[],
): (data: TourCreateFormValues) => ValidationResult {
  const profile = useCurrentProfile();
  return useCallback(
    (data) => validateForStepNavigation(profile, stepId, data, visibleSteps),
    [profile, stepId, visibleSteps],
  );
}

export function useSubmitValidator(): (data: TourCreateFormValues) => ValidationResult {
  const profile = useCurrentProfile();
  return useCallback((data) => validateForSubmit(profile, data), [profile]);
}

/** Stable list of required field paths for the current profile (across all visible steps). */
export function useRequiredFieldsForProfile(): readonly WizardFieldPath[] {
  const profile = useCurrentProfile();
  return requiredFieldsForProfile(profile);
}

/** Stable list of required field paths for one step under the current profile. */
export function useRequiredFieldsForStep(stepId: TourCreateWizardStepId): readonly WizardFieldPath[] {
  const profile = useCurrentProfile();
  return requiredFieldsForStep(profile, stepId);
}

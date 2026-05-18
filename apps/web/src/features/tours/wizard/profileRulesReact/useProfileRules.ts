"use client";

import { useMemo } from "react";

import type { TourFormProfile } from "@repo/types";

import { useTourWizardProfile } from "@/features/tours/wizard/TourWizardProfileContext";
import { isFieldRequiredAtLevelFromRules } from "@/features/tours/wizard/profileRules/getProfileRules";
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
  const rules = useProfileRules();
  return useMemo(() => rules.fields.get(path as WizardFieldPath), [rules, path]);
}

export function useStepRule(stepId: TourCreateWizardStepId): StepRule | undefined {
  const rules = useProfileRules();
  return useMemo(() => rules.steps.get(stepId), [rules, stepId]);
}

/** Step rail rule plus all {@link FieldRule} entries whose `belongsToStep` is `stepId`. */
export function useStepRules(stepId: TourCreateWizardStepId): StepRules {
  const rules = useProfileRules();
  return useMemo(() => {
    const step = rules.steps.get(stepId);
    const fields = [...rules.fields.values()]
      .filter((f) => f.belongsToStep === stepId)
      .sort((a, b) => a.path.localeCompare(b.path));
    return { profile: rules.profile, stepId, step, fields };
  }, [rules, stepId]);
}

/** True iff the field's derived rule is not `"hidden"` for the current profile. */
export function useIsFieldVisible(path: WizardFieldPath | string): boolean {
  const rules = useProfileRules();
  return useMemo(() => {
    const rule = rules.fields.get(path as WizardFieldPath);
    if (!rule) return false;
    return rule.visibility !== "hidden";
  }, [rules, path]);
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
  const rules = useProfileRules();
  return useMemo(() => {
    const rule = rules.fields.get(path as WizardFieldPath);
    if (!rule || rule.visibility === "hidden") return false;
    return rule.required === "recommended";
  }, [rules, path]);
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
  const rules = useProfileRules();
  return useMemo(
    () => isFieldRequiredAtLevelFromRules(rules, path, level, cursor, visibleSteps),
    [rules, path, level, cursor, visibleSteps],
  );
}

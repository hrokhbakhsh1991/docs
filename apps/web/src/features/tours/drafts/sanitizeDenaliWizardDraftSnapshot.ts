import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import { getDenaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";
import { applyDenaliInvariantState } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import type { DenaliWizardDraftSnapshot } from "./denali-wizard-draft.types";

/** Rail layout v3: basic → photos → program → logistics → pricing → legal → review. */
export const DENALI_WIZARD_RAIL_LAYOUT_VERSION = 3;

/** Pre–phase 3 create wizard rail (photos last). */
export const LEGACY_DENALI_WIZARD_RAIL = [
  "denali_basic",
  "denali_program",
  "denali_logistics",
  "denali_pricing",
  "denali_photos",
  "review",
] as const satisfies readonly DenaliCreateWizardStepId[];

export function migrateDenaliDraftStepIndex(
  storedIndex: number,
  railLayoutVersion: number | undefined,
): number {
  const steps = getDenaliWizardSteps();
  const safeIndex = Number.isFinite(storedIndex) ? Math.floor(storedIndex) : 0;

  if ((railLayoutVersion ?? 1) >= DENALI_WIZARD_RAIL_LAYOUT_VERSION) {
    return Math.max(0, Math.min(safeIndex, steps.length - 1));
  }

  if ((railLayoutVersion ?? 1) >= 2) {
    const clampedV2 = Math.max(0, Math.min(safeIndex, 5));
    const withLegalStep = clampedV2 >= 5 ? clampedV2 + 1 : clampedV2;
    return Math.max(0, Math.min(withLegalStep, steps.length - 1));
  }

  const legacyIndex = Math.max(0, Math.min(safeIndex, LEGACY_DENALI_WIZARD_RAIL.length - 1));
  const stepId = LEGACY_DENALI_WIZARD_RAIL[legacyIndex]!;
  const mapped = steps.indexOf(stepId);
  return mapped >= 0 ? mapped : 0;
}

/**
 * Normalizes draft form data and remaps legacy rail indices after step relocation.
 * Purges ghost fields via {@link applyDenaliInvariantState}.
 */
export function sanitizeDenaliWizardDraftSnapshot(
  snapshot: DenaliWizardDraftSnapshot,
): DenaliWizardDraftSnapshot {
  const form = applyDenaliInvariantState(
    normalizeDenaliWizardForm(snapshot.form),
  ) as DenaliCreateTourWizardForm;

  return {
    form,
    currentStepIndex: migrateDenaliDraftStepIndex(
      snapshot.currentStepIndex,
      snapshot.railLayoutVersion,
    ),
    railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
  };
}

import { applyDenaliInvariantState } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import {
  DENALI_WIZARD_RAIL_LAYOUT_VERSION,
  denaliDraftOrchestrator,
  migrateDenaliDraftStepIndex,
} from "@repo/denali-domain";

import type { DenaliWizardDraftSnapshot } from "./denali-wizard-draft.types";

export {
  DENALI_WIZARD_RAIL_LAYOUT_VERSION,
  LEGACY_DENALI_WIZARD_RAIL,
  migrateDenaliDraftStepIndex,
} from "@repo/denali-domain";

/**
 * Normalizes draft form data and remaps legacy rail indices after step relocation.
 * Purges ghost fields via {@link applyDenaliInvariantState}.
 */
export function sanitizeDenaliWizardDraftSnapshot(
  snapshot: DenaliWizardDraftSnapshot,
): DenaliWizardDraftSnapshot {
  const hydrated = denaliDraftOrchestrator.hydrateDraftFromSync({
    form: snapshot.form,
    currentStepIndex: snapshot.currentStepIndex,
    railLayoutVersion: snapshot.railLayoutVersion,
    registryLayoutVersion: snapshot.registryLayoutVersion,
  });

  const normalized = applyDenaliInvariantState(
    normalizeDenaliWizardForm(hydrated.snapshot.form),
  ) as DenaliCreateTourWizardForm;

  return {
    form: normalized,
    currentStepIndex: migrateDenaliDraftStepIndex(
      hydrated.snapshot.currentStepIndex,
      hydrated.snapshot.railLayoutVersion,
    ),
    railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
    registryLayoutVersion: hydrated.snapshot.registryLayoutVersion,
  };
}

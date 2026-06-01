import { DENALI_ROOTS } from "@repo/shared-contracts";
import { pruneDenaliWizardFormToRegistry } from "@repo/denali-domain";
import { applyDenaliInvariantState } from "@/features/tours/wizard/denali/validation/denaliInvariantEngine";
import { normalizeDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import {
  DenaliProductionErrorCode,
  FatalProjectionError,
} from "@/features/tours/wizard/errors/denali-production-errors";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
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

const DENALI_ROOT_SET = new Set<string>(DENALI_ROOTS);

function assertRegistryRootsStrict(form: DenaliCreateTourWizardForm): void {
  const offending = Object.keys(form as unknown as Record<string, unknown>).filter(
    (key) => !DENALI_ROOT_SET.has(key),
  );
  if (offending.length > 0) {
    throw new FatalProjectionError(
      DenaliProductionErrorCode.DRAFT_SANITIZE_REGISTRY_ROOT,
      `[${DenaliProductionErrorCode.DRAFT_SANITIZE_REGISTRY_ROOT}] non-registry root keys: ${offending.join(", ")}`,
      offending,
    );
  }
}

/**
 * Normalizes draft form data, applies structural invariants, registry-prunes, and remaps legacy rail indices.
 * Throws {@link FatalProjectionError} when smuggled top-level keys survive prune (all environments).
 */
export function sanitizeDenaliWizardDraftSnapshot(
  snapshot: DenaliWizardDraftSnapshot,
  ruleSet: DenaliRuleSet,
): DenaliWizardDraftSnapshot {
  const hydrated = denaliDraftOrchestrator.hydrateDraftFromSync({
    form: snapshot.form,
    currentStepIndex: snapshot.currentStepIndex,
    railLayoutVersion: snapshot.railLayoutVersion,
    registryLayoutVersion: snapshot.registryLayoutVersion,
  });

  const normalized = normalizeDenaliWizardForm(
    hydrated.snapshot.form,
    undefined,
    ruleSet,
  ) as DenaliCreateTourWizardForm;

  const invariantBeforePrune = applyDenaliInvariantState(normalized, undefined, ruleSet);
  const pruned = pruneDenaliWizardFormToRegistry(invariantBeforePrune);
  const form = applyDenaliInvariantState(pruned, undefined, ruleSet);
  assertRegistryRootsStrict(form);

  return {
    form,
    currentStepIndex: migrateDenaliDraftStepIndex(
      hydrated.snapshot.currentStepIndex,
      hydrated.snapshot.railLayoutVersion,
    ),
    railLayoutVersion: DENALI_WIZARD_RAIL_LAYOUT_VERSION,
    registryLayoutVersion: hydrated.snapshot.registryLayoutVersion,
  };
}

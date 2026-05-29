"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { DenaliTourKind } from "@repo/types";
import type { DenaliCanonicalTourModel } from "@repo/types/denali";
import {
  DenaliDraftOrchestrator,
  denaliDraftOrchestrator,
  type DenaliDraftHydrateResult,
  type DenaliDraftSyncPayload,
} from "@repo/denali-domain";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { readDenaliCanonicalBasics } from "./denaliCanonicalBasicsControl";
import {
  denaliCanonicalToForm,
  safeDenaliFormToCanonical,
} from "./denaliCanonicalFormAdapter";
import type { DenaliUIContextOptions } from "./rules/denaliUIAdapter";
import type { DenaliRuleSet } from "./rules/denaliRuleModel";
import { applyDenaliInvariantState } from "./validation/denaliInvariantEngine";

export type DenaliWizardSyncContextValue = {
  /** True while debounced/in-flight wizard sync is active. */
  readonly isSyncing: boolean;
  readonly orchestrator: DenaliDraftOrchestrator;
  prepareDraftForSync: (
    formData: DenaliCreateTourWizardForm,
    meta: { currentStepIndex: number },
  ) => DenaliDraftSyncPayload;
  hydrateDraftFromSync: (
    remote: Partial<DenaliDraftSyncPayload> & { form: DenaliCreateTourWizardForm },
  ) => DenaliDraftHydrateResult;
  resetWizardToRegistryDefaults: () => DenaliCreateTourWizardForm;
};

const DenaliWizardSyncContext = createContext<DenaliWizardSyncContextValue>({
  isSyncing: false,
  orchestrator: denaliDraftOrchestrator,
  prepareDraftForSync: (formData, meta) =>
    denaliDraftOrchestrator.prepareDraftForSync(formData, meta),
  hydrateDraftFromSync: (remote) => denaliDraftOrchestrator.hydrateDraftFromSync(remote),
  resetWizardToRegistryDefaults: () => denaliDraftOrchestrator.resetWizardToRegistryDefaults(),
});

export function DenaliWizardSyncProvider({
  isSyncing,
  orchestrator = denaliDraftOrchestrator,
  children,
}: {
  isSyncing: boolean;
  orchestrator?: DenaliDraftOrchestrator;
  children: ReactNode;
}) {
  const value = useMemo<DenaliWizardSyncContextValue>(
    () => ({
      isSyncing,
      orchestrator,
      prepareDraftForSync: (formData, meta) => orchestrator.prepareDraftForSync(formData, meta),
      hydrateDraftFromSync: (remote) => orchestrator.hydrateDraftFromSync(remote),
      resetWizardToRegistryDefaults: () => orchestrator.resetWizardToRegistryDefaults(),
    }),
    [isSyncing, orchestrator],
  );

  return (
    <DenaliWizardSyncContext.Provider value={value}>{children}</DenaliWizardSyncContext.Provider>
  );
}

export function useDenaliWizardSync(): DenaliWizardSyncContextValue {
  return useContext(DenaliWizardSyncContext);
}

/**
 * Purges kind-incompatible leaves from canonical model via the invariant engine.
 * Used on `tourType` switches to prevent ghost state leakage across kinds.
 */
export function purgeGhostFields(
  canonicalModel: DenaliCanonicalTourModel,
  params: {
    newKind: DenaliTourKind;
    existingForm: DenaliCreateTourWizardForm;
    ruleSet: DenaliRuleSet;
    uiOptions?: DenaliUIContextOptions;
  },
): DenaliCanonicalTourModel {
  const basics = readDenaliCanonicalBasics(params.newKind);
  const nextForm = denaliCanonicalToForm(canonicalModel, params.existingForm, { basics });
  nextForm.basicInfo.tourType = params.newKind;
  const safeForm = applyDenaliInvariantState(nextForm, params.uiOptions, params.ruleSet);
  return safeDenaliFormToCanonical(safeForm);
}

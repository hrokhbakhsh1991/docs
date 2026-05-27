"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { DenaliTourKind } from "@repo/types";
import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

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
};

const DenaliWizardSyncContext = createContext<DenaliWizardSyncContextValue>({
  isSyncing: false,
});

export function DenaliWizardSyncProvider({
  isSyncing,
  children,
}: {
  isSyncing: boolean;
  children: ReactNode;
}) {
  return (
    <DenaliWizardSyncContext.Provider value={{ isSyncing }}>{children}</DenaliWizardSyncContext.Provider>
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

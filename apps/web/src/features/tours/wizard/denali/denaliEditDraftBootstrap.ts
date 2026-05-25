import type { ParsedDenaliWizardDraft } from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { denaliWizardTourEditDraftStorageKey } from "./denaliWizardDraftStorageKeys";
import type { DenaliRuleSet } from "./rules/denaliRuleModel";
import {
  readDenaliWizardDraftFromStorage,
  resolveDenaliWizardDraftHydration,
  tryHydrateDraft,
} from "./safeDraftHydration";

export type DenaliEditDraftBootstrapResult = {
  initialValues: DenaliCreateTourWizardForm;
  incompatibleDraft: ParsedDenaliWizardDraft | null;
  restoredFromDraft: boolean;
};

/**
 * Resolves edit-form initial values: auto-restore a compatible local draft over server baseline.
 */
export function bootstrapDenaliEditFormFromDraft(input: {
  tourId: string;
  serverBaseline: DenaliCreateTourWizardForm;
  ruleSet: DenaliRuleSet;
  readDraft?: (storageKey: string) => ParsedDenaliWizardDraft | null;
}): DenaliEditDraftBootstrapResult {
  const storageKey = denaliWizardTourEditDraftStorageKey(input.tourId);
  const readDraft = input.readDraft ?? readDenaliWizardDraftFromStorage;
  const resolution = resolveDenaliWizardDraftHydration(readDraft(storageKey));

  if (resolution.status === "compatible") {
    const hydrated = tryHydrateDraft(resolution.draft, input.serverBaseline, {
      ruleSet: input.ruleSet,
    });
    if (hydrated) {
      return {
        initialValues: hydrated.formValues,
        incompatibleDraft: null,
        restoredFromDraft: true,
      };
    }
  }

  if (resolution.status === "incompatible") {
    return {
      initialValues: input.serverBaseline,
      incompatibleDraft: resolution.draft,
      restoredFromDraft: false,
    };
  }

  return {
    initialValues: input.serverBaseline,
    incompatibleDraft: null,
    restoredFromDraft: false,
  };
}

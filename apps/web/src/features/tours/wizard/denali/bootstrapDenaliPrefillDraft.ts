import {
  deleteTourWizardDraft,
  patchTourWizardDraft,
  TOUR_WIZARD_DRAFT_INITIAL_VERSION,
} from "@/lib/tour-wizard-draft.client";

import {
  mergeDenaliWizardDefaults,
  parseDenaliWizardDraftRecord,
  serializeDenaliWizardDraft,
} from "@/features/tours/wizard/denaliWizardDraftEnvelope";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";

export type BootstrapDenaliPrefillResult = {
  formValues: DenaliCreateTourWizardForm;
  wizardMeta: TourWizardDraftMeta | undefined;
  draftVersion: number;
};

/**
 * Applies a clone/preset localStorage envelope as a fresh server draft at OCC version 1.
 */
export async function bootstrapDenaliPrefillDraft(
  workspaceId: string,
  serializedDraft: string,
  defaultValues: DenaliCreateTourWizardForm,
): Promise<BootstrapDenaliPrefillResult | null> {
  const parsed = parseDenaliWizardDraftRecord(serializedDraft);
  if (!parsed?.formPatch) {
    return null;
  }
  const merged = mergeDenaliWizardDefaults(defaultValues, parsed.formPatch);
  const wizardMeta = parsed.wizardMeta;
  const payload = JSON.parse(
    serializeDenaliWizardDraft(merged, wizardMeta),
  ) as Record<string, unknown>;

  await deleteTourWizardDraft(workspaceId).catch(() => {});

  const result = await patchTourWizardDraft(workspaceId, {
    currentStepIndex: 0,
    payload,
    version: TOUR_WIZARD_DRAFT_INITIAL_VERSION,
  });

  return {
    formValues: merged,
    wizardMeta,
    draftVersion: result.version ?? TOUR_WIZARD_DRAFT_INITIAL_VERSION,
  };
}

export function readDenaliPrefillFromLocalStorage(
  storageKey: string,
): ReturnType<typeof parseDenaliWizardDraftRecord> {
  if (typeof window === "undefined") {
    return null;
  }
  return parseDenaliWizardDraftRecord(localStorage.getItem(storageKey));
}

export function isDenaliCloneOrPresetPrefill(
  wizardMeta: TourWizardDraftMeta | undefined,
): boolean {
  return Boolean(wizardMeta?.sourceTourId?.trim() || wizardMeta?.sourcePresetId?.trim());
}

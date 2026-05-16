import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";

import type { TourWizardDraftMeta } from "./tourWizardProfileResolve";
import { parseTourWizardDraftMeta } from "./tourWizardProfileResolve";
import { TOUR_WIZARD_CONTRACT_VERSION } from "./contract/tour-wizard-contract-version";

export const WIZARD_DRAFT_STORAGE_KEY = "tour-create-wizard-draft-v1";

type ParsedDraft = {
  formPatch: Partial<TourCreateFormValues>;
  wizardMeta?: TourWizardDraftMeta;
};

/**
 * Parses localStorage JSON: either legacy flat `Partial<TourCreateFormValues>` or envelope with `_wizardMeta`.
 */
export function parseWizardDraftRecord(raw: string | null): ParsedDraft | null {
  if (raw == null || raw.trim() === "") return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const wizardMeta = parseTourWizardDraftMeta(parsed);
    const { _wizardMeta: _m, ...rest } = parsed;
    return { formPatch: rest as Partial<TourCreateFormValues>, wizardMeta };
  } catch {
    return null;
  }
}

export function serializeWizardDraft(
  formValues: Partial<TourCreateFormValues>,
  wizardMeta: TourWizardDraftMeta | undefined,
): string {
  const base = { ...(formValues as Record<string, unknown>) };
  if (wizardMeta) {
    base._wizardMeta = {
      ...wizardMeta,
      wizardContractVersion: TOUR_WIZARD_CONTRACT_VERSION,
    };
  }
  return JSON.stringify(base);
}

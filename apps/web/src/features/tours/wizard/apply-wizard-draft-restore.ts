import {
  defaultTourFormProfileForTourType,
  normalizeTourFormProfileInput,
  type TourFormProfile,
  type TourType,
} from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import { applyTourWizardPatch } from "@/features/tours/wizard/applyTourWizardPatch";
import type { ParsedWizardDraft } from "@/features/tours/wizard/tourWizardDraftEnvelope";

/** Applies persisted draft envelope on top of wizard defaults (shared by local + server restore). */
export function applyWizardDraftRestore(
  parsed: ParsedWizardDraft,
  defaultValues: TourCreateFormValues,
): ReturnType<typeof applyTourWizardPatch> {
  const snapshotProfile = parsed.wizardMeta
    ? normalizeTourFormProfileInput(parsed.wizardMeta.resolvedFormProfile)
    : undefined;
  const tourTypeRaw = parsed.formPatch?.overview?.tourType;
  const tourTypeForFallback =
    typeof tourTypeRaw === "string" && tourTypeRaw.trim() !== ""
      ? (tourTypeRaw as TourType)
      : undefined;
  const currentProfileForPipeline =
    snapshotProfile ?? defaultTourFormProfileForTourType(tourTypeForFallback);

  return applyTourWizardPatch({
    baseValues: defaultValues,
    patch: parsed.formPatch,
    currentProfile: currentProfileForPipeline as TourFormProfile,
    themeCatalog: undefined,
    tourType: tourTypeRaw,
    snapshot: parsed.wizardMeta,
  });
}

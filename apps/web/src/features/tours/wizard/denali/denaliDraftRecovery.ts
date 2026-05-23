import type { TourWizardDraftRecord } from "@/lib/tour-wizard-draft.client";

import { isDenaliCloneOrPresetPrefill } from "./bootstrapDenaliPrefillDraft";
import { denaliGatheringPointHasContent } from "./denaliDefaultGatheringPoints";
import { parseDenaliWizardDraftEnvelope } from "../denaliWizardDraftEnvelope";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { TourWizardDraftMeta } from "@/features/tours/wizard/tourWizardProfileResolve";

export function hasRecoverableDenaliFormPatch(
  patch: Partial<DenaliCreateTourWizardForm> | undefined,
): boolean {
  if (!patch) {
    return false;
  }
  const bi = patch.basicInfo;
  if (bi?.title?.trim()) return true;
  if (bi?.destinationId?.trim()) return true;
  if (bi?.meetingPoint?.trim()) return true;
  if (bi?.startPointLocationText?.trim()) return true;
  if (bi?.socialMediaLink?.trim()) return true;
  if (bi?.startDateTime?.trim()) return true;
  if (bi?.endDateTime?.trim()) return true;
  if (bi?.approximateReturnTime?.trim()) return true;
  if (bi?.localGuideName?.trim()) return true;
  if ((bi?.leaderUserIds?.length ?? 0) > 0) return true;
  if (bi?.capacityMax != null && bi.capacityMax > 0) return true;
  if (bi?.capacityMin != null && bi.capacityMin > 0) return true;

  const pn = patch.programNature;
  if (pn?.shortDescription?.trim() || pn?.longDescription?.trim()) return true;
  if ((pn?.themeIds?.length ?? 0) > 0) return true;
  if (pn?.difficultyLevel != null) return true;
  if (pn?.hikingHoursApprox != null) return true;
  if (pn?.altitudeMeasurement != null) return true;
  if ((pn?.itinerary?.length ?? 0) > 0) return true;

  const tp = patch.transport;
  if (tp?.transportMode && tp.transportMode !== "none") return true;
  if (tp?.dongAmount != null && tp.dongAmount > 0) return true;
  if (tp?.transportNotes?.trim()) return true;

  const pp = patch.pricingPayment;
  if (pp?.requiresPayment === true) return true;
  if (pp?.basePricePerPerson != null && pp.basePricePerPerson > 0) return true;

  const pr = patch.participantRequirements;
  if (pr?.minimumAge != null || pr?.maximumAge != null) return true;
  if (pr?.fitnessLevel?.trim()) return true;
  if ((pr?.gearItems?.length ?? 0) > 0) return true;

  if (patch.policies?.policiesText?.trim()) return true;
  if ((patch.photosData?.photos?.length ?? 0) > 0) return true;
  const gatheringPoints = patch.tripDetails?.logistics?.gatheringPoints;
  if (gatheringPoints?.some((station) => denaliGatheringPointHasContent(station))) {
    return true;
  }

  return false;
}

export function hasRecoverableServerDenaliDraft(
  draft: TourWizardDraftRecord | null | undefined,
): boolean {
  if (!draft?.payload || typeof draft.payload !== "object") {
    return false;
  }
  const parsed = parseDenaliWizardDraftEnvelope(draft.payload);
  return hasRecoverableDenaliFormPatch(parsed?.formPatch);
}

export function isRecoverableLocalDenaliDraft(
  parsed: {
    formPatch?: Partial<DenaliCreateTourWizardForm>;
    wizardMeta?: TourWizardDraftMeta;
  } | null,
): boolean {
  if (!parsed?.formPatch) {
    return false;
  }
  if (isDenaliCloneOrPresetPrefill(parsed.wizardMeta)) {
    return false;
  }
  return hasRecoverableDenaliFormPatch(parsed.formPatch);
}

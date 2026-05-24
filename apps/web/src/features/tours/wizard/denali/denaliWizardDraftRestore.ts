import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { sanitizeDenaliFormPatch } from "./denaliFormSanitize";

/**
 * True when a parsed draft patch contains user-entered values worth offering restore.
 */
export function denaliDraftHasRestorableContent(
  patch: Partial<DenaliCreateTourWizardForm> | undefined,
): boolean {
  if (patch == null) {
    return false;
  }
  const clean = sanitizeDenaliFormPatch(patch);
  if (typeof clean.basicInfo?.title === "string" && clean.basicInfo.title.trim() !== "") {
    return true;
  }
  if (typeof clean.programNature?.shortDescription === "string" && clean.programNature.shortDescription.trim() !== "") {
    return true;
  }
  if (typeof clean.programNature?.longDescription === "string" && clean.programNature.longDescription.trim() !== "") {
    return true;
  }
  if (clean.basicInfo?.destinationId != null && String(clean.basicInfo.destinationId).trim() !== "") {
    return true;
  }
  const photos = clean.photosData?.photos;
  if (Array.isArray(photos) && photos.length > 0) {
    return true;
  }
  const gear = clean.participantRequirements?.gearItems;
  if (Array.isArray(gear) && gear.length > 0) {
    return true;
  }
  return JSON.stringify(clean).length > 2;
}

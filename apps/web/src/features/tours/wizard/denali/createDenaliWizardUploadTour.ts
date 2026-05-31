import type { TourFormProfile } from "@repo/types";

import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import { mapDenaliWizardToCreateTourPayload } from "@/features/tours/wizard/domain/mapDenaliWizardToCreateTourPayload";
import type { CreateTourDto } from "@/lib/services/tours.service";
import { createTour } from "@/lib/services/tours.service";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import type { DenaliRuleSet } from "./rules/denaliRuleModel";
import { prepareDenaliWizardFormForSubmit } from "./validation/denaliRuleAccess";

/** Matches Nest `CreateTourDto` title constraints (`apps/api/.../create-tour.dto.ts`). */
const CREATE_TOUR_TITLE_MIN_LENGTH = 10;

/** Used only when the mapped title is still below the API minimum (early gallery upload). */
const STAGING_TITLE_FALLBACK = "پیش‌نویس — در حال تکمیل ویزارد";

/**
 * Same pipeline as {@link createTourFromWorkspaceWizardForm} (normalize → map → profile strip),
 * without submit validation. Upload shells are always draft tours.
 */
export function buildDenaliWizardUploadTourPayload(input: {
  form: DenaliCreateTourWizardForm;
  ruleSet: DenaliRuleSet;
  workspaceFormProfile: TourFormProfile;
}): CreateTourDto {
  const normalized = prepareDenaliWizardFormForSubmit(input.form, input.ruleSet);
  let dto = mapDenaliWizardToCreateTourPayload(normalized);
  dto = stripCreateTourDtoForFormProfile(input.workspaceFormProfile, dto);

  const title = dto.title.trim();
  return {
    ...dto,
    lifecycle_status: "Draft",
    metadata: { vertical: "staging_shell", isStagingShell: true },
    ...(title.length < CREATE_TOUR_TITLE_MIN_LENGTH ? { title: STAGING_TITLE_FALLBACK } : {}),
  };
}

/**
 * Creates a draft tour shell so gallery uploads can use `POST /api/tours/:tourId/photos`
 * before the wizard submit payload is built.
 */
export async function createDenaliWizardUploadTour(input: {
  form: DenaliCreateTourWizardForm;
  ruleSet: DenaliRuleSet;
  workspaceFormProfile: TourFormProfile;
}): Promise<string> {
  const dto = buildDenaliWizardUploadTourPayload(input);

  const created = await createTour(dto, {
    idempotencyKey:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? `denali-wizard-upload-${crypto.randomUUID()}`
        : `denali-wizard-upload-${Date.now()}`,
  });

  const id = created.id?.trim();
  if (!id) {
    throw new Error("createDenaliWizardUploadTour: API response missing tour id");
  }
  return id;
}

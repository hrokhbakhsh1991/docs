import type { TourFormProfile } from "@repo/types";

import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import { buildDenaliStagingShellProjection } from "@/features/tours/wizard/domain/buildDenaliCreateTourPayloadProjection";
import { mapDenaliCreateTourPayloadProjectionToDto } from "@/features/tours/wizard/domain/mapDenaliWizardToCreateTourPayload";
import type { CreateTourDto } from "@/lib/services/tours.service";
import { createTour } from "@/lib/services/tours.service";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import type { DenaliRuleSet } from "./rules/denaliRuleModel";

/** Matches Nest `CreateTourDto` title constraints (`apps/api/.../create-tour.dto.ts`). */
const CREATE_TOUR_TITLE_MIN_LENGTH = 10;

/** Used only when the mapped title is still below the API minimum (early gallery upload). */
const STAGING_TITLE_FALLBACK = "پیش‌نویس — در حال تکمیل ویزارد";

/**
 * Lean staging projection for gallery upload shells — no submit validation or strict capacity gate.
 * Upload shells are always draft tours with staging metadata.
 */
export function buildDenaliWizardUploadTourPayload(input: {
  form: DenaliCreateTourWizardForm;
  ruleSet: DenaliRuleSet;
  workspaceFormProfile: TourFormProfile;
}): CreateTourDto {
  let dto = mapDenaliCreateTourPayloadProjectionToDto(
    buildDenaliStagingShellProjection(input.form),
  );
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

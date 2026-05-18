import type { TourFormProfile } from "@repo/types";

import { buildTourCreateSchemaForFormProfile } from "@/components/tours/wizard/schemas/tourCreateSchema";
import type { TourCreateFormValues } from "@/components/tours/wizard/schemas/tourCreateSchema";
import type { CreateTourDto } from "@/lib/services/tours.service";
import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import { mapFormValuesToBackendPayload } from "@/features/tours/wizard/domain/mapWizardFormToCreateTourPayload";

export { TOUR_WIZARD_CONTRACT_VERSION } from "./tour-wizard-contract-version";

/**
 * Single source of truth for “wizard JSON → typed form”: Zod **strict** root (unknown keys rejected)
 * plus profile-scoped superRefine rules from {@link buildTourCreateSchemaForFormProfile}.
 */
export function parseTourWizardFormStrict(
  profile: TourFormProfile,
  input: unknown,
): TourCreateFormValues {
  return buildTourCreateSchemaForFormProfile(profile, {
    strictUnknownKeys: true,
    useProfileDerivedValidationFlags: true,
    tourWizardValidationMode: "submit",
  }).parse(input) as TourCreateFormValues;
}

export function safeParseTourWizardFormStrict(profile: TourFormProfile, input: unknown) {
  return buildTourCreateSchemaForFormProfile(profile, {
    strictUnknownKeys: true,
    useProfileDerivedValidationFlags: true,
    tourWizardValidationMode: "submit",
  }).safeParse(input);
}

/**
 * Validates merged wizard JSON after {@link applyTourWizardPatch} (strict keys, profile-aware
 * itinerary/logistics relaxation, no submit-time completeness). Submit still uses {@link parseTourWizardFormStrict}.
 */
export function parseTourWizardPatchPipelineStrict(profile: TourFormProfile, input: unknown): TourCreateFormValues {
  return buildTourCreateSchemaForFormProfile(profile, {
    strictUnknownKeys: true,
    useProfileDerivedValidationFlags: true,
    tourWizardValidationMode: "draft",
  }).parse(input) as TourCreateFormValues;
}

/**
 * Unified seam for submit: **strict validate** wizard-shaped JSON → **CreateTourDto** for the API client.
 */
export function wizardFormToCreateTourApiPayload(
  profile: TourFormProfile,
  input: unknown,
): CreateTourDto {
  const form = parseTourWizardFormStrict(profile, input);
  const dto = mapFormValuesToBackendPayload(form);
  return stripCreateTourDtoForFormProfile(profile, dto);
}

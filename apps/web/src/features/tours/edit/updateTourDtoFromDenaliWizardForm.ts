import type { TourFormProfile, TourLifecycleStatus } from "@repo/types";

import { applyTourThemeOverviewEnrichment } from "@/features/tours/domain/mapCreateTourDto";
import { stripCreateTourDtoForFormProfile } from "@/features/tours/domain/strip-create-tour-dto-for-profile";
import { compactTripDetailsForApi } from "@/features/tours/models/tourTripDetails.schema";
import type { UpdateTourDto } from "@/lib/services/tours.service";
import { mapDenaliWizardToCreateTourPayload } from "@/features/tours/wizard/domain/mapDenaliWizardToCreateTourPayload";
import type { DenaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { denaliRuleSet } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import { prepareDenaliWizardFormForSubmit } from "@/features/tours/wizard/denali/validation/denaliRuleAccess";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

/** Whether the edit PATCH is a draft save or an explicit publish action. */
export type DenaliTourEditPatchIntent = "save" | "publish";

/** Maps Denali wizard form → {@link UpdateTourDto} for PATCH /api/v2/tours/:id. */
export function updateTourDtoFromDenaliWizardForm(
  form: DenaliCreateTourWizardForm,
  options?: {
    themeCatalog?: readonly { id: string; name: string }[];
    formProfile?: TourFormProfile;
    ruleSet?: DenaliRuleSet;
    /**
     * `save` — omit `lifecycle_status` so the backend keeps the current status (e.g. DRAFT).
     * `publish` — set `lifecycle_status` to OPEN.
     */
    patchIntent?: DenaliTourEditPatchIntent;
  },
): UpdateTourDto {
  const normalized = prepareDenaliWizardFormForSubmit(form, options?.ruleSet ?? denaliRuleSet);
  const profile = options?.formProfile ?? "denali_pilot";
  let createDto = mapDenaliWizardToCreateTourPayload(normalized);
  createDto = stripCreateTourDtoForFormProfile(profile, createDto);

  let tripDetails = createDto.tripDetails;
  if (tripDetails && options?.themeCatalog) {
    tripDetails = applyTourThemeOverviewEnrichment(tripDetails, options.themeCatalog);
  }
  const tripDetailsCompact = tripDetails
    ? (compactTripDetailsForApi(tripDetails) as UpdateTourDto["tripDetails"])
    : undefined;

  const communicationLink =
    createDto.communicationLink?.trim() ||
    normalized.basicInfo.socialMediaLink?.trim() ||
    undefined;

  const patchIntent = options?.patchIntent ?? "save";
  const lifecycle_status: TourLifecycleStatus | undefined =
    patchIntent === "publish" ? "OPEN" : undefined;

  return {
    title: createDto.title,
    description: createDto.description,
    capacity: createDto.capacity,
    price: createDto.price,
    requiresPayment: createDto.requiresPayment,
    paymentMode: createDto.paymentMode,
    ...(lifecycle_status != null ? { lifecycle_status } : {}),
    destinationId: createDto.destinationId ?? null,
    communicationLink,
    formProfile: profile,
    tripDetails: tripDetailsCompact,
    autoAcceptRegistrations: createDto.autoAcceptRegistrations,
    transportModes: createDto.transportModes,
    ...(createDto.customServiceLabels && createDto.customServiceLabels.length > 0
      ? { customServiceLabels: [...createDto.customServiceLabels] }
      : {}),
  };
}
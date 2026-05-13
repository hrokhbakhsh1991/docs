import type { TourFormProfile } from "@repo/types";

import type { TourFormValues } from "@/components/tours/tour-schema";
import { apiLifecycleToFormStatus, formLifecycleToApi } from "@/components/tours/tour-lifecycle";
import {
  applyTourThemeOverviewEnrichment,
  injectLocationSectionIntoTripDetails,
  mapCreateTourDto,
} from "@/features/tours/domain/mapCreateTourDto";
import { stripTourFormTripDetailsForFormProfile } from "@/features/tours/domain/stripTourFormTripDetailsForProfile";
import type { TourTripDetails } from "@/features/tours/models/tourTripDetails.schema";
import { compactTripDetailsForApi } from "@/features/tours/models/tourTripDetails.schema";

import type { CreateTourDto, TourDetailDto, UpdateTourDto } from "@/lib/services/tours.service";

/** @deprecated Use {@link apiLifecycleToFormStatus} from `@/components/tours/tour-lifecycle`. */
export const apiLifecycleToUi = apiLifecycleToFormStatus;

export { apiLifecycleToFormStatus, formLifecycleToApi } from "@/components/tours/tour-lifecycle";

/**
 * Maps tour form values → {@link CreateTourDto} for `POST /api/v2/tours`.
 * Create API accepts only Draft or Open → UI `archived` is coerced to Draft.
 */
export function createTourDtoFromTourFormValues(
  values: TourFormValues,
  themeCatalog?: readonly { id: string; name: string }[],
): CreateTourDto {
  const lifecycle_status: CreateTourDto["lifecycle_status"] =
    values.status === "active" ? "Open" : "Draft";
  return mapCreateTourDto(
    {
      title: values.title,
      description: values.description,
      communicationLink: values.communicationLink,
      capacity: values.totalCapacity,
      price: values.price,
      lifecycle_status,
      destinationId: values.destinationId ?? null,
      locationSection: values.locationSection,
      tripDetails: values.tripDetails,
    },
    { themeCatalog },
  );
}

/** Maps edit form → {@link UpdateTourDto}; preserves embedded `cost_context.location` when API returned one. */
export function updateTourDtoFromTourFormValues(
  values: TourFormValues,
  existing: TourDetailDto,
  themeCatalog?: readonly { id: string; name: string; formProfile?: TourFormProfile }[],
  /** Theme-derived profile: strips inactive tripDetails groups before PATCH (parity with create wizard). */
  resolvedFormProfile?: TourFormProfile,
): UpdateTourDto {
  const lifecycle_status = formLifecycleToApi(values.status);
  const existingLoc =
    existing.costContext &&
    typeof existing.costContext === "object" &&
    !Array.isArray(existing.costContext) &&
    typeof (existing.costContext as Record<string, unknown>).location === "string"
      ? String((existing.costContext as Record<string, unknown>).location)
      : undefined;
  let tripDetailsMerged = injectLocationSectionIntoTripDetails(
    values.tripDetails ?? undefined,
    values.locationSection,
  );
  if (resolvedFormProfile != null) {
    tripDetailsMerged =
      stripTourFormTripDetailsForFormProfile(resolvedFormProfile, tripDetailsMerged) ?? tripDetailsMerged;
  }
  const tripDetailsEnriched = applyTourThemeOverviewEnrichment(tripDetailsMerged, themeCatalog);
  const tripDetailsCompact = compactTripDetailsForApi(tripDetailsEnriched) as TourTripDetails | undefined;
  const displayLoc = values.locationSection?.displayLocationOverride?.trim();
  return {
    title: values.title.trim(),
    description: values.description?.trim() ?? "",
    capacity: values.totalCapacity,
    price: values.price,
    lifecycle_status,
    destinationId: values.destinationId ?? null,
    ...(resolvedFormProfile != null ? { formProfile: resolvedFormProfile } : {}),
    ...(displayLoc
      ? { location: displayLoc }
      : existingLoc
        ? { location: existingLoc }
        : {}),
    ...(values.communicationLink?.trim() ? { communicationLink: values.communicationLink.trim() } : {}),
    ...(tripDetailsCompact ? { tripDetails: tripDetailsCompact } : {}),
  };
}

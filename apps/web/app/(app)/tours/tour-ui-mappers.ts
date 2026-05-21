import type { TourFormProfile } from "@repo/types";

import type { TourFormValues } from "@/components/tours/tour-schema";
import { formLifecycleToApi } from "@/components/tours/tour-lifecycle";
import {
  applyTourThemeOverviewEnrichment,
  injectLocationSectionIntoTripDetails,
} from "@/features/tours/domain/mapCreateTourDto";
import { stripTourFormTripDetailsForFormProfile } from "@/features/tours/domain/stripTourFormTripDetailsForProfile";
import type { TourTripDetails } from "@/features/tours/models/tourTripDetails.schema";
import { compactTripDetailsForApi } from "@/features/tours/models/tourTripDetails.schema";

import type { TourDetailDto, UpdateTourDto } from "@/lib/services/tours.service";

export { apiLifecycleToFormStatus, formLifecycleToApi } from "@/components/tours/tour-lifecycle";

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

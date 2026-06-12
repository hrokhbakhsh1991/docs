import type { DestinationResource } from "@/features/settings/settings-module-types";

import { readDenaliDestinationLabel } from "./use-denali-destination-catalog";

export type ItinerarySegmentDestinationSelection = {
  readonly destinationId?: string;
  readonly locationLabel?: string;
};

export function buildItinerarySegmentDestinationSelection(
  destinationId: string | undefined,
  destinationById: ReadonlyMap<string, DestinationResource>
): ItinerarySegmentDestinationSelection {
  if (destinationId == null || destinationId.trim().length === 0) {
    return { destinationId: undefined };
  }
  const trimmed = destinationId.trim();
  return {
    destinationId: trimmed,
    locationLabel: readDenaliDestinationLabel(trimmed, destinationById),
  };
}

import type { DestinationResource } from "../adapters/catalog-types";

export type ItinerarySegmentDestinationSelection = {
  readonly destinationId?: string;
  readonly locationLabel?: string;
};

function readDenaliDestinationLabel(
  destinationId: string | undefined,
  destinationById: ReadonlyMap<string, DestinationResource>
): string | undefined {
  if (destinationId == null || destinationId.trim().length === 0) {
    return undefined;
  }
  const name = destinationById.get(destinationId)?.name?.trim();
  return name != null && name.length > 0 ? name : undefined;
}

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

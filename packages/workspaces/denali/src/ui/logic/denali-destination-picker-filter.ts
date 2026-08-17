import { readDenaliCanonicalBasics } from "../../adapters/denaliCanonicalBasicsControl";
import {
  DENALI_DESTINATION_LOCATION_TYPE_PEAK,
  normalizeDenaliDestinationLocationType,
} from "../../settings/destination-location-types";
import { isDenaliTourKind } from "../../types/legacy/repo-types";

/**
 * ED-DEST-NATURE-01 — nature tour kinds must not offer peak catalog rows.
 * Mountain / desert / event (and unknown slugs) keep the full active catalog.
 */
export function isDenaliNatureTourKind(tourKind: string): boolean {
  const trimmed = tourKind.trim();
  if (!isDenaliTourKind(trimmed)) {
    return false;
  }
  return readDenaliCanonicalBasics(trimmed)?.category === "nature";
}

export function isDenaliDestinationOfferedForTourKind(
  locationType: string | null | undefined,
  tourKind: string
): boolean {
  if (!isDenaliNatureTourKind(tourKind)) {
    return true;
  }
  return normalizeDenaliDestinationLocationType(locationType) !== DENALI_DESTINATION_LOCATION_TYPE_PEAK;
}

/** ED-DEST-REFETCH-01 — count rows offered for the kind (does not keep a selected peak). */
export function countDenaliDestinationsOfferedForTourKind(
  destinations: Iterable<{ readonly locationType: string | null | undefined }>,
  tourKind: string
): number {
  let count = 0;
  for (const destination of destinations) {
    if (isDenaliDestinationOfferedForTourKind(destination.locationType, tourKind)) {
      count += 1;
    }
  }
  return count;
}

export function filterDenaliDestinationPickerOptions<T extends { readonly value: string }>(input: {
  readonly options: readonly T[];
  readonly destinationById: ReadonlyMap<string, { readonly locationType: string | null }>;
  readonly tourKind: string;
  readonly selectedDestinationId?: string;
}): T[] {
  const selected = input.selectedDestinationId?.trim() ?? "";
  return input.options.filter((option) => {
    if (selected.length > 0 && option.value === selected) {
      return true;
    }
    const destination = input.destinationById.get(option.value);
    return isDenaliDestinationOfferedForTourKind(destination?.locationType, input.tourKind);
  });
}

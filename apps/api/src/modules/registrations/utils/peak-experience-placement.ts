import type { TourTripDetails } from "../../tours/types/tour-trip-details.types";

export type ParticipantMetadataIntake = {
  userPastPeaksCount?: number;
};

const MIN_PEAKS_RANGE = { min: 1, max: 4 } as const;

export function readTourMinRequiredPeaks(
  tripDetails: TourTripDetails | Record<string, unknown> | null | undefined,
): number | undefined {
  if (tripDetails == null || typeof tripDetails !== "object" || Array.isArray(tripDetails)) {
    return undefined;
  }
  const requirements = (tripDetails as Record<string, unknown>).requirements;
  if (requirements == null || typeof requirements !== "object" || Array.isArray(requirements)) {
    return undefined;
  }
  const raw = (requirements as Record<string, unknown>).minRequiredPeaks;
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    return undefined;
  }
  if (raw < MIN_PEAKS_RANGE.min || raw > MIN_PEAKS_RANGE.max) {
    return undefined;
  }
  return raw;
}

export function readUserPastPeaksCount(
  metadata: ParticipantMetadataIntake | null | undefined,
): number | undefined {
  const raw = metadata?.userPastPeaksCount;
  if (typeof raw !== "number" || !Number.isInteger(raw)) {
    return undefined;
  }
  if (raw < 0 || raw > MIN_PEAKS_RANGE.max) {
    return undefined;
  }
  return raw;
}

/**
 * Peak-Experience auto-approval (Phase 16.9): traveler past peaks meet tour minimum → skip Pending.
 */
export function qualifiesForPeakExperienceAutoApproval(input: {
  tripDetails: TourTripDetails | Record<string, unknown> | null | undefined;
  participantMetadata?: ParticipantMetadataIntake | null;
}): boolean {
  const minRequired = readTourMinRequiredPeaks(input.tripDetails);
  const userPeaks = readUserPastPeaksCount(input.participantMetadata);
  if (minRequired == null || userPeaks == null) {
    return false;
  }
  return userPeaks >= minRequired;
}

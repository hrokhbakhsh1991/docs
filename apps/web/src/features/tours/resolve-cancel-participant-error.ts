export const CANCEL_PARTICIPANT_DONG_RIDER_ERROR_KEY =
  "cancelParticipantDongRiderReassignmentRequired" as const;

export function resolveCancelParticipantErrorKey(
  code: string
): typeof CANCEL_PARTICIPANT_DONG_RIDER_ERROR_KEY | null {
  return code === "BOOKING_DONG_SEAT_REASSIGNMENT_REQUIRED"
    ? CANCEL_PARTICIPANT_DONG_RIDER_ERROR_KEY
    : null;
}

/**
 * Sanitized facts passed from booking persistence to workspace capacity policy.
 * This stays in the booking domain so repository ports do not depend on HTTP
 * contracts merely to describe an in-transaction capacity snapshot.
 */
export type BookingApprovedCapacitySnapshot = {
  readonly partySize: number;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
};

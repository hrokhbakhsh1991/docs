/**
 * Booking lifecycle event capability (Phase B1.7).
 * Workspace owns approve outbox event type + optional post-approve hooks.
 * Host owns outbox persistence, approve TX, and relay.
 */
export type BookingApproveReactionInput = {
  readonly tenantId: string;
  readonly bookingId: string;
  readonly outboxEventType: string;
};

/**
 * Capability port — implemented by workspace adapters via `workspaceBooking.eventReaction`.
 */
export type WorkspaceBookingEventReactionPort = {
  /** Outbox `eventType` for approve / bulkApprove (canonical: `registration.approved`). */
  readonly approveOutboxEventType: string;
  /**
   * Optional post-approve hook after host persists the outbox row.
   * B1.7 adapters are no-ops; host may invoke in a later phase.
   */
  reactAfterApprove?(input: BookingApproveReactionInput): Promise<void>;
};

/** Canonical approve outbox event type — frozen with domainEventId formula until product YES. */
export const BOOKING_APPROVE_OUTBOX_EVENT_TYPE = "registration.approved" as const;

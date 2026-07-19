/**
 * Booking lifecycle event capability (Phase B1.7).
 *
 * Ownership:
 * - Booking application decides WHEN (after approve / bulkApprove TX commits).
 * - Workspace adapter decides WHAT (`reactAfterApprove` side effect).
 * - Host owns outbox persistence, approve TX, and relay (unchanged).
 *
 * Delivery honesty (see BOOKING_APPROVE_REACTION_DELIVERY / booking-approve-delivery.ts):
 * - Outbox `registration.approved` = durable domain fact (relay at-least-once).
 * - `reactAfterApprove` = in-process best-effort callback only — not durable,
 *   not exactly-once, not invoked on outbox relay/replay or process restart.
 */
export type BookingApproveReactionInput = {
  readonly tenantId: string;
  readonly bookingId: string;
  readonly outboxEventType: string;
};

/**
 * Capability port — implemented by workspace adapters via `workspaceBooking.eventReaction`.
 *
 * Consumers of this port receive an **in-process callback**, not the durable outbox.
 * Durable subscribers must consume host outbox / relay, not this hook.
 */
export type WorkspaceBookingEventReactionPort = {
  /** Discriminator for proofs / diagnostics (workspace-owned). */
  readonly kind: string;
  /** Outbox `eventType` for approve / bulkApprove (canonical: `registration.approved`). */
  readonly approveOutboxEventType: string;
  /**
   * Post-approve reaction after host persists status + outbox in one TX.
   *
   * Delivery: **best-effort in-process** after commit.
   * - Must be idempotent for the same `bookingId` (no duplicate side effects).
   * - Must not enqueue a second outbox row or redefine event infrastructure.
   * - Must not assume exactly-once or durability across process restart.
   * - Will **not** be called when host replays a failed outbox row.
   */
  reactAfterApprove(input: BookingApproveReactionInput): Promise<void>;
};

/** Canonical approve outbox event type — frozen with domainEventId formula until product YES. */
export const BOOKING_APPROVE_OUTBOX_EVENT_TYPE = "registration.approved" as const;

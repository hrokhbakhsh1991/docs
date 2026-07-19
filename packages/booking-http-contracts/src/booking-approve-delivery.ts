/**
 * Booking approve delivery guarantees — honest runtime contract.
 *
 * Two channels after approve (architecture unchanged):
 * 1) Durable outbox `registration.approved` (host TX + relay)
 * 2) In-process `reactAfterApprove` (best-effort; not on outbox replay)
 *
 * @see docs/phase-20/p7/appendices/BOOKING_APPROVE_REACTION_DELIVERY.md
 */
import { BOOKING_APPROVE_OUTBOX_EVENT_TYPE } from "./booking-event-reaction.port";

/** Durable outbox channel for approve domain fact. */
export const BOOKING_APPROVE_OUTBOX_DELIVERY = {
  channel: "durable-outbox",
  eventType: BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
  durability: "durable",
  /** Unique `(tenant_id, domain_event_id)` — duplicate insert is a no-op. */
  writeSemantics: "at-most-once-insert",
  /** Host outbox relay may publish more than once to downstream consumers. */
  consumerDelivery: "at-least-once",
  exactlyOnce: false,
  survivesProcessRestart: true,
  owner: "host-repository-and-relay",
} as const;

export type BookingApproveOutboxDelivery = typeof BOOKING_APPROVE_OUTBOX_DELIVERY;

/**
 * In-process workspace reaction after approve TX commits.
 * Not durable; not re-run on outbox relay / admin replay / process restart.
 */
export const BOOKING_APPROVE_REACTION_DELIVERY = {
  channel: "in-process-callback",
  hook: "reactAfterApprove",
  durability: "not-durable",
  delivery: "best-effort",
  exactlyOnce: false,
  survivesProcessRestart: false,
  triggeredByOutboxRelay: false,
  triggeredByOutboxReplay: false,
  /** Adapters must no-op duplicate calls for the same bookingId (process-local). */
  idempotencyExpectation: "adapter-must-be-idempotent",
  whenOwner: "booking-application",
  whatOwner: "workspace-adapter",
} as const;

export type BookingApproveReactionDelivery = typeof BOOKING_APPROVE_REACTION_DELIVERY;

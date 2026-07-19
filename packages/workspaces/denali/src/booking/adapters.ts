/**
 * Denali Booking capability registration adapters (Phase B1.1 + B1.7 eventReaction).
 *
 * Registration tokens only — no capacity / validation / public-booking / ops behavior
 * (except eventReaction owns approve outbox event type).
 * Runtime owners remain Denali registration.service + host product HTTP until later phases
 * wire `resolveBookingWorkspaceDependencies` into composition.
 */

import {
  BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
  type BookingApproveReactionInput,
  type WorkspaceBookingEventReactionPort,
} from "@app-tour/booking-http-contracts";

/** Public booking capability registration (host owns BookingPublicPort wiring). */
export class DenaliBookingPublicAdapter {
  readonly kind = "denali-booking-public" as const;
}

/** Capacity policy registration (capacity math stays outside BookingsService). */
export class DenaliBookingCapacityPolicyAdapter {
  readonly kind = "denali-booking-capacity-policy" as const;
}

/** Validation policy registration (intake validation stays in Denali registration). */
export class DenaliBookingValidationPolicyAdapter {
  readonly kind = "denali-booking-validation-policy" as const;
}

/** Ops capability registration (ops UI / manifests land in B1.6). */
export class DenaliBookingOpsCapabilityAdapter {
  readonly kind = "denali-booking-ops-capability" as const;
}

/**
 * Booking lifecycle event capability (Phase B1.7).
 * Owns approve outbox event type; host keeps enqueue / TX / relay.
 */
export class DenaliBookingEventReactionAdapter implements WorkspaceBookingEventReactionPort {
  readonly kind = "denali-booking-event-reaction" as const;
  readonly approveOutboxEventType = BOOKING_APPROVE_OUTBOX_EVENT_TYPE;

  async reactAfterApprove(_input: BookingApproveReactionInput): Promise<void> {
    /* no-op — post-approve side effects stay host/Finance until a later phase */
  }
}

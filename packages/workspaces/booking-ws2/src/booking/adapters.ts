/**
 * Booking-ws2 registration adapters (Phase B1.3 + B1.7 eventReaction).
 * Distinct kinds from Denali — no capacity/validation/HTTP behavior.
 */

import {
  BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
  type BookingApproveReactionInput,
  type WorkspaceBookingEventReactionPort,
} from "@app-tour/booking-http-contracts";

export class BookingWs2PublicAdapter {
  readonly kind = "booking-ws2-public" as const;
}

export class BookingWs2CapacityPolicyAdapter {
  readonly kind = "booking-ws2-capacity-policy" as const;
}

export class BookingWs2ValidationPolicyAdapter {
  readonly kind = "booking-ws2-validation-policy" as const;
}

export class BookingWs2OpsCapabilityAdapter {
  readonly kind = "booking-ws2-ops-capability" as const;
}

/**
 * Independent event-reaction fixture (Phase B1.7).
 * Same stable approve outbox event type as Denali — distinct adapter class for registry proof.
 */
export class BookingWs2EventReactionAdapter implements WorkspaceBookingEventReactionPort {
  readonly kind = "booking-ws2-event-reaction" as const;
  readonly approveOutboxEventType = BOOKING_APPROVE_OUTBOX_EVENT_TYPE;

  async reactAfterApprove(_input: BookingApproveReactionInput): Promise<void> {
    /* fixture no-op */
  }
}

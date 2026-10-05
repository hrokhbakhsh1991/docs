/**
 * Booking-ws2 adapters — shared capacity/shape + workspace CASE_A marker.
 */

import {
  BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
  BOOKING_POLICY_CASE_A_GUEST_LABEL,
  assertBookingBaseCreateShape,
  assertBookingStandardCapacity,
  type BookingApproveReactionInput,
  type BookingCapacityPolicyPort,
  type BookingCreatePolicyContext,
  type BookingPublicCapabilityPort,
  type BookingValidationPolicyPort,
  type WorkspaceBookingEventReactionPort,
} from "@app-tour/booking-http-contracts";

function assertBookingWs2CaseAAllowed(ctx: BookingCreatePolicyContext): void {
  if (ctx.guestLabel.trim() === BOOKING_POLICY_CASE_A_GUEST_LABEL) {
    throw new Error(
      `BOOKING_CAPACITY_REJECTED: workspace=booking-ws2 rejects guestLabel=${BOOKING_POLICY_CASE_A_GUEST_LABEL}`
    );
  }
}

export class BookingWs2PublicAdapter implements BookingPublicCapabilityPort {
  readonly kind = "booking-ws2-public" as const;

  supportsPublicCreate(): boolean {
    return true;
  }
}

export class BookingWs2CapacityPolicyAdapter implements BookingCapacityPolicyPort {
  readonly kind = "booking-ws2-capacity-policy" as const;

  assertCreateCapacity(ctx: BookingCreatePolicyContext): void {
    assertBookingWs2CaseAAllowed(ctx);
    assertBookingStandardCapacity(ctx);
  }
}

export class BookingWs2ValidationPolicyAdapter implements BookingValidationPolicyPort {
  readonly kind = "booking-ws2-validation-policy" as const;

  assertCreateValid(ctx: BookingCreatePolicyContext): void {
    // Operator-created pending records defer occupancy checks until approval,
    // but workspace-specific policy markers must never be bypassable by that
    // deferred-capacity path.
    assertBookingWs2CaseAAllowed(ctx);
    assertBookingBaseCreateShape(ctx);
  }
}

/** In-process approve ack — no durable side effects (outbox is host-owned). */
export class BookingWs2EventReactionAdapter implements WorkspaceBookingEventReactionPort {
  readonly kind = "booking-ws2-event-reaction" as const;
  readonly approveOutboxEventType = BOOKING_APPROVE_OUTBOX_EVENT_TYPE;

  async reactAfterApprove(_input: BookingApproveReactionInput): Promise<void> {
    // Capability mode=none — hook retained for DI; BookingsService does not invoke it.
  }
}

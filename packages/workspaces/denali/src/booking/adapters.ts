/**
 * Denali Booking capability adapters — executable validation + capacity.
 */

import {
  BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
  assertBookingBaseCreateShape,
  assertBookingStandardCapacity,
  type BookingApproveReactionInput,
  type BookingCapacityPolicyPort,
  type BookingCreatePolicyContext,
  type BookingPublicCapabilityPort,
  type BookingValidationPolicyPort,
  type WorkspaceBookingEventReactionPort,
} from "@app-tour/booking-http-contracts";

export class DenaliBookingPublicAdapter implements BookingPublicCapabilityPort {
  readonly kind = "denali-booking-public" as const;

  supportsPublicCreate(): boolean {
    return true;
  }
}

export class DenaliBookingCapacityPolicyAdapter implements BookingCapacityPolicyPort {
  readonly kind = "denali-booking-capacity-policy" as const;

  assertCreateCapacity(ctx: BookingCreatePolicyContext): void {
    assertBookingStandardCapacity(ctx);
  }
}

export class DenaliBookingValidationPolicyAdapter implements BookingValidationPolicyPort {
  readonly kind = "denali-booking-validation-policy" as const;

  assertCreateValid(ctx: BookingCreatePolicyContext): void {
    assertBookingBaseCreateShape(ctx);
  }
}

/** In-process approve ack — no durable side effects (outbox is host-owned). */
export class DenaliBookingEventReactionAdapter implements WorkspaceBookingEventReactionPort {
  readonly kind = "denali-booking-event-reaction" as const;
  readonly approveOutboxEventType = BOOKING_APPROVE_OUTBOX_EVENT_TYPE;

  async reactAfterApprove(_input: BookingApproveReactionInput): Promise<void> {
    // Intentionally empty — durable fact is outbox `registration.approved`.
  }
}

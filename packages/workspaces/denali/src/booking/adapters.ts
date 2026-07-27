/**
 * Denali Booking capability adapters — HTTP contract ports over Denali domain policy.
 */

import {
  BOOKING_APPROVE_OUTBOX_EVENT_TYPE,
  type BookingApproveReactionInput,
  type BookingCapacityPolicyPort,
  type BookingCreatePolicyContext,
  type BookingPublicCapabilityPort,
  type BookingValidationPolicyPort,
  type WorkspaceBookingEventReactionPort,
} from "@app-cloud/booking-http-contracts";

import { assertDenaliCreateCapacity } from "./availability";
import { DEFAULT_DENALI_CAPACITY_RULE } from "./capacity-rule";
import { assertDenaliCreateValid } from "./validation";

export class DenaliBookingPublicAdapter implements BookingPublicCapabilityPort {
  readonly kind = "denali-booking-public" as const;

  supportsPublicCreate(): boolean {
    return true;
  }
}

export class DenaliBookingCapacityPolicyAdapter implements BookingCapacityPolicyPort {
  readonly kind = "denali-booking-capacity-policy" as const;

  assertCreateCapacity(ctx: BookingCreatePolicyContext): void {
    assertDenaliCreateCapacity(ctx, DEFAULT_DENALI_CAPACITY_RULE);
  }
}

export class DenaliBookingValidationPolicyAdapter implements BookingValidationPolicyPort {
  readonly kind = "denali-booking-validation-policy" as const;

  assertCreateValid(ctx: BookingCreatePolicyContext): void {
    assertDenaliCreateValid(ctx, DEFAULT_DENALI_CAPACITY_RULE);
  }
}

/** Durable approve fact is host outbox — in-process reaction not claimed (Option A). */
export class DenaliBookingEventReactionAdapter implements WorkspaceBookingEventReactionPort {
  readonly kind = "denali-booking-event-reaction" as const;
  readonly approveOutboxEventType = BOOKING_APPROVE_OUTBOX_EVENT_TYPE;

  async reactAfterApprove(_input: BookingApproveReactionInput): Promise<void> {
    // Capability mode=none — hook retained for DI; BookingsService does not invoke it.
  }
}

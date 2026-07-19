/**
 * Map composition-validated graded matrix → application capability contract.
 * Keeps generated types out of BookingsService.
 */
import type { BookingWorkspaceCapabilities } from "./workspace-booking-capabilities.generated";
import type { BookingRuntimeCapabilities } from "./ports/booking-runtime-capabilities.port";

export function toBookingRuntimeCapabilities(
  caps: BookingWorkspaceCapabilities
): BookingRuntimeCapabilities {
  return {
    publicCreate: {
      enabled: caps.publicCreate.enabled,
      mode: caps.publicCreate.mode,
    },
    operatorCreate: {
      enabled: caps.operatorCreate.enabled,
      mode: caps.operatorCreate.mode,
    },
    capacity: {
      enabled: caps.capacity.enabled,
      mode: caps.capacity.mode,
    },
    validation: {
      enabled: caps.validation.enabled,
      mode: caps.validation.mode,
    },
    approval: {
      enabled: caps.approval.enabled,
      mode: caps.approval.mode,
    },
    eventReaction: {
      enabled: caps.eventReaction.enabled,
      mode: caps.eventReaction.mode,
    },
  };
}

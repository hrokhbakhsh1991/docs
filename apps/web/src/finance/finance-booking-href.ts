import { buildBookingsDetailDeepLinkHref } from "@/features/bookings/bookings-command-center-logic";

/**
 * Phase A — finance rows use registrationId as booking id (verified in FinanceService).
 * Deep-links into Bookings Command Center inspection (`?bookingId=`).
 */
export function financeBookingHref(registrationId: string): string {
  return buildBookingsDetailDeepLinkHref(registrationId);
}

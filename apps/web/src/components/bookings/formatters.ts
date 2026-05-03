import type { BookingDto } from "@repo/types";

/** Plain-text label aligned with list badges (`RegistrationResponseDto.status`). */
export function formatBookingStatus(booking: BookingDto): string {
  const s = booking.status;
  if (s === "Accepted" || s === "AcceptedPaid") return "Confirmed";
  return s;
}

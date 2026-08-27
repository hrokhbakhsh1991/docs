import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";

type BookingPaymentDisplayInput = Pick<BookingListItem, "paymentStatus" | "financialDisplayState">;

export function bookingPaymentLabelKey(item: BookingPaymentDisplayInput) {
  return item.financialDisplayState === "WAIVED"
    ? "payment.waived"
    : (`payment.${item.paymentStatus}` as const);
}

export function bookingTimelinePaymentLabelKey(item: BookingPaymentDisplayInput) {
  return item.financialDisplayState === "WAIVED"
    ? "paymentValue.waived"
    : (`paymentValue.${item.paymentStatus}` as const);
}

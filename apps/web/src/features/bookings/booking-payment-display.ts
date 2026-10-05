import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";

type BookingPaymentDisplayInput = Pick<BookingListItem, "paymentStatus" | "financialDisplayState"> &
  Partial<Pick<BookingListItem, "finalizationStatus" | "status">>;

function isTerminalBooking(item: BookingPaymentDisplayInput): boolean {
  return item.status === "cancelled" || item.status === "rejected";
}

export function bookingPaymentLabelKey(item: BookingPaymentDisplayInput) {
  return item.financialDisplayState === "WAIVED"
    ? "payment.waived"
    : isTerminalBooking(item)
      ? "payment.cancelled"
      : item.paymentStatus === "paid" && item.finalizationStatus !== "finalized"
        ? "payment.paidAwaitingFinalization"
        : (`payment.${item.paymentStatus}` as const);
}

export function bookingTimelinePaymentLabelKey(item: BookingPaymentDisplayInput) {
  return item.financialDisplayState === "WAIVED"
    ? "paymentValue.waived"
    : isTerminalBooking(item)
      ? "paymentValue.cancelled"
      : item.paymentStatus === "paid" && item.finalizationStatus !== "finalized"
        ? "paymentValue.paidAwaitingFinalization"
        : (`paymentValue.${item.paymentStatus}` as const);
}

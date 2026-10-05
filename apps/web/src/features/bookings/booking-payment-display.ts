import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";

type BookingPaymentDisplayInput = Pick<BookingListItem, "paymentStatus" | "financialDisplayState"> &
  Partial<Pick<BookingListItem, "finalizationStatus">>;

export function bookingPaymentLabelKey(item: BookingPaymentDisplayInput) {
  return item.financialDisplayState === "WAIVED"
    ? "payment.waived"
    : item.paymentStatus === "paid" && item.finalizationStatus !== "finalized"
      ? "payment.paidAwaitingFinalization"
      : (`payment.${item.paymentStatus}` as const);
}

export function bookingTimelinePaymentLabelKey(item: BookingPaymentDisplayInput) {
  return item.financialDisplayState === "WAIVED"
    ? "paymentValue.waived"
    : item.paymentStatus === "paid" && item.finalizationStatus !== "finalized"
      ? "paymentValue.paidAwaitingFinalization"
      : (`paymentValue.${item.paymentStatus}` as const);
}

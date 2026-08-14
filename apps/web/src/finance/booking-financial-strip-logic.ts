import {
  isFinancePaymentPaidStatus,
  isFinancePaymentPendingStatus,
  type FinancePaymentRow,
} from "@/finance/finance-payments-logic";
import { withFinanceRegistrationQuery } from "@/finance/finance-registration-context";

/** Booking obligation settlement (not payment-row status). */
export type StripBookingPaymentStatus = "unpaid" | "partial" | "paid";

/**
 * Single strip-level settlement summary (not per payment row).
 * Distinguishes payment recorded vs booking settlement.
 */
export type StripBookingSettlementSummary =
  | "booking_paid"
  | "booking_partial_recorded"
  | "booking_partial_pending"
  | "booking_unpaid_pending"
  | "booking_unpaid"
  | "booking_partial";

export type StripNextStepTab = "payments" | "receipts";

export type StripNextStepReason =
  | "pending_payment"
  | "pending_receipt"
  | "remaining_balance"
  | "pending_payment_with_receipt";

export type StripNextStepPlan = {
  readonly tab: StripNextStepTab;
  readonly href: string;
  readonly reason: StripNextStepReason;
};

export const BOOKING_FINANCIAL_STRIP_TEST_IDS = {
  strip: "booking-financial-strip",
  settlementBridge: "booking-financial-strip-settlement-bridge",
  nextStep: "operator-bookings-next-step-receipt",
  openPayments: "booking-financial-strip-open-payments",
  latestPaymentsTitle: "booking-financial-strip-latest-title",
  /** PR22-B — secondary text nav (not primary CTA). */
  secondaryNav: "booking-financial-strip-secondary-nav",
  /** PR22-B — Meaning tertiary / read-only. */
  tertiaryMeaning: "booking-strip-commercial-meaning-link",
  /** PR22-B — settled booking read-only banner (no action CTA). */
  settledReadOnly: "booking-financial-strip-settled-readonly",
} as const;

export function hasOpenPendingManualPayment(
  items: ReadonlyArray<Pick<FinancePaymentRow, "status">>
): boolean {
  return items.some((row) => isFinancePaymentPendingStatus(row.status));
}

export function hasRecordedManualPayment(
  items: ReadonlyArray<Pick<FinancePaymentRow, "status">>
): boolean {
  return items.some((row) => isFinancePaymentPaidStatus(row.status));
}

/** True when invoice balanceDueMinor is a positive integer minor amount. */
export function hasInvoiceRemainingBalance(
  balanceDueMinor: string | null | undefined
): boolean {
  if (balanceDueMinor === null || balanceDueMinor === undefined) {
    return false;
  }
  const trimmed = balanceDueMinor.trim();
  if (!/^\d+$/.test(trimmed)) {
    return false;
  }
  return BigInt(trimmed) > BigInt(0);
}

/**
 * One booking-level settlement line for the strip.
 * Never maps a payment Paid badge to “booking paid”.
 */
export function resolveStripBookingSettlementSummary(input: {
  readonly bookingPaymentStatus: StripBookingPaymentStatus | null | undefined;
  readonly items: ReadonlyArray<Pick<FinancePaymentRow, "status">>;
}): StripBookingSettlementSummary | null {
  const booking = input.bookingPaymentStatus ?? null;
  if (booking === null) {
    return null;
  }
  const pending = hasOpenPendingManualPayment(input.items);
  const recorded = hasRecordedManualPayment(input.items);
  if (booking === "paid") {
    return "booking_paid";
  }
  if (booking === "partial") {
    if (recorded) {
      return "booking_partial_recorded";
    }
    if (pending) {
      return "booking_partial_pending";
    }
    return "booking_partial";
  }
  if (booking === "unpaid") {
    if (pending) {
      return "booking_unpaid_pending";
    }
    return "booking_unpaid";
  }
  return null;
}

/**
 * PR22-A — Booking strip next Finance surface (approved bookings only).
 *
 * Order:
 * 1. fully settled (paid) → none
 * 2. pending payment → Payments
 * 3. pending receipt → Receipts
 * 4. remaining balance > 0 → Payments
 * 5. otherwise → none
 */
export function resolveStripNextStep(input: {
  readonly bookingStatus: string;
  readonly bookingPaymentStatus: StripBookingPaymentStatus;
  readonly hasOpenPendingPayment: boolean;
  readonly hasPendingReceipt: boolean;
  readonly hasRemainingBalance: boolean;
  readonly registrationId: string;
}): StripNextStepPlan | null {
  if (input.bookingStatus.trim().toLowerCase() !== "approved") {
    return null;
  }
  if (input.bookingPaymentStatus === "paid") {
    return null;
  }
  if (input.bookingPaymentStatus !== "unpaid" && input.bookingPaymentStatus !== "partial") {
    return null;
  }

  if (input.hasOpenPendingPayment) {
    const reason: StripNextStepReason =
      input.hasPendingReceipt ? "pending_payment_with_receipt" : "pending_payment";
    return {
      tab: "payments",
      reason,
      href: withFinanceRegistrationQuery("/finance?tab=payments", input.registrationId),
    };
  }
  if (input.hasPendingReceipt) {
    return {
      tab: "receipts",
      reason: "pending_receipt",
      href: withFinanceRegistrationQuery("/finance?tab=receipts", input.registrationId),
    };
  }
  if (input.hasRemainingBalance) {
    return {
      tab: "payments",
      reason: "remaining_balance",
      href: withFinanceRegistrationQuery("/finance?tab=payments", input.registrationId),
    };
  }
  return null;
}

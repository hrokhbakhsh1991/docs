"use client";

import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";
import type { BadgeVariant } from "@tour/ui";
import { Badge } from "@tour/ui";

function bookingStatusVariant(status: RegistrationStatus): BadgeVariant {
  switch (status) {
    case "Accepted":
    case "AcceptedPaid":
      return "success";
    case "Cancelled":
    case "Rejected":
      return "danger";
    case "Refunded":
      return "info";
    default:
      return "neutral";
  }
}

/** Product-facing copy while enums stay API-aligned (`RegistrationResponseDto.status`). */
export function bookingStatusLabel(status: RegistrationStatus): string {
  switch (status) {
    case "Accepted":
    case "AcceptedPaid":
      return "Confirmed";
    default:
      return status;
  }
}

function paymentVariant(payment: RegistrationPaymentStatus): BadgeVariant {
  switch (payment) {
    case "Paid":
      return "success";
    case "Partial":
      return "info";
    default:
      return "warning";
  }
}

export function paymentStatusLabel(payment: RegistrationPaymentStatus): string {
  return payment === "NotPaid" ? "Unpaid" : payment;
}

export function BookingStatusBadge({ status }: { status: RegistrationStatus }) {
  return (
    <Badge variant={bookingStatusVariant(status)}>{bookingStatusLabel(status)}</Badge>
  );
}

export function PaymentStatusBadge({ payment }: { payment: RegistrationPaymentStatus }) {
  return (
    <Badge variant={paymentVariant(payment)}>{paymentStatusLabel(payment)}</Badge>
  );
}

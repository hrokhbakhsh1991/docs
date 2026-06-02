"use client";

import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";
import type { BadgeVariant } from "@tour/ui";
import { Badge } from "@tour/ui";

import "@/styles/shared/badges.css";

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

export function bookingStatusLabel(status: RegistrationStatus): string {
  switch (status) {
    case "Accepted":
    case "AcceptedPaid":
      return "Confirmed";
    default:
      return status;
  }
}

function paymentVariant(payment: string): BadgeVariant {
  switch (payment) {
    case "Paid":
      return "success";
    case "Partial":
      return "info";
    case "Failed":
      return "danger";
    case "Refunded":
      return "neutral";
    case "NotPaid":
      return "warning";
    default:
      return "neutral";
  }
}

export function paymentStatusLabel(payment: string): string {
  if (payment === "NotPaid") return "Unpaid";
  return payment;
}

export function BookingStatusBadge({ status }: { status: RegistrationStatus }) {
  return (
    <Badge className="shared-booking-badge" variant={bookingStatusVariant(status)}>
      {bookingStatusLabel(status)}
    </Badge>
  );
}

export function PaymentStatusBadge({ payment }: { payment: RegistrationPaymentStatus | string }) {
  const raw = typeof payment === "string" ? payment : String(payment);
  return (
    <Badge className="shared-booking-badge" variant={paymentVariant(raw)}>
      {paymentStatusLabel(raw)}
    </Badge>
  );
}


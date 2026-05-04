import type { TourLifecycleStatus } from "@repo/types";
import type { RegistrationPaymentStatus, RegistrationStatus } from "@repo/types";

export const STATUS_OPTIONS: RegistrationStatus[] = [
  "Pending",
  "Accepted",
  "AcceptedPaid",
  "Rejected",
  "Cancelled",
  "NoShow",
  "Refunded",
];

export const PAYMENT_OPTIONS: RegistrationPaymentStatus[] = ["NotPaid", "Partial", "Paid"];

export function isTourReadOnlyForWorkspace(status: TourLifecycleStatus): boolean {
  return status === "CLOSED" || status === "CANCELLED";
}

export function workspaceReadOnlyBannerText(status: TourLifecycleStatus): string {
  if (status === "CANCELLED") {
    return "This tour is cancelled and its registrations are read-only.";
  }
  return "This tour is closed and its registrations are read-only.";
}

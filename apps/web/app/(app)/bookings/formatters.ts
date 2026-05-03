import type { BookingDto } from "@repo/types";

const TERMINAL_FOR_POLL: BookingDto["status"][] = ["Rejected", "Cancelled", "Refunded"];

/**
 * When registration is awaiting review or payment may change asynchronously,
 * poll the detail endpoint (`GET /api/v2/registrations/{id}`).
 * Returns milliseconds, or `false` to pause polling.
 */
export function registrationPollIntervalMs(data: BookingDto | undefined): number | false {
  if (!data) return 15_000;
  if (data.status === "Pending") return 15_000;
  if (TERMINAL_FOR_POLL.includes(data.status)) return false;
  if (data.paymentStatus === "NotPaid" || data.paymentStatus === "Partial") return 20_000;
  return false;
}

/** Human labels for OpenAPI registration enums (`RegistrationResponseDto`). */
export function formatTransportMode(mode: BookingDto["transportMode"]): string {
  switch (mode) {
    case "self_vehicle":
      return "Self vehicle";
    case "group_vehicle":
      return "Group vehicle";
    case "other":
      return "Other";
    default:
      return mode;
  }
}

export function formatRegistrationEntryMode(mode: BookingDto["entryMode"]): string {
  return mode === "telegram" ? "Telegram" : "Web";
}

export function formatRegistrationInstant(iso: string): string {
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

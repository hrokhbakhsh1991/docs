/**
 * Booking HTTP request parsers — bit-identical to prior bookings.routes helpers.
 * No Zod: preserve exact null/empty semantics of the hand parsers.
 */
import { BOOKING_PAYMENT_STATUSES, BOOKING_STATUSES, type BookingStatus } from "./booking-status";
import type {
  BookingMemberReceiptJsonBody,
  BookingsListQuery,
  BookingsListSort,
  BookingsSummaryQuery,
  CreateBookingRequest,
} from "./booking-http-types";

export function readBookingStringField(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

export function readBookingNumberField(body: unknown, key: string): number {
  if (typeof body !== "object" || body === null) return 0;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Parse list `status` query — single token or comma-separated IN set (UX-BKG-43a).
 * Unknown / empty tokens → no status filter (same as prior unknown single).
 */
export function parseBookingsListStatusParam(
  statusRaw: string | null
): Pick<BookingsListQuery, "status" | "statuses"> {
  if (statusRaw === null) {
    return {};
  }
  const trimmed = statusRaw.trim();
  if (trimmed.length === 0) {
    return {};
  }
  const parts = trimmed.split(",").map((part) => part.trim());
  if (parts.some((part) => part.length === 0)) {
    return {};
  }
  const resolved: BookingStatus[] = [];
  for (const part of parts) {
    const match = BOOKING_STATUSES.find((value) => value === part);
    if (match === undefined) {
      return {};
    }
    if (!resolved.includes(match)) {
      resolved.push(match);
    }
  }
  if (resolved.length === 0) {
    return {};
  }
  const statuses = BOOKING_STATUSES.filter((value) => resolved.includes(value));
  if (statuses.length === 1) {
    return { status: statuses[0], statuses };
  }
  return { statuses };
}

/** Parse GET /bookings query string (URL search params). */
export function parseBookingsListQuery(url: URL): BookingsListQuery {
  const viewRaw = url.searchParams.get("view");
  const view = viewRaw === "mine" ? "mine" : "ops";
  const statusFields = parseBookingsListStatusParam(url.searchParams.get("status"));
  const tourId = url.searchParams.get("tourId")?.trim();
  const paymentStatusRaw = url.searchParams.get("paymentStatus");
  const paymentStatus = BOOKING_PAYMENT_STATUSES.find((value) => value === paymentStatusRaw);
  const q = url.searchParams.get("q")?.trim();
  const cursor = url.searchParams.get("cursor")?.trim();
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const departureWithinDaysRaw = Number(url.searchParams.get("departureWithinDays") ?? "");
  const departureWithinDays =
    Number.isFinite(departureWithinDaysRaw) &&
    departureWithinDaysRaw >= 1 &&
    departureWithinDaysRaw <= 30
      ? Math.floor(departureWithinDaysRaw)
      : undefined;
  const approvedWithinDaysRaw = Number(url.searchParams.get("approvedWithinDays") ?? "");
  const approvedWithinDays =
    Number.isFinite(approvedWithinDaysRaw) &&
    approvedWithinDaysRaw >= 1 &&
    approvedWithinDaysRaw <= 30
      ? Math.floor(approvedWithinDaysRaw)
      : undefined;
  const sortRaw = url.searchParams.get("sort")?.trim();
  const sort: BookingsListSort | undefined =
    sortRaw === "departureAt" || sortRaw === "submittedAt" ? sortRaw : undefined;

  return {
    view,
    ...statusFields,
    ...(tourId !== undefined && tourId.length > 0 ? { tourId } : {}),
    ...(paymentStatus !== undefined ? { paymentStatus } : {}),
    ...(q !== undefined && q.length > 0 ? { q } : {}),
    ...(cursor !== undefined && cursor.length > 0 ? { cursor } : {}),
    ...(departureWithinDays !== undefined ? { departureWithinDays } : {}),
    ...(approvedWithinDays !== undefined ? { approvedWithinDays } : {}),
    ...(sort !== undefined ? { sort } : {}),
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 50,
  };
}

/** Parse GET /bookings/summary query — default tourChipScope=ops (P4a/P4c). */
export function parseBookingsSummaryQuery(url: URL): BookingsSummaryQuery {
  const raw = url.searchParams.get("tourChipScope")?.trim().toLowerCase() ?? "";
  return {
    tourChipScope: raw === "all" ? "all" : "ops",
  };
}

/** Parse optional `registrationIntake` object (booking-owned capacity lives here). */
export function readBookingRegistrationIntake(
  body: unknown
): Readonly<Record<string, unknown>> | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const value = (body as Record<string, unknown>).registrationIntake;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

/** Parse POST /bookings JSON body. Returns null when required fields are missing/invalid. */
export function parseCreateBookingBody(body: unknown): CreateBookingRequest | null {
  const tourId = readBookingStringField(body, "tourId");
  const tourTitle = readBookingStringField(body, "tourTitle");
  const guestLabel = readBookingStringField(body, "guestLabel");
  const partySize = readBookingNumberField(body, "partySize");
  const departureAt = readBookingStringField(body, "departureAt");
  const guestEmail = readBookingStringField(body, "guestEmail");
  const guestPhone = readBookingStringField(body, "guestPhone");
  const memberUserId = readBookingStringField(body, "memberUserId");
  const registrationIntake = readBookingRegistrationIntake(body);

  if (
    tourId.length === 0 ||
    tourTitle.length === 0 ||
    guestLabel.length === 0 ||
    partySize <= 0 ||
    departureAt.length === 0
  ) {
    return null;
  }

  return {
    tourId,
    tourTitle,
    guestLabel,
    partySize,
    departureAt,
    ...(guestEmail.length > 0 ? { guestEmail } : {}),
    ...(guestPhone.length > 0 ? { guestPhone } : {}),
    ...(memberUserId.length > 0 ? { memberUserId } : {}),
    ...(registrationIntake !== undefined ? { registrationIntake } : {}),
  };
}

export function parseBulkApproveBookingsBody(body: unknown): string[] {
  if (typeof body !== "object" || body === null) {
    return [];
  }
  const ids = (body as Record<string, unknown>).ids;
  if (!Array.isArray(ids)) {
    return [];
  }
  return ids.filter((value): value is string => typeof value === "string");
}

export function parseRejectBookingBody(body: unknown): { readonly reason?: string } {
  const reason = readBookingStringField(body, "reason");
  return reason.length > 0 ? { reason } : {};
}

export function parseBookingMemberReceiptJsonBody(
  body: unknown
): BookingMemberReceiptJsonBody | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const fileKey = typeof record.fileKey === "string" ? record.fileKey.trim() : "";
  if (fileKey.length === 0) {
    return null;
  }
  const note = typeof record.note === "string" ? record.note.trim() : undefined;
  return note !== undefined && note.length > 0 ? { fileKey, note } : { fileKey };
}

/**
 * Member receipt POST content-type gate (bit-identical to prior routes helper).
 * Empty Content-Type is treated as JSON (legacy clients).
 */
export function isBookingJsonReceiptContentType(contentType: string): boolean {
  const normalized = contentType.trim().toLowerCase();
  return normalized.includes("application/json") || normalized.length === 0;
}

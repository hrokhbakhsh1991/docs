/**
 * Booking HTTP request parsers — bit-identical to prior bookings.routes helpers.
 * No Zod: preserve exact null/empty semantics of the hand parsers.
 */
import { BOOKING_PAYMENT_STATUSES, BOOKING_STATUSES } from "./booking-status";
import type {
  BookingMemberReceiptJsonBody,
  BookingsListQuery,
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

/** Parse GET /bookings query string (URL search params). */
export function parseBookingsListQuery(url: URL): BookingsListQuery {
  const viewRaw = url.searchParams.get("view");
  const view = viewRaw === "mine" ? "mine" : "ops";
  const statusRaw = url.searchParams.get("status");
  const status = BOOKING_STATUSES.find((value) => value === statusRaw);
  const tourId = url.searchParams.get("tourId")?.trim();
  const paymentStatusRaw = url.searchParams.get("paymentStatus");
  const paymentStatus = BOOKING_PAYMENT_STATUSES.find((value) => value === paymentStatusRaw);
  const q = url.searchParams.get("q")?.trim();
  const cursor = url.searchParams.get("cursor")?.trim();
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");

  return {
    view,
    ...(status !== undefined ? { status } : {}),
    ...(tourId !== undefined && tourId.length > 0 ? { tourId } : {}),
    ...(paymentStatus !== undefined ? { paymentStatus } : {}),
    ...(q !== undefined && q.length > 0 ? { q } : {}),
    ...(cursor !== undefined && cursor.length > 0 ? { cursor } : {}),
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 50,
  };
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

import type { IncomingMessage, ServerResponse } from "node:http";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { readIdentityRequestBody } from "../identity/read-identity-request-body";
import { requireOperatorSession } from "../identity/require-operator-session";
import { resolveLazyFinanceService } from "../boot/lazy-finance-service";
import {
  approveBooking,
  BookingNotFoundError,
  BookingStatusConflictError,
  BookingsOpsForbiddenError,
  BulkApproveBatchLimitError,
  bulkApproveBookings,
  createBooking,
  getBookingsSummary,
  listBookings,
  rejectBooking,
} from "./bookings.service";
import type {
  BookingPaymentStatus,
  BookingStatus,
  BookingsListView,
  CreateBookingRequest,
} from "./bookings.types";

const BOOKING_STATUSES: readonly BookingStatus[] = [
  "pending",
  "approved",
  "waitlisted",
  "rejected",
  "cancelled",
];

const PAYMENT_STATUSES: readonly BookingPaymentStatus[] = ["unpaid", "partial", "paid"];

function readStringField(body: unknown, key: string): string {
  if (typeof body !== "object" || body === null) return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNumberField(body: unknown, key: string): number {
  if (typeof body !== "object" || body === null) return 0;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseListQuery(url: URL) {
  const viewRaw = url.searchParams.get("view");
  const view: BookingsListView = viewRaw === "mine" ? "mine" : "ops";
  const statusRaw = url.searchParams.get("status");
  const status = BOOKING_STATUSES.find((value) => value === statusRaw);
  const tourId = url.searchParams.get("tourId")?.trim();
  const paymentStatusRaw = url.searchParams.get("paymentStatus");
  const paymentStatus = PAYMENT_STATUSES.find((value) => value === paymentStatusRaw);
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

function parseCreateBody(body: unknown): CreateBookingRequest | null {
  const tourId = readStringField(body, "tourId");
  const tourTitle = readStringField(body, "tourTitle");
  const guestLabel = readStringField(body, "guestLabel");
  const partySize = readNumberField(body, "partySize");
  const departureAt = readStringField(body, "departureAt");
  const guestEmail = readStringField(body, "guestEmail");
  const guestPhone = readStringField(body, "guestPhone");

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

export async function handleListBookings(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseListQuery(url);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await listBookings(auth, query);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    if (error instanceof BookingsOpsForbiddenError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleGetBookingsSummary(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await getBookingsSummary(auth);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    if (error instanceof BookingsOpsForbiddenError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleCreateBooking(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const parsed = parseCreateBody(body);
    if (parsed === null) {
      sendHttpError(res, 400, { error: "invalid_body", code: "BOOKING_CREATE_INVALID" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const created = await createBooking(auth, parsed);
        sendJson(res, 201, created);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (error instanceof BookingsOpsForbiddenError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleApproveBooking(
  req: IncomingMessage,
  res: ServerResponse,
  bookingId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await approveBooking(auth, bookingId);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (error instanceof BookingsOpsForbiddenError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code });
      return;
    }
    if (error instanceof BookingNotFoundError) {
      sendHttpError(res, 404, { error: "not_found", code: error.code });
      return;
    }
    if (error instanceof BookingStatusConflictError) {
      sendHttpError(res, 409, { error: "conflict", code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}

function parseBulkApproveBody(body: unknown): string[] {
  if (typeof body !== "object" || body === null) {
    return [];
  }
  const ids = (body as Record<string, unknown>).ids;
  if (!Array.isArray(ids)) {
    return [];
  }
  return ids.filter((value): value is string => typeof value === "string");
}

export async function handleBulkApproveBookings(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const ids = parseBulkApproveBody(body);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await bulkApproveBookings(auth, { ids });
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (error instanceof BookingsOpsForbiddenError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code });
      return;
    }
    if (error instanceof BulkApproveBatchLimitError) {
      sendHttpError(res, 400, { error: "batch_limit", code: error.code, maxBatch: error.maxBatch });
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleRejectBooking(
  req: IncomingMessage,
  res: ServerResponse,
  bookingId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const reason = readStringField(body, "reason");

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await rejectBooking(auth, bookingId, {
          ...(reason.length > 0 ? { reason } : {}),
        });
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (error instanceof BookingsOpsForbiddenError) {
      sendHttpError(res, 403, { error: "forbidden", code: error.code });
      return;
    }
    if (error instanceof BookingNotFoundError) {
      sendHttpError(res, 404, { error: "not_found", code: error.code });
      return;
    }
    if (error instanceof BookingStatusConflictError) {
      sendHttpError(res, 409, { error: "conflict", code: error.code });
      return;
    }
    handleHttpError(res, error);
  }
}

function parseMemberReceiptBody(body: unknown): { fileKey: string; note?: string } | null {
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

export async function handlePostBookingReceipt(
  req: IncomingMessage,
  res: ServerResponse,
  bookingId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = parseMemberReceiptBody(await readIdentityRequestBody(req));
    if (body === null) {
      sendHttpError(res, 400, { error: "invalid_payload", code: "FILE_KEY_REQUIRED" });
      return;
    }

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const financeService = await resolveLazyFinanceService();
        const receipt = await financeService.submitMemberReceiptForRegistration(auth, {
          registrationId: bookingId,
          fileKey: body.fileKey,
          ...(body.note !== undefined ? { note: body.note } : {}),
        });
        sendJson(res, 201, receipt);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "BOOKINGS_FORBIDDEN") {
      sendHttpError(res, 403, { error: "forbidden", code: "BOOKINGS_FORBIDDEN" });
      return;
    }
    handleHttpError(res, error);
  }
}

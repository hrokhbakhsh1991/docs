import type { IncomingMessage, ServerResponse } from "node:http";

import {
  parseBookingMemberReceiptJsonBody,
  parseBookingsListQuery,
  parseBulkApproveBookingsBody,
  parseCreateBookingBody,
  parseRejectBookingBody,
} from "@app-tour/booking-http-contracts";

import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { readBinaryRequestBody } from "../http/read-binary-body";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { readIdentityRequestBody } from "../identity/read-identity-request-body";
import { requireOperatorSession } from "../identity/require-operator-session";
import { resolveFinanceServiceForTenant } from "../boot/lazy-finance-service";
import {
  MEMBER_RECEIPT_PROOF_MAX_BYTES,
  putMemberReceiptProof,
  sanitizeReceiptProofFileName,
} from "../workspace-finance/receipt-proof-storage";
import {
  BookingNotFoundError,
  BookingStatusConflictError,
  BookingsOpsForbiddenError,
  BulkApproveBatchLimitError,
} from "./bookings.errors";
import {
  approveBooking,
  bulkApproveBookings,
  createBooking,
  getBookingsSummary,
  listBookings,
  rejectBooking,
} from "./create-bookings-service";

export async function handleListBookings(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseBookingsListQuery(url);

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
    const parsed = parseCreateBookingBody(body);
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

function readHeader(req: IncomingMessage, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  if (raw === undefined) {
    return "";
  }
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

export async function handleBulkApproveBookings(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const body = await readIdentityRequestBody(req);
    const ids = parseBulkApproveBookingsBody(body);

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
    const { reason } = parseRejectBookingBody(body);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await rejectBooking(auth, bookingId, {
          ...(reason !== undefined ? { reason } : {}),
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

function isJsonReceiptContentType(contentType: string): boolean {
  const normalized = contentType.trim().toLowerCase();
  return normalized.includes("application/json") || normalized.length === 0;
}

function mapMemberReceiptUploadError(res: ServerResponse, error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "MINIO_NOT_CONFIGURED") {
    sendHttpError(res, 503, { error: "service_unavailable", code: "MINIO_NOT_CONFIGURED" });
    return true;
  }
  if (
    message === "RECEIPT_PROOF_EMPTY" ||
    message === "RECEIPT_PROOF_TOO_LARGE" ||
    message === "RECEIPT_PROOF_CONTENT_TYPE_INVALID" ||
    message === "RECEIPT_PROOF_KEY_SCOPE_INVALID"
  ) {
    sendHttpError(res, 400, { error: "invalid_body", code: message });
    return true;
  }
  return false;
}

export async function handlePostBookingReceipt(
  req: IncomingMessage,
  res: ServerResponse,
  bookingId: string
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const contentType = readHeader(req, "content-type");

    if (isJsonReceiptContentType(contentType)) {
      const body = parseBookingMemberReceiptJsonBody(await readIdentityRequestBody(req));
      if (body === null) {
        sendHttpError(res, 400, { error: "invalid_payload", code: "FILE_KEY_REQUIRED" });
        return;
      }

      await runWithHttpRequestContext(
        req,
        auth,
        async () => {
          const financeService = await resolveFinanceServiceForTenant(auth.tenantId);
          const receipt = await financeService.submitMemberReceiptForRegistration(auth, {
            registrationId: bookingId,
            fileKey: body.fileKey,
            ...(body.note !== undefined ? { note: body.note } : {}),
          });
          sendJson(res, 201, receipt);
        },
        { rateLimit: "write" }
      );
      return;
    }

    const fileNameHeader = readHeader(req, "x-receipt-file-name");
    const fileName =
      fileNameHeader.length > 0 ? sanitizeReceiptProofFileName(fileNameHeader) : "receipt.bin";
    const body = await readBinaryRequestBody(req, MEMBER_RECEIPT_PROOF_MAX_BYTES);
    const stored = await putMemberReceiptProof({
      tenantId: auth.tenantId,
      registrationId: bookingId,
      body,
      contentType,
      fileName,
    });

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const financeService = await resolveFinanceServiceForTenant(auth.tenantId);
        const receipt = await financeService.submitMemberReceiptForRegistration(auth, {
          registrationId: bookingId,
          fileKey: stored.storageKey,
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
    if (mapMemberReceiptUploadError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleGetBookingReceiptStatus(
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
        const financeService = await resolveFinanceServiceForTenant(auth.tenantId);
        const status = await financeService.getMemberReceiptStatusForRegistration(auth, bookingId);
        sendJson(res, 200, status);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "BOOKINGS_FORBIDDEN") {
      sendHttpError(res, 403, { error: "forbidden", code: "BOOKINGS_FORBIDDEN" });
      return;
    }
    handleHttpError(res, error);
  }
}

import type { IncomingMessage, ServerResponse } from "node:http";

import {
  isBookingJsonReceiptContentType,
  parseBookingMemberReceiptJsonBody,
  parseBookingsListQuery,
  parseBookingsSummaryQuery,
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
  approveBooking,
  bulkApproveBookings,
  cancelBooking,
  createBooking,
  getBooking,
  getBookingsSummary,
  listBookings,
  rejectBooking,
  waitlistBooking,
} from "./create-bookings-service";
import {
  getMemberCancellationEligibility,
  submitMemberCancellation,
} from "./member-cancellation.service";
import { listMemberNotificationInbox } from "../notifications/member-notification-inbox.repository";
import { submitBinaryMemberReceiptAfterOwnership } from "./submit-binary-member-receipt-after-ownership";

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
    handleHttpError(res, error);
  }
}

export async function handleGetBooking(
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
        const result = await getBooking(auth, bookingId);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleGetBookingsSummary(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseBookingsSummaryQuery(url);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await getBookingsSummary(auth, query);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
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
    handleHttpError(res, error);
  }
}

export async function handleWaitlistBooking(
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
        const result = await waitlistBooking(auth, bookingId);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleCancelBooking(
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
        const result = await cancelBooking(auth, bookingId);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
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

    if (isBookingJsonReceiptContentType(contentType)) {
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

    // MR-P0-010: ownership/authz before object-storage put (no orphan proofs / DoS on foreign ids).
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const financeService = await resolveFinanceServiceForTenant(auth.tenantId);
        const receipt = await submitBinaryMemberReceiptAfterOwnership({
          assertOwns: async () => {
            await financeService.getMemberReceiptStatusForRegistration(auth, bookingId);
          },
          putProof: async () =>
            putMemberReceiptProof({
              tenantId: auth.tenantId,
              registrationId: bookingId,
              body,
              contentType,
              fileName,
            }),
          submit: async (fileKey) =>
            financeService.submitMemberReceiptForRegistration(auth, {
              registrationId: bookingId,
              fileKey,
            }),
        });
        sendJson(res, 201, receipt);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
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
    handleHttpError(res, error);
  }
}

function mapMemberCancellationError(res: ServerResponse, error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("MEMBER_CANCELLATION_DENIED:")) {
    sendHttpError(res, 409, {
      error: "member_cancellation_denied",
      code: message.slice("MEMBER_CANCELLATION_DENIED:".length),
    });
    return true;
  }
  if (message === "BOOKING_MEMBER_FORBIDDEN") {
    sendHttpError(res, 403, { error: "forbidden", code: "BOOKING_MEMBER_FORBIDDEN" });
    return true;
  }
  return false;
}

export async function handleGetMemberCancellation(
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
        const result = await getMemberCancellationEligibility(auth, bookingId);
        sendJson(res, 200, result);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handlePostMemberCancellation(
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
        const result = await submitMemberCancellation(auth, bookingId);
        sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    if (mapMemberCancellationError(res, error)) {
      return;
    }
    handleHttpError(res, error);
  }
}

export async function handleGetMemberNotifications(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const items = listMemberNotificationInbox(auth.tenantId, auth.userId);
        sendJson(res, 200, { items });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

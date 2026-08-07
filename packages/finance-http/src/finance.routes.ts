/**
 * Finance-owned HTTP handlers (Phase 1.4 Commit 2).
 * Moved from workspace-denali; paths and host-port behavior unchanged.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import { getFinanceHttpHost } from "./host-runtime";
import type { FinanceRouteDeps } from "./host-ports";
import {
  parseCreateManualPaymentBody,
  parseGenerateScheduleBody,
  parseLedgerEventsLimit,
  parseOpenPaymentsLimit,
  parseFinanceListScope,
  parseOptionalRegistrationId,
  parseOptionalTourId,
  parsePatchScheduleItemBody,
  parseRecordPrepaymentBody,
  parseReviewReceiptBody,
  parseSetObligationOverrideBody,
  parseSubmitReceiptBody,
} from "@app-tour/finance-http-contracts";

export type { FinanceRouteDeps } from "./host-ports";

export async function handleFinanceSummary(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const summary = await financeService.getSummary(auth);
        host.sendJson(res, 200, summary);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceReportByTour(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const tourId = parseOptionalTourId(url.searchParams.get("tourId"));
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const report = await financeService.getReportByTour(auth, tourId);
        host.sendJson(res, 200, report);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceOpenPayments(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const scope = parseFinanceListScope(url.searchParams);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rows = await financeService.listOpenPayments(
          auth,
          limit,
          scope.registrationId,
          scope.tourId
        );
        host.sendJson(res, 200, { items: rows });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceLedgerEvents(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseLedgerEventsLimit(url.searchParams.get("limit"));
    const scope = parseFinanceListScope(url.searchParams);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rows = await financeService.listLedgerEvents(
          auth,
          limit,
          scope.registrationId,
          scope.tourId
        );
        host.sendJson(res, 200, { items: rows });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceListPayments(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const scope = parseFinanceListScope(url.searchParams);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rows = await financeService.listPayments(
          auth,
          limit,
          scope.registrationId,
          scope.tourId
        );
        host.sendJson(res, 200, { items: rows });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceCreateManualPayment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const idempotencyKey = host.readIdempotencyKey(req);
    if (idempotencyKey === undefined) {
      throw new Error(host.idempotencyKeyRequiredCode);
    }
    const { parsedBody, rawBody } = await host.readFinanceRequestBody(req);
    const body = parseCreateManualPaymentBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    const requestHash = host.hashIdempotentRequest(
      req.method ?? "POST",
      "/finance/payments/manual",
      rawBody
    );
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payment = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => {
            const created = await financeService.createManualPayment(auth, body, idempotencyKey);
            return created as Record<string, unknown>;
          }
        );
        host.sendJson(res, 201, payment);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceSubmitReceipt(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const idempotencyKey = host.readIdempotencyKey(req);
    if (idempotencyKey === undefined) {
      throw new Error(host.idempotencyKeyRequiredCode);
    }
    const { parsedBody, rawBody } = await host.readFinanceRequestBody(req);
    const body = parseSubmitReceiptBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    const requestHash = host.hashIdempotentRequest(
      req.method ?? "POST",
      "/finance/receipts",
      rawBody
    );
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const receipt = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => {
            const created = await financeService.submitReceipt(auth, body, idempotencyKey);
            return created as Record<string, unknown>;
          }
        );
        host.sendJson(res, 201, receipt);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceReviewReceipt(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  receiptId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const { parsedBody, rawBody } = await host.readFinanceRequestBody(req);
    const body = parseReviewReceiptBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        if (body.decision === "approve") {
          const idempotencyKey = host.readIdempotencyKey(req);
          if (idempotencyKey === undefined) {
            throw new Error(host.idempotencyKeyRequiredCode);
          }
          const requestHash = host.hashIdempotentRequest(
            req.method ?? "PATCH",
            `/finance/receipts/${receiptId}/review`,
            rawBody
          );
          const receipt = await host.runIdempotentHttpMutation(
            auth.tenantId,
            idempotencyKey,
            requestHash,
            async () => financeService.reviewReceipt(auth, receiptId, body),
            { statusCode: 200 }
          );
          host.sendJson(res, 200, receipt);
          return;
        }
        const receipt = await financeService.reviewReceipt(auth, receiptId, body);
        host.sendJson(res, 200, receipt);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceReceiptUrl(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  receiptId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const url = await financeService.getReceiptUrl(auth, receiptId);
        host.sendJson(res, 200, url);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinancePendingReceipts(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const scope = parseFinanceListScope(url.searchParams);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rows = await financeService.listPendingReceipts(
          auth,
          limit,
          scope.registrationId,
          scope.tourId
        );
        host.sendJson(res, 200, { items: rows });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceListPrepayments(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const scope = parseFinanceListScope(url.searchParams);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rows = await financeService.listPrepayments(
          auth,
          limit,
          scope.registrationId,
          scope.tourId
        );
        host.sendJson(res, 200, { items: rows });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceRecordPrepayment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const idempotencyKey = host.readIdempotencyKey(req);
    if (idempotencyKey === undefined) {
      throw new Error(host.idempotencyKeyRequiredCode);
    }
    const { parsedBody, rawBody } = await host.readFinanceRequestBody(req);
    const body = parseRecordPrepaymentBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    const requestHash = host.hashIdempotentRequest(
      req.method ?? "POST",
      "/finance/prepayments",
      rawBody
    );
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const record = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => financeService.recordPrepayment(auth, body, idempotencyKey)
        );
        host.sendJson(res, 201, record);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceListBookingSyncDegraded(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rows = await financeService.listPrepaymentBookingSyncDegraded(auth, limit);
        host.sendJson(res, 200, { items: rows });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceRetryBookingSync(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const { parsedBody } = await host.readFinanceRequestBody(req);
    const registrationId =
      parsedBody !== null &&
      typeof parsedBody === "object" &&
      typeof (parsedBody as { registrationId?: unknown }).registrationId === "string"
        ? (parsedBody as { registrationId: string }).registrationId.trim()
        : "";
    if (registrationId.length === 0) {
      throw new Error("ZOD_VALIDATION_FAILED: registrationId is required");
    }
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await financeService.retryPrepaymentBookingSync(auth, registrationId);
        host.sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceListSchedules(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const scope = parseFinanceListScope(url.searchParams);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const items = await financeService.listPaymentSchedules(
          auth,
          scope.registrationId,
          scope.tourId
        );
        host.sendJson(res, 200, { items });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceGetSchedule(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  registrationId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const items = await financeService.getPaymentSchedule(auth, registrationId);
        host.sendJson(res, 200, { registrationId, items });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceGenerateSchedule(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const { parsedBody } = await host.readFinanceRequestBody(req);
    const body = parseGenerateScheduleBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const schedule = await financeService.generatePaymentSchedule(auth, body);
        host.sendJson(res, 201, schedule);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceGetRegistrationInvoice(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  registrationId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const invoice = await financeService.getRegistrationInvoice(auth, registrationId);
        host.sendJson(res, 200, invoice);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceSetObligationOverride(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  registrationId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const { parsedBody } = await host.readFinanceRequestBody(req);
    const body = parseSetObligationOverrideBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await financeService.setRegistrationObligationOverride(auth, {
          registrationId,
          obligationMinor: body.obligationMinor,
          ...(body.reason !== undefined ? { reason: body.reason } : {}),
        });
        host.sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceReceiptUpload(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const registrationId = parseOptionalRegistrationId(url.searchParams.get("registrationId"));
    if (registrationId === undefined) {
      throw new Error("ZOD_VALIDATION_FAILED: registrationId is required");
    }
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        await financeService.getRegistrationInvoice(auth, registrationId);
        const uploaded = await host.uploadOperatorReceiptProof({
          req,
          auth,
          registrationId,
        });
        host.sendJson(res, 201, uploaded);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

function parseScheduleItemIdFromPath(pathname: string): string {
  const match = pathname.match(/\/items\/([^/]+)$/);
  const itemId = match?.[1]?.trim() ?? "";
  if (itemId.length === 0) {
    throw new Error("ZOD_VALIDATION_FAILED: itemId is required");
  }
  return decodeURIComponent(itemId);
}

export async function handleFinancePatchScheduleItem(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  registrationId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const { parsedBody } = await host.readFinanceRequestBody(req);
    const body = parsePatchScheduleItemBody(parsedBody);
    const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
    const itemId = parseScheduleItemIdFromPath(pathname);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await financeService.patchPaymentScheduleItem(
          auth,
          registrationId,
          itemId,
          body
        );
        if (result.audit !== null) {
          await host.enqueueScheduleItemWaivedAudit({
            tenantId: auth.tenantId,
            registrationId: result.registrationId,
            itemId: result.item.id,
            reason: result.audit.reason,
            actorUserId: result.audit.actorUserId,
          });
        }
        host.sendJson(res, 200, {
          registrationId: result.registrationId,
          item: result.item,
        });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

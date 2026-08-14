/**
 * Finance-owned HTTP handlers (Phase 1.4 Commit 2).
 * Moved from workspace-denali; paths and host-port behavior unchanged.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import { getFinanceHttpHost } from "./host-runtime";
import type { FinanceRouteDeps } from "./host-ports";
import {
  parseCancelPendingManualPaymentBody,
  parseCreateManualPaymentBody,
  parseGenerateScheduleBody,
  parseLedgerEventsLimit,
  parseOpenPaymentsLimit,
  parseFinanceListScope,
  parseOptionalListCursor,
  parseOptionalRegistrationId,
  parseOptionalTourId,
  parsePatchScheduleItemBody,
  parseRecordPrepaymentBody,
  parseReviewReceiptBody,
  parseSetObligationOverrideBody,
  parseSubmitReceiptBody,
  parseCaseEncounterCounterpartyId,
  parseFinanceCaseCommandReviewReceiptBody,
  parseRequestRefundBody,
  parseRejectRefundBody,
  parseCompleteRefundBody,
  parseOptionalRefundStatus,
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

/** PR23-D1 — outstanding AR balances (invoice SoT). */
export async function handleFinanceOutstandingBalances(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const cursor = parseOptionalListCursor(url.searchParams.get("cursor"));
    const scope = parseFinanceListScope(url.searchParams);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const page = await financeService.listOutstandingBalances(auth, {
          limit,
          cursor,
          ...(scope.tourId !== undefined ? { tourId: scope.tourId } : {}),
        });
        host.sendJson(res, 200, {
          items: page.items,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

/** PR23-D2 — tour AR rollup from outstanding invoices. */
export async function handleFinanceTourCollections(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const cursor = parseOptionalListCursor(url.searchParams.get("cursor"));
    const scope = parseFinanceListScope(url.searchParams);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const page = await financeService.listTourCollectionSummary(auth, {
          limit,
          cursor,
          ...(scope.tourId !== undefined ? { tourId: scope.tourId } : {}),
        });
        host.sendJson(res, 200, {
          items: page.items,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        });
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

/**
 * PR23-A3 — transport for Pending Manual → Cancelled.
 * Domain owns guards/audit; handler maps envelope only.
 */
export async function handleFinanceCancelPendingManualPayment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  paymentId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const idempotencyKey = host.readIdempotencyKey(req);
    if (idempotencyKey === undefined) {
      throw new Error(host.idempotencyKeyRequiredCode);
    }
    const { parsedBody, rawBody } = await host.readFinanceRequestBody(req);
    const body = parseCancelPendingManualPaymentBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    const requestHash = host.hashIdempotentRequest(
      req.method ?? "POST",
      `/finance/payments/${paymentId}/cancel`,
      rawBody
    );
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const cancelled = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => {
            const result = await financeService.cancelPendingManualPayment(
              auth,
              {
                paymentId,
                reasonCode: body.reasonCode,
                ...(body.reasonNote !== undefined ? { reasonNote: body.reasonNote } : {}),
              },
              idempotencyKey
            );
            return {
              paymentId: result.id,
              status: result.status,
              cancellationEventId: result.domainEventId,
              occurredAt: result.audit.occurredAt,
              reasonCode: result.audit.reasonCode,
              replay: result.replay,
            };
          },
          { statusCode: 200 }
        );
        host.sendJson(res, 200, cancelled);
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
    const cursor = parseOptionalListCursor(url.searchParams.get("cursor"));
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const page = await financeService.listPendingReceipts(
          auth,
          limit,
          scope.registrationId,
          scope.tourId,
          cursor
        );
        host.sendJson(res, 200, {
          items: page.items,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

/** PR23-C2 — read-only finance exception aggregation. */
export async function handleFinanceListExceptions(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const cursor = parseOptionalListCursor(url.searchParams.get("cursor"));
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const page = await financeService.listOperatorFinanceExceptions(auth, {
          limit,
          cursor,
        });
        host.sendJson(res, 200, {
          items: page.items,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

/** PR23-E3 — operator refund list. */
export async function handleFinanceListRefunds(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const cursor = parseOptionalListCursor(url.searchParams.get("cursor"));
    const registrationId = parseOptionalRegistrationId(url.searchParams.get("registrationId"));
    const status = parseOptionalRefundStatus(url.searchParams.get("status"));
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const page = await financeService.listOperatorRefunds(auth, {
          limit,
          cursor,
          ...(registrationId !== undefined ? { registrationId } : {}),
          ...(status !== undefined ? { status } : {}),
        });
        host.sendJson(res, 200, {
          items: page.items,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

/** PR23-E3 — single enriched refund. */
export async function handleFinanceGetRefund(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  refundId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const item = await financeService.getOperatorRefund(auth, refundId);
        host.sendJson(res, 200, item);
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

/** PR23-E3 — request offline refund (Idempotency-Key required). */
export async function handleFinanceRequestRefund(
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
    const body = parseRequestRefundBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    const requestHash = host.hashIdempotentRequest(
      req.method ?? "POST",
      "/finance/refunds",
      rawBody
    );
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const created = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => {
            const result = await financeService.requestRefund(auth, {
              ...body,
              idempotencyKey,
            });
            return result as Record<string, unknown>;
          },
          { statusCode: 201 }
        );
        host.sendJson(res, 201, created);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceApproveRefund(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  refundId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await financeService.approveRefund(auth, refundId);
        host.sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceCompleteRefund(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  refundId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const { parsedBody } = await host.readFinanceRequestBody(req);
    const body = parseCompleteRefundBody(
      parsedBody !== null && typeof parsedBody === "object" ? parsedBody : {}
    );
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await financeService.completeRefund(auth, refundId, body);
        const item = (await financeService.getOperatorRefund(
          auth,
          refundId
        )) as Record<string, unknown>;
        host.sendJson(res, 200, {
          ...result,
          invoice: item.invoice ?? null,
        });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceRejectRefund(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  refundId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const { parsedBody } = await host.readFinanceRequestBody(req);
    const body = parseRejectRefundBody(
      parsedBody !== null && typeof parsedBody === "object" ? parsedBody : {}
    );
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await financeService.rejectRefund(auth, refundId, body);
        host.sendJson(res, 200, result);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleFinanceCancelRefund(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  refundId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await financeService.cancelRefund(auth, refundId);
        host.sendJson(res, 200, result);
      },
      { rateLimit: "write" }
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

/**
 * GET /finance/case/encounters/:registrationId (PR12-B).
 * Presentation response only — Host owns Case composition via loadFinanceCaseEncounter.
 */
export async function handleFinanceCaseEncounter(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps,
  registrationId: string
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const counterpartyId = parseCaseEncounterCounterpartyId(
      url.searchParams.get("counterpartyId")
    );
    const result = await host.runWithHttpRequestContext(
      req,
      auth,
      async () =>
        host.loadFinanceCaseEncounter({
          auth,
          registrationId,
          counterpartyId,
          deps,
        }),
      { rateLimit: "read" }
    );
    if (result.status === 200) {
      host.sendJson(res, 200, result.body);
      return;
    }
    host.sendJson(res, result.status, { error: result.error });
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

/**
 * POST /finance/case/commands/review-receipt (PR14-B).
 * Accepts CaseCommandIntent-shaped body only — never raw SoT command payloads from UI.
 * Returns presentation EncounterView (+ executionId) or typed public failure.
 */
export async function handleFinanceCaseCommandReviewReceipt(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getFinanceHttpHost();
  try {
    const { parsedBody, rawBody } = await host.readFinanceRequestBody(req);
    const body = parseFinanceCaseCommandReviewReceiptBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const idempotencyKey =
      body.action.decision === "approve" ? host.readIdempotencyKey(req) : undefined;
    if (body.action.decision === "approve" && idempotencyKey === undefined) {
      throw new Error(host.idempotencyKeyRequiredCode);
    }
    const requestHash =
      idempotencyKey !== undefined
        ? host.hashIdempotentRequest(
            req.method ?? "POST",
            "/finance/case/commands/review-receipt",
            rawBody
          )
        : undefined;
    const result = await host.runWithHttpRequestContext(
      req,
      auth,
      async () =>
        host.runFinanceCaseCommandReviewReceipt({
          auth,
          body,
          deps,
          ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
          ...(requestHash !== undefined ? { requestHash } : {}),
        }),
      { rateLimit: "write" }
    );
    if (result.status === 200) {
      host.sendJson(res, 200, result.body);
      return;
    }
    host.sendJson(res, result.status, { error: result.error });
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

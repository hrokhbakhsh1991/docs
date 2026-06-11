import type { IncomingMessage, ServerResponse } from "node:http";

import { getDenaliFinanceHttpHost } from "./host-runtime";
import type { FinanceRouteDeps } from "./host-ports";
import {
  parseCreateManualPaymentBody,
  parseGenerateScheduleBody,
  parseLedgerEventsLimit,
  parseOpenPaymentsLimit,
  parseRecordPrepaymentBody,
  parseReviewReceiptBody,
  parseSubmitReceiptBody,
} from "./schemas/finance-request.schemas";

export type { FinanceRouteDeps } from "./host-ports";

export async function handleFinanceSummary(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getDenaliFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps);
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

export async function handleFinanceOpenPayments(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FinanceRouteDeps
): Promise<void> {
  const host = getDenaliFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const financeService = await host.resolveFinanceService(deps);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rows = await financeService.listOpenPayments(auth, limit);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseLedgerEventsLimit(url.searchParams.get("limit"));
    const financeService = await host.resolveFinanceService(deps);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rows = await financeService.listLedgerEvents(auth, limit);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const financeService = await host.resolveFinanceService(deps);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rows = await financeService.listPayments(auth, limit);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const { parsedBody } = await host.readFinanceRequestBody(req);
    const body = parseCreateManualPaymentBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const payment = await financeService.createManualPayment(auth, body);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const { parsedBody } = await host.readFinanceRequestBody(req);
    const body = parseSubmitReceiptBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const receipt = await financeService.submitReceipt(auth, body);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const { parsedBody } = await host.readFinanceRequestBody(req);
    const body = parseReviewReceiptBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
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
  const host = getDenaliFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const financeService = await host.resolveFinanceService(deps);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rows = await financeService.listPendingReceipts(auth, limit);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseOpenPaymentsLimit(url.searchParams.get("limit"));
    const financeService = await host.resolveFinanceService(deps);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const rows = await financeService.listPrepayments(auth, limit);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const { parsedBody } = await host.readFinanceRequestBody(req);
    const body = parseRecordPrepaymentBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const record = await financeService.recordPrepayment(auth, body);
        host.sendJson(res, 201, record);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const items = await financeService.listPaymentSchedules(auth);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const { parsedBody } = await host.readFinanceRequestBody(req);
    const body = parseGenerateScheduleBody(parsedBody);
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps);
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
  const host = getDenaliFinanceHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const financeService = await host.resolveFinanceService(deps);
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

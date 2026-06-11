import type { IncomingMessage, ServerResponse } from "node:http";

import { resolveLazyFinanceService } from "../boot/lazy-finance-service";
import type { FinanceService } from "../denali-finance/finance.service";
import type { FinanceRouteDeps } from "@app-tour/workspace-denali/http";
import type { TourStorageRepository } from "../db/tour.repository";
import {
  DENALI_CATALOG_HTTP_ROUTES,
  DENALI_CATALOG_TOUR_PATH_PATTERN,
  DENALI_FINANCE_HTTP_ROUTES,
  FINANCE_RECEIPT_REVIEW_PATH_PATTERN,
  FINANCE_RECEIPT_URL_PATH_PATTERN,
  FINANCE_INVOICE_PATH_PATTERN,
  FINANCE_SCHEDULE_PATH_PATTERN,
  type DenaliCatalogHandlerKey,
  type DenaliFinanceHandlerKey,
} from "./denali-workspace-routes";
import type { DenaliProductRouteDeps } from "@app-tour/workspace-denali/http";
import {
  URBAN_CATALOG_TOUR_PATH_PATTERN,
  URBAN_WORKSPACE_HTTP_ROUTES,
} from "./urban-workspace-routes";
import type { WorkspaceUrbanHandlerKey } from "./workspace-http-types";

export type WorkspaceRouteHandlers = {
  readonly handleGetUrbanSettings: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  readonly handlePatchUrbanSettings: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  readonly handleGetUrbanCatalog: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: { readonly tourStore?: TourStorageRepository }
  ) => Promise<void>;
  readonly handleGetUrbanCatalogTour: (
    req: IncomingMessage,
    res: ServerResponse,
    tourId: string,
    deps: { readonly tourStore?: TourStorageRepository }
  ) => Promise<void>;
  readonly handlePostUrbanRegistration: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: { readonly tourStore?: TourStorageRepository }
  ) => Promise<void>;
  readonly handleGetDenaliCatalog: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: DenaliProductRouteDeps
  ) => Promise<void>;
  readonly handleGetDenaliCatalogTour: (
    req: IncomingMessage,
    res: ServerResponse,
    tourId: string,
    deps: DenaliProductRouteDeps
  ) => Promise<void>;
  readonly handlePostDenaliRegistration: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: DenaliProductRouteDeps
  ) => Promise<void>;
  readonly handleFinanceSummary: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceOpenPayments: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceLedgerEvents: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceListPayments: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceCreateManualPayment: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceSubmitReceipt: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceReviewReceipt: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps,
    receiptId: string
  ) => Promise<void>;
  readonly handleFinanceReceiptUrl: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps,
    receiptId: string
  ) => Promise<void>;
  readonly handleFinancePendingReceipts: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceListPrepayments: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceRecordPrepayment: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceListSchedules: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceGetSchedule: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps,
    registrationId: string
  ) => Promise<void>;
  readonly handleFinanceGenerateSchedule: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps
  ) => Promise<void>;
  readonly handleFinanceGetRegistrationInvoice: (
    req: IncomingMessage,
    res: ServerResponse,
    deps: FinanceRouteDeps,
    registrationId: string
  ) => Promise<void>;
};

export type WorkspaceRouteRegistrarDeps = {
  readonly tourStore?: TourStorageRepository;
  readonly financeService?: FinanceService;
};

function urbanProductDeps(deps: WorkspaceRouteRegistrarDeps) {
  return { tourStore: deps.tourStore };
}

function denaliProductDeps(deps: WorkspaceRouteRegistrarDeps): DenaliProductRouteDeps {
  return { tourStore: deps.tourStore };
}

async function financeRouteDeps(deps: WorkspaceRouteRegistrarDeps): Promise<FinanceRouteDeps> {
  return { financeService: await resolveLazyFinanceService(deps.financeService) };
}

async function dispatchUrbanHandler(
  handlerKey: WorkspaceUrbanHandlerKey,
  req: IncomingMessage,
  res: ServerResponse,
  handlers: WorkspaceRouteHandlers,
  deps: WorkspaceRouteRegistrarDeps,
  tourId?: string
): Promise<void> {
  const productDeps = urbanProductDeps(deps);
  switch (handlerKey) {
    case "handleGetUrbanSettings":
      await handlers.handleGetUrbanSettings(req, res);
      return;
    case "handlePatchUrbanSettings":
      await handlers.handlePatchUrbanSettings(req, res);
      return;
    case "handleGetUrbanCatalog":
      await handlers.handleGetUrbanCatalog(req, res, productDeps);
      return;
    case "handleGetUrbanCatalogTour":
      await handlers.handleGetUrbanCatalogTour(req, res, tourId!, productDeps);
      return;
    case "handlePostUrbanRegistration":
      await handlers.handlePostUrbanRegistration(req, res, productDeps);
      return;
    default: {
      const _exhaustive: never = handlerKey;
      throw new Error(`WORKSPACE_HTTP_HANDLER_UNKNOWN:${String(_exhaustive)}`);
    }
  }
}

async function dispatchDenaliCatalogHandler(
  handlerKey: DenaliCatalogHandlerKey,
  req: IncomingMessage,
  res: ServerResponse,
  handlers: WorkspaceRouteHandlers,
  deps: WorkspaceRouteRegistrarDeps,
  tourId?: string
): Promise<void> {
  const productDeps = denaliProductDeps(deps);
  switch (handlerKey) {
    case "handleGetDenaliCatalog":
      await handlers.handleGetDenaliCatalog(req, res, productDeps);
      return;
    case "handleGetDenaliCatalogTour":
      await handlers.handleGetDenaliCatalogTour(req, res, tourId!, productDeps);
      return;
    case "handlePostDenaliRegistration":
      await handlers.handlePostDenaliRegistration(req, res, productDeps);
      return;
    default: {
      const _exhaustive: never = handlerKey;
      throw new Error(`DENALI_CATALOG_HANDLER_UNKNOWN:${String(_exhaustive)}`);
    }
  }
}

async function dispatchDenaliFinanceHandler(
  handlerKey: DenaliFinanceHandlerKey,
  req: IncomingMessage,
  res: ServerResponse,
  handlers: WorkspaceRouteHandlers,
  deps: WorkspaceRouteRegistrarDeps,
  receiptId?: string
): Promise<void> {
  const routeDeps = await financeRouteDeps(deps);
  switch (handlerKey) {
    case "handleFinanceSummary":
      await handlers.handleFinanceSummary(req, res, routeDeps);
      return;
    case "handleFinanceOpenPayments":
      await handlers.handleFinanceOpenPayments(req, res, routeDeps);
      return;
    case "handleFinanceLedgerEvents":
      await handlers.handleFinanceLedgerEvents(req, res, routeDeps);
      return;
    case "handleFinanceListPayments":
      await handlers.handleFinanceListPayments(req, res, routeDeps);
      return;
    case "handleFinanceCreateManualPayment":
      await handlers.handleFinanceCreateManualPayment(req, res, routeDeps);
      return;
    case "handleFinanceSubmitReceipt":
      await handlers.handleFinanceSubmitReceipt(req, res, routeDeps);
      return;
    case "handleFinanceReviewReceipt":
      await handlers.handleFinanceReviewReceipt(req, res, routeDeps, receiptId!);
      return;
    case "handleFinanceReceiptUrl":
      await handlers.handleFinanceReceiptUrl(req, res, routeDeps, receiptId!);
      return;
    case "handleFinancePendingReceipts":
      await handlers.handleFinancePendingReceipts(req, res, routeDeps);
      return;
    case "handleFinanceListPrepayments":
      await handlers.handleFinanceListPrepayments(req, res, routeDeps);
      return;
    case "handleFinanceRecordPrepayment":
      await handlers.handleFinanceRecordPrepayment(req, res, routeDeps);
      return;
    case "handleFinanceListSchedules":
      await handlers.handleFinanceListSchedules(req, res, routeDeps);
      return;
    case "handleFinanceGetSchedule":
      await handlers.handleFinanceGetSchedule(req, res, routeDeps, receiptId!);
      return;
    case "handleFinanceGenerateSchedule":
      await handlers.handleFinanceGenerateSchedule(req, res, routeDeps);
      return;
    case "handleFinanceGetRegistrationInvoice":
      await handlers.handleFinanceGetRegistrationInvoice(req, res, routeDeps, receiptId!);
      return;
    default: {
      const _exhaustive: never = handlerKey;
      throw new Error(`DENALI_FINANCE_HANDLER_UNKNOWN:${String(_exhaustive)}`);
    }
  }
}

/**
 * Dispatches workspace-product HTTP routes (urban + denali finance). Returns true when handled.
 */
export async function tryDispatchWorkspaceRoutes(
  method: string,
  pathname: string,
  req: IncomingMessage,
  res: ServerResponse,
  handlers: WorkspaceRouteHandlers,
  deps: WorkspaceRouteRegistrarDeps
): Promise<boolean> {
  for (const route of URBAN_WORKSPACE_HTTP_ROUTES) {
    if (method === route.method && pathname === route.path) {
      await dispatchUrbanHandler(route.handlerKey, req, res, handlers, deps);
      return true;
    }
  }

  const catalogTourMatch = pathname.match(URBAN_CATALOG_TOUR_PATH_PATTERN);
  if (method === "GET" && catalogTourMatch) {
    await dispatchUrbanHandler(
      "handleGetUrbanCatalogTour",
      req,
      res,
      handlers,
      deps,
      catalogTourMatch[1]!
    );
    return true;
  }

  for (const route of DENALI_CATALOG_HTTP_ROUTES) {
    if (method === route.method && pathname === route.path) {
      await dispatchDenaliCatalogHandler(route.handlerKey, req, res, handlers, deps);
      return true;
    }
  }

  const denaliCatalogTourMatch = pathname.match(DENALI_CATALOG_TOUR_PATH_PATTERN);
  if (method === "GET" && denaliCatalogTourMatch) {
    await dispatchDenaliCatalogHandler(
      "handleGetDenaliCatalogTour",
      req,
      res,
      handlers,
      deps,
      denaliCatalogTourMatch[1]!
    );
    return true;
  }

  for (const route of DENALI_FINANCE_HTTP_ROUTES) {
    if (method === route.method && pathname === route.path) {
      await dispatchDenaliFinanceHandler(route.handlerKey, req, res, handlers, deps);
      return true;
    }
  }

  const receiptReviewMatch = pathname.match(FINANCE_RECEIPT_REVIEW_PATH_PATTERN);
  if (method === "PATCH" && receiptReviewMatch) {
    await dispatchDenaliFinanceHandler(
      "handleFinanceReviewReceipt",
      req,
      res,
      handlers,
      deps,
      receiptReviewMatch[1]!
    );
    return true;
  }

  const receiptUrlMatch = pathname.match(FINANCE_RECEIPT_URL_PATH_PATTERN);
  if (method === "GET" && receiptUrlMatch) {
    await dispatchDenaliFinanceHandler(
      "handleFinanceReceiptUrl",
      req,
      res,
      handlers,
      deps,
      receiptUrlMatch[1]!
    );
    return true;
  }

  const scheduleMatch = pathname.match(FINANCE_SCHEDULE_PATH_PATTERN);
  if (method === "GET" && scheduleMatch) {
    await dispatchDenaliFinanceHandler(
      "handleFinanceGetSchedule",
      req,
      res,
      handlers,
      deps,
      scheduleMatch[1]!
    );
    return true;
  }

  const invoiceMatch = pathname.match(FINANCE_INVOICE_PATH_PATTERN);
  if (method === "GET" && invoiceMatch) {
    await dispatchDenaliFinanceHandler(
      "handleFinanceGetRegistrationInvoice",
      req,
      res,
      handlers,
      deps,
      invoiceMatch[1]!
    );
    return true;
  }

  return false;
}

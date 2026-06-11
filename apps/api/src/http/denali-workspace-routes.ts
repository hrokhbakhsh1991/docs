import { CATALOG_HTTP_ROUTE_MANIFEST, FINANCE_HTTP_ROUTE_MANIFEST } from "@app-tour/workspace-denali/http";

import {
  findManifestRoute,
  manifestPathToParamRegex,
  staticRoutesFromManifest,
} from "./workspace-route-manifest-bridge";
import type { WorkspaceHttpMethod } from "./workspace-http-types";

export type DenaliCatalogHandlerKey =
  | "handleGetDenaliCatalog"
  | "handleGetDenaliCatalogTour"
  | "handlePostDenaliRegistration";

export type DenaliCatalogHttpRouteDescriptor = {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
  readonly handlerKey: DenaliCatalogHandlerKey;
};

const DENALI_CATALOG_STATIC_HANDLER_KEYS = {
  "GET /denali/catalog": "handleGetDenaliCatalog",
  "POST /denali/registrations": "handlePostDenaliRegistration",
} as const satisfies Record<string, DenaliCatalogHandlerKey>;

/** Denali public catalog HTTP routes — derived from `CATALOG_HTTP_ROUTE_MANIFEST`. */
export const DENALI_CATALOG_HTTP_ROUTES: readonly DenaliCatalogHttpRouteDescriptor[] =
  staticRoutesFromManifest(CATALOG_HTTP_ROUTE_MANIFEST, DENALI_CATALOG_STATIC_HANDLER_KEYS);

const catalogTourRoute = findManifestRoute(
  CATALOG_HTTP_ROUTE_MANIFEST,
  "GET",
  "/denali/catalog/:tourId"
);
if (catalogTourRoute === undefined) {
  throw new Error("CATALOG_HTTP_ROUTE_MANIFEST missing GET /denali/catalog/:tourId");
}

export const DENALI_CATALOG_TOUR_PATH_PATTERN = manifestPathToParamRegex(catalogTourRoute.path);

export type DenaliFinanceHandlerKey =
  | "handleFinanceSummary"
  | "handleFinanceOpenPayments"
  | "handleFinanceLedgerEvents"
  | "handleFinanceListPayments"
  | "handleFinanceCreateManualPayment"
  | "handleFinanceSubmitReceipt"
  | "handleFinanceReviewReceipt"
  | "handleFinanceReceiptUrl"
  | "handleFinancePendingReceipts"
  | "handleFinanceListPrepayments"
  | "handleFinanceRecordPrepayment"
  | "handleFinanceListSchedules"
  | "handleFinanceGetSchedule"
  | "handleFinanceGenerateSchedule"
  | "handleFinanceGetRegistrationInvoice";

export type DenaliFinanceHttpRouteDescriptor = {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
  readonly handlerKey: DenaliFinanceHandlerKey;
};

const DENALI_STATIC_HANDLER_KEYS = {
  "GET /finance/reports/summary": "handleFinanceSummary",
  "GET /finance/reports/open-payments": "handleFinanceOpenPayments",
  "GET /finance/reports/ledger-events": "handleFinanceLedgerEvents",
  "GET /finance/payments": "handleFinanceListPayments",
  "POST /finance/payments/manual": "handleFinanceCreateManualPayment",
  "POST /finance/receipts": "handleFinanceSubmitReceipt",
  "GET /finance/receipts/pending": "handleFinancePendingReceipts",
  "GET /finance/prepayments": "handleFinanceListPrepayments",
  "POST /finance/prepayments": "handleFinanceRecordPrepayment",
  "GET /finance/schedules": "handleFinanceListSchedules",
  "POST /finance/schedules/generate": "handleFinanceGenerateSchedule",
} as const satisfies Record<string, DenaliFinanceHandlerKey>;

/** Denali finance HTTP routes — derived from `FINANCE_HTTP_ROUTE_MANIFEST` (Phase 10.4). */
export const DENALI_FINANCE_HTTP_ROUTES: readonly DenaliFinanceHttpRouteDescriptor[] =
  staticRoutesFromManifest(FINANCE_HTTP_ROUTE_MANIFEST, DENALI_STATIC_HANDLER_KEYS);

const receiptReviewRoute = findManifestRoute(
  FINANCE_HTTP_ROUTE_MANIFEST,
  "PATCH",
  "/finance/receipts/:receiptId/review"
);
const receiptUrlRoute = findManifestRoute(
  FINANCE_HTTP_ROUTE_MANIFEST,
  "GET",
  "/finance/receipts/:receiptId/url"
);
const scheduleRoute = findManifestRoute(
  FINANCE_HTTP_ROUTE_MANIFEST,
  "GET",
  "/finance/schedules/:registrationId"
);
const invoiceRoute = findManifestRoute(
  FINANCE_HTTP_ROUTE_MANIFEST,
  "GET",
  "/finance/invoices/:registrationId"
);
if (
  receiptReviewRoute === undefined ||
  receiptUrlRoute === undefined ||
  scheduleRoute === undefined ||
  invoiceRoute === undefined
) {
  throw new Error("FINANCE_HTTP_ROUTE_MANIFEST missing parameterized finance routes");
}

export const FINANCE_RECEIPT_REVIEW_PATH_PATTERN = manifestPathToParamRegex(
  receiptReviewRoute.path
);
export const FINANCE_RECEIPT_URL_PATH_PATTERN = manifestPathToParamRegex(receiptUrlRoute.path);
export const FINANCE_SCHEDULE_PATH_PATTERN = manifestPathToParamRegex(scheduleRoute.path);
export const FINANCE_INVOICE_PATH_PATTERN = manifestPathToParamRegex(invoiceRoute.path);

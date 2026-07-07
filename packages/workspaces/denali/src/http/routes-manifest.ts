import type { WorkspaceHttpMethod } from "./workspace-http-method";

/** Declarative denali public catalog HTTP inventory — marketing app (ADR-MKT-002). */
export const CATALOG_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/denali/catalog" },
  { method: "GET", path: "/denali/catalog/:tourId" },
  { method: "GET", path: "/denali/dashboard/tours/:tourId" },
  { method: "GET", path: "/denali/reminders/feed" },
  { method: "POST", path: "/denali/registrations" },
] as const;

/** Declarative denali finance HTTP inventory — consumed by host guards (Phase 10.4 P4-T02). */
export const FINANCE_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/finance/reports/summary" },
  { method: "GET", path: "/finance/reports/open-payments" },
  { method: "GET", path: "/finance/reports/ledger-events" },
  { method: "GET", path: "/finance/payments" },
  { method: "POST", path: "/finance/payments/manual" },
  { method: "POST", path: "/finance/receipts" },
  { method: "GET", path: "/finance/receipts/pending" },
  { method: "PATCH", path: "/finance/receipts/:receiptId/review" },
  { method: "GET", path: "/finance/receipts/:receiptId/url" },
  { method: "GET", path: "/finance/prepayments" },
  { method: "POST", path: "/finance/prepayments" },
  { method: "GET", path: "/finance/invoices/:registrationId" },
  { method: "GET", path: "/finance/schedules" },
  { method: "GET", path: "/finance/schedules/:registrationId" },
  { method: "POST", path: "/finance/schedules/generate" },
] as const;

export type WorkspaceHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** Declarative finance HTTP inventory — host codegen / Phase 10.4. */
export const FINANCE_HTTP_ROUTE_MANIFEST: readonly {
  readonly method: WorkspaceHttpMethod;
  readonly path: string;
}[] = [
  { method: "GET", path: "/finance/reports/summary" },
  { method: "GET", path: "/finance/reports/open-payments" },
  { method: "GET", path: "/finance/reports/ledger-events" },
  { method: "GET", path: "/finance/reports/by-tour" },
  { method: "GET", path: "/finance/reports/outstanding-balances" },
  { method: "GET", path: "/finance/reports/tour-collections" },
  { method: "GET", path: "/finance/payments" },
  { method: "POST", path: "/finance/payments/manual" },
  { method: "POST", path: "/finance/payments/:paymentId/cancel" },
  { method: "POST", path: "/finance/receipts" },
  { method: "POST", path: "/finance/receipts/upload" },
  { method: "GET", path: "/finance/receipts/pending" },
  { method: "GET", path: "/finance/exceptions" },
  { method: "GET", path: "/finance/refunds" },
  { method: "POST", path: "/finance/refunds" },
  { method: "GET", path: "/finance/refunds/:refundId" },
  { method: "POST", path: "/finance/refunds/:refundId/approve" },
  { method: "POST", path: "/finance/refunds/:refundId/complete" },
  { method: "POST", path: "/finance/refunds/:refundId/reject" },
  { method: "POST", path: "/finance/refunds/:refundId/cancel" },
  { method: "PATCH", path: "/finance/receipts/:receiptId/review" },
  { method: "GET", path: "/finance/receipts/:receiptId/url" },
  { method: "GET", path: "/finance/prepayments" },
  { method: "POST", path: "/finance/prepayments" },
  { method: "GET", path: "/finance/prepayments/booking-sync-degraded" },
  { method: "POST", path: "/finance/prepayments/booking-sync-retry" },
  { method: "GET", path: "/finance/invoices/:registrationId" },
  { method: "PUT", path: "/finance/registrations/:registrationId/obligation-override" },
  { method: "GET", path: "/finance/schedules" },
  { method: "GET", path: "/finance/schedules/:registrationId" },
  { method: "POST", path: "/finance/schedules/generate" },
  { method: "PATCH", path: "/finance/schedules/:registrationId/items/:itemId" },
  { method: "GET", path: "/finance/case/encounters/:registrationId" },
  { method: "POST", path: "/finance/case/commands/review-receipt" },
] as const;

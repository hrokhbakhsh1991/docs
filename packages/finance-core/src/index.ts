/**
 * @app-tour/finance-core — frozen public API (Phase 2.3.3).
 *
 * Stable surface for host composition and workspace adapter typing.
 * Do not `export *` — add symbols only with an intentional semver decision.
 *
 * @see test/public-api.spec.ts
 */

/* ─── Application entry points ─────────────────────────────────────────── */
export {
  buildPrepaymentDomainEventIds,
  createFinanceService,
  FinanceService,
  hashFinanceHttpIdempotencyKey,
} from "./application/finance.service";
export {
  FINANCE_LATENCY_BUDGET_MS,
  FINANCE_METRIC,
} from "./application/finance-metrics-catalog";
export type {
  FinanceApproveMetricResult,
  FinanceLatencyOperation,
  FinanceLedgerCaptureMetricResult,
  FinanceMetricName,
} from "./application/finance-metrics-catalog";

/* ─── Domain (pure) ────────────────────────────────────────────────────── */
export {
  attachFinanceRegistrationContext,
  buildPaymentScheduleItems,
  compileRegistrationInvoice,
  filterRowsByRegistrationId,
} from "./domain/index";
export type {
  CompileInvoiceBalancesInput,
  FinanceRegistrationContext,
  GenerateScheduleTemplate,
  InstallmentItemStatus,
  PaymentScheduleItem,
  PrepaymentRecord,
  RegistrationInvoiceReadModel,
} from "./domain/index";

/* ─── Application ports + consumer DTOs ────────────────────────────────── */
export type {
  ApproveManualReceiptAtomicInput,
  ApproveManualReceiptAtomicResult,
  BookingPaymentMemberOwnershipInput,
  BookingPaymentRaisePaidInTxInput,
  BookingPaymentSyncStatus,
  BookingPaymentSyncStatusInput,
  BuildPaymentCaptureJournalInput,
  BuildPrepaymentJournalInput,
  CreatePaymentInput,
  CreateReceiptInput,
  FinanceActorContext,
  FinanceActorRole,
  FinanceAuthorizationPort,
  FinanceCapabilityPort,
  FinanceClockPort,
  FinanceLedgerCapturePlan,
  FinanceLedgerJournalLine,
  FinanceLedgerOutboxRow,
  FinanceLedgerPolicyPort,
  FinanceLedgerPostingSide,
  FinanceLoggerPort,
  FinanceMembershipStatus,
  FinanceMetricsPort,
  FinanceOfflineReceiptDefaults,
  FinanceOpenPaymentRow,
  FinancePaymentRow,
  FinancePrepaymentListRow,
  FinanceReceiptDefaultsPort,
  FinanceReceiptRow,
  FinanceRegistrationDisplay,
  FinanceRepositoryPort,
  FinanceSchedulePort,
  FinanceStorageDriverPort,
  FinanceSummaryRow,
  FinanceTransactionPort,
  FinanceWorkspaceGateResult,
  IBookingPaymentPort,
  PrepaymentBookingSyncDegradedRow,
  ReceiptProofSignedUrlInput,
  ReceiptProofStoragePort,
  RecordPrepaymentAtomicInput,
  RecordPrepaymentAtomicResult,
  RegistrationDisplayPort,
  RegistrationInvoiceFacts,
  UpdateReceiptReviewInput,
} from "./ports/index";

/* ─── Frozen compatibility aliases (host façades; do not expand) ───────── */
export type {
  AmbientTenantTx,
  FinanceAccessPort,
  FinanceAuthzPort,
  FinanceLogPort,
  FinancePersistenceModePort,
  FinanceReceiptProofSignedUrlInput,
  FinanceReceiptProofUrlPort,
  FinanceStoragePort,
  FinanceTransaction,
} from "./ports/index";

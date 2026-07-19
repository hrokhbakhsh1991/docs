/**
 * Compatibility façade — domain repository types only (Phase 1.21).
 * Prefer importing from `./ports/finance-repository.port`.
 * Construct via `createFinanceRepository` (composition) or the Prisma adapter under `infrastructure/`.
 */

export type {
  ApproveManualReceiptAtomicInput,
  ApproveManualReceiptAtomicResult,
  CreatePaymentInput,
  CreateReceiptInput,
  FinanceLedgerOutboxRow,
  FinanceOpenPaymentRow,
  FinancePaymentRow,
  FinancePrepaymentListRow,
  FinanceReceiptRow,
  FinanceRepositoryPort,
  FinanceSummaryRow,
  PrepaymentBookingSyncDegradedRow,
  RecordPrepaymentAtomicInput,
  RecordPrepaymentAtomicResult,
  RegistrationInvoiceFacts,
  UpdateReceiptReviewInput,
} from "./ports/finance-repository.port";

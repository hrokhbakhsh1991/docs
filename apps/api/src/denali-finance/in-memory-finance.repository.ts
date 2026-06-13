import type {
  CreatePaymentInput,
  CreateReceiptInput,
  FinanceLedgerOutboxRow,
  FinanceOpenPaymentRow,
  FinancePaymentRow,
  FinanceReceiptRow,
  FinanceSummaryRow,
} from "./finance.repository";

function financeMemoryWritesForbidden(): never {
  throw new Error("FINANCE_MEMORY_DRIVER_READ_ONLY");
}

export class InMemoryFinanceRepository {
  async getSummary(_tenantId: string): Promise<FinanceSummaryRow> {
    return {
      pendingManualPayments: 0,
      pendingReceiptReviews: 0,
      paidPayments: 0,
      failedPayments: 0,
    };
  }

  async listOpenPayments(_tenantId: string, _limit: number): Promise<FinanceOpenPaymentRow[]> {
    return [];
  }

  async listPayments(_tenantId: string, _limit: number): Promise<FinancePaymentRow[]> {
    return [];
  }

  async listLedgerEvents(_tenantId: string, _limit: number): Promise<FinanceLedgerOutboxRow[]> {
    return [];
  }

  async findPaymentStatusesByRegistration(
    _tenantId: string,
    _registrationId: string
  ): Promise<readonly string[]> {
    return [];
  }

  async createManualPayment(_input: CreatePaymentInput): Promise<FinancePaymentRow> {
    financeMemoryWritesForbidden();
  }

  async findPaymentById(_tenantId: string, _paymentId: string): Promise<FinancePaymentRow | null> {
    return null;
  }

  async countPendingReceiptsForPayment(_tenantId: string, _paymentId: string): Promise<number> {
    return 0;
  }

  async createReceipt(_input: CreateReceiptInput): Promise<FinanceReceiptRow> {
    financeMemoryWritesForbidden();
  }

  async findReceiptById(_tenantId: string, _receiptId: string): Promise<FinanceReceiptRow | null> {
    return null;
  }

  async listPendingReceipts(_tenantId: string, _limit: number): Promise<FinanceReceiptRow[]> {
    return [];
  }

  async updateReceiptReview(
    _tenantId: string,
    _receiptId: string,
    _input: {
      readonly status: "Approved" | "Rejected";
      readonly reviewedByUserId: string;
      readonly reviewNote?: string;
      readonly ledgerJournalId?: string;
    }
  ): Promise<FinanceReceiptRow> {
    financeMemoryWritesForbidden();
  }

  async markPaymentPaid(
    _tenantId: string,
    _paymentId: string,
    _ledgerJournalId: string
  ): Promise<FinancePaymentRow> {
    financeMemoryWritesForbidden();
  }

  async listPrepayments(_tenantId: string, _limit: number): Promise<
    readonly {
      id: string;
      registrationId: string;
      amountMinor: string;
      currency: string;
      method: string;
      note: string | null;
      recordedAt: string;
    }[]
  > {
    return [];
  }

  async recordPrepayment(_input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly amountMinor: string;
    readonly currency: string;
    readonly method: string;
    readonly note: string | null;
    readonly journalId: string;
    readonly recordedAt: string;
  }) {
    financeMemoryWritesForbidden();
  }

  async getRegistrationInvoiceFacts(
    _tenantId: string,
    _registrationId: string
  ): Promise<{
    readonly prepaymentMinor: string;
    readonly paidPaymentsMinor: string;
    readonly paymentAmountsMinor: readonly string[];
    readonly currency: string;
  }> {
    return {
      prepaymentMinor: "0",
      paidPaymentsMinor: "0",
      paymentAmountsMinor: [],
      currency: "IRR",
    };
  }
}

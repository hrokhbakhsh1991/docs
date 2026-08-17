import type { RegistrationInvoice } from "@/finance/finance-invoice-logic";
import type { PaymentScheduleItem } from "@/finance/finance-installments-logic";
import type { FinancePaymentRow } from "@/finance/finance-payments-logic";
import type { FinancePendingReceipt } from "@/finance/finance-receipts-logic";

export type TourWorkspacePaymentSummaryStatus =
  | "needs_payment"
  | "payment_under_review"
  | "paid_in_full"
  | "no_payment_required"
  | "overdue"
  | "credit_balance"
  | "unknown";

export type TourWorkspaceCurrentRequirement =
  | {
      readonly kind: "none";
      readonly amountMinor: "0";
      readonly dueAt: null;
      readonly source: "none";
    }
  | {
      readonly kind: "schedule_item";
      readonly amountMinor: string;
      readonly dueAt: string | null;
      readonly source: "schedule";
      readonly scheduleItemId: string;
      readonly label: string;
      readonly status: PaymentScheduleItem["status"];
    }
  | {
      readonly kind: "balance_due";
      readonly amountMinor: string;
      readonly dueAt: null;
      readonly source: "invoice";
    };

export type TourWorkspacePaymentEvidenceSummary = {
  readonly pendingReceiptsCount: number;
  readonly pendingManualPaymentsCount: number;
  readonly paidPaymentsCount: number;
  readonly cancelledPaymentsCount: number;
  readonly latestReceiptAt: string | null;
};

export type TourWorkspacePaymentDetailState = {
  readonly summaryStatus: TourWorkspacePaymentSummaryStatus;
  readonly currentRequirement: TourWorkspaceCurrentRequirement;
  readonly evidence: TourWorkspacePaymentEvidenceSummary;
};

function parseMinor(raw: string | null | undefined): bigint {
  const digits = (raw ?? "").trim();
  if (!/^-?\d+$/.test(digits)) {
    return BigInt(0);
  }
  return BigInt(digits);
}

function earliestOpenScheduleItem(
  schedule: readonly PaymentScheduleItem[]
): PaymentScheduleItem | null {
  const open = schedule.filter((item) => item.status !== "paid" && item.status !== "waived");
  if (open.length === 0) {
    return null;
  }
  return [...open].sort((a, b) => {
    const aTime = new Date(a.dueAt).getTime();
    const bTime = new Date(b.dueAt).getTime();
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
      return a.sequence - b.sequence;
    }
    if (Number.isNaN(aTime)) {
      return 1;
    }
    if (Number.isNaN(bTime)) {
      return -1;
    }
    return aTime - bTime || a.sequence - b.sequence;
  })[0]!;
}

function hasOverdueScheduleItem(schedule: readonly PaymentScheduleItem[], now: Date): boolean {
  return schedule.some((item) => {
    if (item.status === "overdue") {
      return true;
    }
    if (item.status === "paid" || item.status === "waived") {
      return false;
    }
    const dueAtMs = new Date(item.dueAt).getTime();
    return !Number.isNaN(dueAtMs) && dueAtMs < now.getTime();
  });
}

export function resolveTourWorkspaceCurrentRequirement(input: {
  readonly invoice: RegistrationInvoice | null;
  readonly schedule: readonly PaymentScheduleItem[];
}): TourWorkspaceCurrentRequirement {
  const openScheduleItem = earliestOpenScheduleItem(input.schedule);
  if (openScheduleItem !== null) {
    const remainingMinor =
      parseMinor(openScheduleItem.amountMinor) - parseMinor(openScheduleItem.paidMinor);
    return {
      kind: "schedule_item",
      amountMinor: (remainingMinor > BigInt(0) ? remainingMinor : BigInt(0)).toString(),
      dueAt: openScheduleItem.dueAt.trim().length > 0 ? openScheduleItem.dueAt : null,
      source: "schedule",
      scheduleItemId: openScheduleItem.id,
      label: openScheduleItem.label,
      status: openScheduleItem.status,
    };
  }

  if (input.invoice === null) {
    return {
      kind: "none",
      amountMinor: "0",
      dueAt: null,
      source: "none",
    };
  }

  const balanceDue = parseMinor(input.invoice.balanceDueMinor);
  if (balanceDue <= BigInt(0)) {
    return {
      kind: "none",
      amountMinor: "0",
      dueAt: null,
      source: "none",
    };
  }

  return {
    kind: "balance_due",
    amountMinor: balanceDue.toString(),
    dueAt: null,
    source: "invoice",
  };
}

export function summarizeTourWorkspacePaymentEvidence(input: {
  readonly payments: readonly FinancePaymentRow[];
  readonly receipts: readonly FinancePendingReceipt[];
}): TourWorkspacePaymentEvidenceSummary {
  const pendingManualPaymentsCount = input.payments.filter(
    (row) =>
      row.method.trim().toLowerCase() === "manual" && row.status.trim().toLowerCase() === "pending"
  ).length;
  const paidPaymentsCount = input.payments.filter(
    (row) => row.status.trim().toLowerCase() === "paid"
  ).length;
  const cancelledPaymentsCount = input.payments.filter(
    (row) => row.status.trim().toLowerCase() === "cancelled"
  ).length;
  const latestReceiptAt =
    [...input.receipts]
      .map((row) => row.createdAt)
      .filter((value) => value.trim().length > 0)
      .sort()
      .at(-1) ?? null;

  return {
    pendingReceiptsCount: input.receipts.length,
    pendingManualPaymentsCount,
    paidPaymentsCount,
    cancelledPaymentsCount,
    latestReceiptAt,
  };
}

export function resolveTourWorkspacePaymentSummaryStatus(input: {
  readonly invoice: RegistrationInvoice | null;
  readonly payments: readonly FinancePaymentRow[];
  readonly receipts: readonly FinancePendingReceipt[];
  readonly schedule: readonly PaymentScheduleItem[];
  readonly now?: Date;
}): TourWorkspacePaymentSummaryStatus {
  const now = input.now ?? new Date();
  if (input.invoice === null) {
    return "unknown";
  }

  const invoiceTotal = parseMinor(input.invoice.invoiceTotalMinor);
  const walletNet = parseMinor(input.invoice.walletNetMinor);
  const balanceDue = parseMinor(input.invoice.balanceDueMinor);

  if (invoiceTotal <= BigInt(0)) {
    return "no_payment_required";
  }
  if (walletNet > invoiceTotal) {
    return "credit_balance";
  }
  if (balanceDue <= BigInt(0)) {
    return "paid_in_full";
  }
  if (input.receipts.length > 0) {
    return "payment_under_review";
  }
  if (hasOverdueScheduleItem(input.schedule, now)) {
    return "overdue";
  }
  return "needs_payment";
}

/**
 * PAY-FIN-03 — while invoice/payments/schedule are still in flight, do not build a
 * detail state from list receipts alone (that falsely yields requirement "none").
 */
export function shouldBuildTourWorkspacePaymentDetailState(input: {
  readonly loading: boolean;
  readonly invoice: RegistrationInvoice | null;
  readonly payments: readonly FinancePaymentRow[];
  readonly schedule: readonly PaymentScheduleItem[];
  readonly receipts: readonly FinancePendingReceipt[];
}): boolean {
  if (input.loading) {
    return false;
  }
  return !(
    input.invoice === null &&
    input.payments.length === 0 &&
    input.schedule.length === 0 &&
    input.receipts.length === 0
  );
}

export function buildTourWorkspacePaymentDetailState(input: {
  readonly invoice: RegistrationInvoice | null;
  readonly payments: readonly FinancePaymentRow[];
  readonly receipts: readonly FinancePendingReceipt[];
  readonly schedule: readonly PaymentScheduleItem[];
  readonly now?: Date;
}): TourWorkspacePaymentDetailState {
  return {
    summaryStatus: resolveTourWorkspacePaymentSummaryStatus(input),
    currentRequirement: resolveTourWorkspaceCurrentRequirement({
      invoice: input.invoice,
      schedule: input.schedule,
    }),
    evidence: summarizeTourWorkspacePaymentEvidence({
      payments: input.payments,
      receipts: input.receipts,
    }),
  };
}

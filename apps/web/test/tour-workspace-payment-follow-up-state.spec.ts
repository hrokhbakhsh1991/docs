import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { RegistrationInvoice } from "../src/finance/finance-invoice-logic";
import type { PaymentScheduleItem } from "../src/finance/finance-installments-logic";
import type { FinancePaymentRow } from "../src/finance/finance-payments-logic";
import type { FinancePendingReceipt } from "../src/finance/finance-receipts-logic";
import {
  buildTourWorkspacePaymentDetailState,
  resolveTourWorkspaceCurrentRequirement,
  resolveTourWorkspacePaymentSummaryStatus,
  shouldBuildTourWorkspacePaymentDetailState,
  summarizeTourWorkspacePaymentEvidence,
} from "../src/features/tours/tour-workspace-payment-follow-up-state";

const REGISTRATION_ID = "00000000-0000-4000-8000-000000000111";
const NOW = new Date("2026-08-13T12:00:00.000Z");

function invoice(overrides: Partial<RegistrationInvoice> = {}): RegistrationInvoice {
  return {
    registrationId: REGISTRATION_ID,
    currency: "IRR",
    invoiceTotalMinor: "100",
    paidAmountMinor: "0",
    balanceDueMinor: "100",
    walletNetMinor: "0",
    ...overrides,
  };
}

function scheduleItem(overrides: Partial<PaymentScheduleItem> = {}): PaymentScheduleItem {
  return {
    id: "sch-1",
    registrationId: REGISTRATION_ID,
    sequence: 1,
    label: "Deposit",
    dueAt: "2026-08-20T00:00:00.000Z",
    amountMinor: "40",
    paidMinor: "0",
    status: "due",
    registrationContext: null,
    ...overrides,
  };
}

function payment(overrides: Partial<FinancePaymentRow> = {}): FinancePaymentRow {
  return {
    id: "pay-1",
    registrationId: REGISTRATION_ID,
    amount: "50",
    currency: "IRR",
    method: "Manual",
    status: "Pending",
    provider: "manual",
    paidAt: null,
    createdAt: "2026-08-13T10:00:00.000Z",
    registrationContext: null,
    ...overrides,
  };
}

function receipt(overrides: Partial<FinancePendingReceipt> = {}): FinancePendingReceipt {
  return {
    id: "rcpt-1",
    paymentId: "pay-1",
    fileKey: "receipts/demo.jpg",
    status: "Pending",
    note: null,
    createdAt: "2026-08-13T11:00:00.000Z",
    payment: {
      id: "pay-1",
      registrationId: REGISTRATION_ID,
      amount: "50",
      currency: "IRR",
      method: "Manual",
      status: "Pending",
    },
    registrationContext: null,
    ...overrides,
  };
}

describe("tour-workspace-payment-follow-up-state.spec.ts", () => {
  it("marks zero-total registrations as no payment required", () => {
    assert.equal(
      resolveTourWorkspacePaymentSummaryStatus({
        invoice: invoice({
          invoiceTotalMinor: "0",
          paidAmountMinor: "0",
          balanceDueMinor: "0",
          walletNetMinor: "0",
        }),
        payments: [],
        receipts: [],
        schedule: [],
        now: NOW,
      }),
      "no_payment_required"
    );
  });

  it("marks fully settled registrations as paid in full", () => {
    assert.equal(
      resolveTourWorkspacePaymentSummaryStatus({
        invoice: invoice({
          paidAmountMinor: "100",
          balanceDueMinor: "0",
          walletNetMinor: "100",
        }),
        payments: [payment({ status: "Paid", paidAt: "2026-08-13T10:00:00.000Z" })],
        receipts: [],
        schedule: [],
        now: NOW,
      }),
      "paid_in_full"
    );
  });

  it("marks registrations with pending receipts as payment under review", () => {
    assert.equal(
      resolveTourWorkspacePaymentSummaryStatus({
        invoice: invoice({
          paidAmountMinor: "50",
          balanceDueMinor: "50",
          walletNetMinor: "50",
        }),
        payments: [payment()],
        receipts: [receipt()],
        schedule: [],
        now: NOW,
      }),
      "payment_under_review"
    );
  });

  it("keeps pending-receipt cases under review even when a schedule is overdue", () => {
    assert.equal(
      resolveTourWorkspacePaymentSummaryStatus({
        invoice: invoice({
          paidAmountMinor: "50",
          balanceDueMinor: "50",
          walletNetMinor: "50",
        }),
        payments: [payment()],
        receipts: [receipt()],
        schedule: [scheduleItem({ dueAt: "2026-08-01T00:00:00.000Z", status: "overdue" })],
        now: NOW,
      }),
      "payment_under_review"
    );
  });

  it("marks overdue schedules as overdue", () => {
    assert.equal(
      resolveTourWorkspacePaymentSummaryStatus({
        invoice: invoice({
          paidAmountMinor: "50",
          balanceDueMinor: "50",
          walletNetMinor: "50",
        }),
        payments: [],
        receipts: [],
        schedule: [scheduleItem({ dueAt: "2026-08-01T00:00:00.000Z", status: "due" })],
        now: NOW,
      }),
      "overdue"
    );
  });

  it("marks partially paid registrations without receipt review as needs payment", () => {
    assert.equal(
      resolveTourWorkspacePaymentSummaryStatus({
        invoice: invoice({
          paidAmountMinor: "50",
          balanceDueMinor: "50",
          walletNetMinor: "50",
        }),
        payments: [payment({ status: "Paid", paidAt: "2026-08-12T00:00:00.000Z" })],
        receipts: [],
        schedule: [],
        now: NOW,
      }),
      "needs_payment"
    );
  });

  it("uses the earliest open schedule item as the current requirement", () => {
    const requirement = resolveTourWorkspaceCurrentRequirement({
      invoice: invoice({
        paidAmountMinor: "30",
        balanceDueMinor: "70",
        walletNetMinor: "30",
      }),
      schedule: [
        scheduleItem({
          id: "sch-2",
          sequence: 2,
          label: "Final balance",
          dueAt: "2026-09-01T00:00:00.000Z",
          amountMinor: "60",
          paidMinor: "0",
          status: "scheduled",
        }),
        scheduleItem({
          id: "sch-1",
          sequence: 1,
          label: "Deposit",
          dueAt: "2026-08-15T00:00:00.000Z",
          amountMinor: "40",
          paidMinor: "10",
          status: "partial",
        }),
      ],
    });
    assert.deepEqual(requirement, {
      kind: "schedule_item",
      amountMinor: "30",
      dueAt: "2026-08-15T00:00:00.000Z",
      source: "schedule",
      scheduleItemId: "sch-1",
      label: "Deposit",
      status: "partial",
    });
  });

  it("falls back to invoice balance due when no open schedule exists", () => {
    const requirement = resolveTourWorkspaceCurrentRequirement({
      invoice: invoice({
        paidAmountMinor: "50",
        balanceDueMinor: "50",
        walletNetMinor: "50",
      }),
      schedule: [],
    });
    assert.deepEqual(requirement, {
      kind: "balance_due",
      amountMinor: "50",
      dueAt: null,
      source: "invoice",
    });
  });

  it("summarizes payment evidence counts cleanly", () => {
    assert.deepEqual(
      summarizeTourWorkspacePaymentEvidence({
        payments: [
          payment(),
          payment({ id: "pay-2", status: "Paid", paidAt: "2026-08-13T10:00:00.000Z" }),
          payment({ id: "pay-3", status: "Cancelled" }),
        ],
        receipts: [
          receipt({ id: "rcpt-1", createdAt: "2026-08-12T11:00:00.000Z" }),
          receipt({ id: "rcpt-2", createdAt: "2026-08-13T11:00:00.000Z" }),
        ],
      }),
      {
        pendingReceiptsCount: 2,
        pendingManualPaymentsCount: 1,
        paidPaymentsCount: 1,
        cancelledPaymentsCount: 1,
        latestReceiptAt: "2026-08-13T11:00:00.000Z",
      }
    );
  });

  it("PAY-FIN-03 — does not build detail state from receipts alone while loading", () => {
    assert.equal(
      shouldBuildTourWorkspacePaymentDetailState({
        loading: true,
        invoice: null,
        payments: [],
        schedule: [],
        receipts: [receipt()],
      }),
      false
    );
    assert.equal(
      shouldBuildTourWorkspacePaymentDetailState({
        loading: false,
        invoice: null,
        payments: [],
        schedule: [],
        receipts: [receipt()],
      }),
      true
    );
    const premature = buildTourWorkspacePaymentDetailState({
      invoice: null,
      payments: [],
      receipts: [receipt()],
      schedule: [],
      now: NOW,
    });
    assert.equal(premature.currentRequirement.kind, "none");
    assert.equal(premature.currentRequirement.amountMinor, "0");
  });

  it("builds a coherent detail state for a partial-paid guest under review", () => {
    const state = buildTourWorkspacePaymentDetailState({
      invoice: invoice({
        paidAmountMinor: "50",
        balanceDueMinor: "50",
        walletNetMinor: "50",
      }),
      payments: [payment()],
      receipts: [receipt()],
      schedule: [],
      now: NOW,
    });

    assert.equal(state.summaryStatus, "payment_under_review");
    assert.deepEqual(state.currentRequirement, {
      kind: "balance_due",
      amountMinor: "50",
      dueAt: null,
      source: "invoice",
    });
    assert.equal(state.evidence.pendingReceiptsCount, 1);
  });

  it("maps zero-balance obligation override as settled with no current requirement", () => {
    const state = buildTourWorkspacePaymentDetailState({
      invoice: invoice({
        invoiceTotalMinor: "100",
        paidAmountMinor: "0",
        balanceDueMinor: "0",
        walletNetMinor: "0",
      }),
      payments: [],
      receipts: [],
      schedule: [],
      now: NOW,
    });

    assert.equal(state.summaryStatus, "paid_in_full");
    assert.equal(state.currentRequirement.kind, "none");
    assert.equal(state.currentRequirement.amountMinor, "0");
  });
});

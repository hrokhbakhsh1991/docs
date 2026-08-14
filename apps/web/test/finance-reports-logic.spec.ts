/**
 * Phase 9.7 R1 + PR21-B1 — finance overview / ledger logic (CP-9.7-06).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINANCE_LEDGER_TEST_IDS,
  buildFinanceAttentionSamples,
  buildFinanceKpiCards,
  buildFinanceLedgerCsvContent,
  buildFinanceLedgerCsvFilename,
  formatLedgerEventLabel,
  parseFinanceLedgerListResponse,
  parseFinanceSummary,
  toFinanceLedgerCsvRows,
} from "../src/finance/finance-reports-logic";

describe("finance-reports-logic.spec.ts — Phase 9.7 R1 / PR21-B1", () => {
  it("WEB-9.7-R1-01 parseFinanceSummary normalizes counts", () => {
    const summary = parseFinanceSummary({
      pendingManualPayments: 2,
      pendingReceiptReviews: 1,
      paidPayments: 10,
      failedPayments: 0,
    });
    assert.equal(summary.pendingManualPayments, 2);
    assert.equal(summary.paidPayments, 10);
  });

  it("PR21-B1: buildFinanceKpiCards omits overdue when installments disabled (default)", () => {
    const cards = buildFinanceKpiCards(parseFinanceSummary({ pendingManualPayments: 1 }), 3);
    assert.equal(cards.some((card) => card.id === "overdue-installments"), false);
    assert.equal(cards.find((card) => card.id === "pending-manual")?.value, 1);
    assert.ok(cards.some((card) => card.id === "paid-payments"));
    assert.equal(
      cards.some((card) => card.href?.includes("tab=installments")),
      false
    );
  });

  it("PR21-B1: buildFinanceKpiCards includes overdue only when includeInstallments", () => {
    const cards = buildFinanceKpiCards(parseFinanceSummary({ pendingManualPayments: 1 }), 3, {
      includeInstallments: true,
    });
    assert.equal(cards.length, 4);
    const overdue = cards.find((card) => card.id === "overdue-installments");
    assert.equal(overdue?.value, 3);
    assert.equal(overdue?.href, "/finance?tab=installments");
  });

  it("WEB-9.7-R1-03 parseFinanceLedgerListResponse maps items", () => {
    const parsed = parseFinanceLedgerListResponse({
      items: [
        {
          outboxEventId: "evt-1",
          eventType: "finance.ledger.double_entry_applied",
          journalId: "j-1",
          registrationId: "reg-1",
          lineCount: 2,
          createdAt: "2026-06-09T12:00:00.000Z",
        },
      ],
    });
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0]?.lineCount, 2);
  });

  it("WEB-9.7-R1-04 formatLedgerEventLabel strips prefix", () => {
    assert.equal(
      formatLedgerEventLabel("finance.ledger.double_entry_applied"),
      "double entry applied"
    );
  });

  it("WEB-9.7-R4-01 buildFinanceLedgerCsvContent exports loaded ledger rows", () => {
    const csv = buildFinanceLedgerCsvContent(
      toFinanceLedgerCsvRows([
        {
          outboxEventId: "evt-1",
          eventType: "finance.ledger.double_entry_applied",
          journalId: "j-1",
          registrationId: "reg-1",
          domainEventId: "dom-1",
          lineCount: 2,
          createdAt: "2026-06-09T12:00:00.000Z",
        },
      ])
    );
    assert.ok(csv.startsWith("outboxEventId,eventType,journalId"));
    assert.ok(csv.includes("evt-1,finance.ledger.double_entry_applied,j-1,reg-1,dom-1,2"));
  });

  it("WEB-9.7-R4-02 ledger export landmarks and filename are stable", () => {
    assert.equal(FINANCE_LEDGER_TEST_IDS.exportCsv, "finance-ledger-export-csv");
    assert.equal(FINANCE_LEDGER_TEST_IDS.emptyState, "finance-ledger-empty");
    assert.equal(
      buildFinanceLedgerCsvFilename("00000000", new Date("2026-06-09T12:00:00.000Z")),
      "finance-ledger-00000000-2026-06-09.csv"
    );
  });

  it("PR21-B1: attention excludes overdue and prioritizes receipt before manual when installments off", () => {
    const samples = buildFinanceAttentionSamples({
      overdueInstallments: [
        {
          id: "sch-1",
          registrationId: "reg-a",
          label: "Installment 1",
          registrationContext: {
            registrationId: "reg-a",
            tourId: "tour-1",
            tourTitle: "Alborz",
            memberDisplayName: "Ada",
          },
        },
      ],
      pendingReceipts: [
        {
          id: "rcpt-1",
          registrationId: "reg-b",
          registrationContext: null,
        },
      ],
      pendingManualPayments: [
        {
          id: "pay-1",
          registrationId: "reg-c",
          status: "Pending",
          registrationContext: null,
        },
        {
          id: "pay-2",
          registrationId: "reg-d",
          status: "Paid",
          registrationContext: null,
        },
      ],
      limit: 3,
      includeInstallments: false,
    });
    assert.equal(samples.length, 2);
    assert.equal(samples[0]?.kind, "pending-receipt");
    assert.equal(samples[1]?.kind, "pending-manual");
    assert.equal(samples[1]?.registrationId, "reg-c");
    assert.equal(samples.some((s) => s.kind === "overdue-installment"), false);
    assert.equal(samples.some((s) => s.href.includes("tab=installments")), false);
  });

  it("PR21-B1: attention preserves registrationId on receipt and payment hrefs", () => {
    const samples = buildFinanceAttentionSamples({
      overdueInstallments: [],
      pendingReceipts: [{ id: "rcpt-1", registrationId: "reg-receipt-uuid", registrationContext: null }],
      pendingManualPayments: [
        { id: "pay-1", registrationId: "reg-payment-uuid", status: "Pending", registrationContext: null },
      ],
      includeInstallments: false,
    });
    assert.equal(
      samples[0]?.href,
      "/finance?tab=receipts&registrationId=reg-receipt-uuid"
    );
    assert.equal(
      samples[1]?.href,
      "/finance?tab=payments&registrationId=reg-payment-uuid"
    );
  });

  it("PR21-B1: when installments enabled, overdue remains first and keeps registrationId", () => {
    const samples = buildFinanceAttentionSamples({
      overdueInstallments: [
        {
          id: "sch-1",
          registrationId: "reg-a",
          label: "Installment 1",
          registrationContext: {
            registrationId: "reg-a",
            tourId: "tour-1",
            tourTitle: "Alborz",
            memberDisplayName: "Ada",
          },
        },
      ],
      pendingReceipts: [
        {
          id: "rcpt-1",
          registrationId: "reg-b",
          registrationContext: null,
        },
      ],
      pendingManualPayments: [
        {
          id: "pay-1",
          registrationId: "reg-c",
          status: "Pending",
          registrationContext: null,
        },
      ],
      limit: 3,
      includeInstallments: true,
    });
    assert.equal(samples.length, 3);
    assert.equal(samples[0]?.kind, "overdue-installment");
    assert.equal(samples[0]?.registrationContext?.tourTitle, "Alborz");
    assert.equal(
      samples[0]?.href,
      "/finance?tab=installments&registrationId=reg-a"
    );
    assert.equal(samples[1]?.kind, "pending-receipt");
    assert.equal(samples[2]?.kind, "pending-manual");
  });
});

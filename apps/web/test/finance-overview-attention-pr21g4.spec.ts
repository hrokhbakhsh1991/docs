/**
 * PR21-G4 — Overview attention preview overflow (structural + logic).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  FINANCE_ATTENTION_SAMPLE_LIMIT,
  FINANCE_OVERVIEW_TEST_IDS,
  buildFinanceAttentionSamples,
  buildFinanceKpiCards,
  parseFinanceSummary,
  resolveFinanceAttentionOverflow,
} from "../src/finance/finance-reports-logic";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("finance-overview PR21-G4", () => {
  it("G4: attention preview limit remains 3", () => {
    assert.equal(FINANCE_ATTENTION_SAMPLE_LIMIT, 3);
    const manyManuals = Array.from({ length: 10 }, (_, i) => ({
      id: `pay-${i}`,
      registrationId: `reg-${i}`,
      status: "Pending",
      registrationContext: null,
    }));
    const samples = buildFinanceAttentionSamples({
      overdueInstallments: [],
      pendingReceipts: [],
      pendingManualPayments: manyManuals,
      includeInstallments: false,
    });
    assert.equal(samples.length, 3);
  });

  it("G4: overflow count when KPI exceeds shown manuals", () => {
    const samples = buildFinanceAttentionSamples({
      overdueInstallments: [],
      pendingReceipts: [],
      pendingManualPayments: [
        { id: "p1", registrationId: "r1", status: "Pending", registrationContext: null },
        { id: "p2", registrationId: "r2", status: "Pending", registrationContext: null },
        { id: "p3", registrationId: "r3", status: "Pending", registrationContext: null },
      ],
      includeInstallments: false,
    });
    const overflow = resolveFinanceAttentionOverflow({
      samples,
      pendingManualTotal: 22,
      pendingReceiptTotal: 0,
      overdueInstallmentTotal: 0,
      includeInstallments: false,
    });
    assert.equal(overflow.shownCount, 3);
    assert.equal(overflow.morePendingManual, 19);
    assert.equal(overflow.morePendingReceipt, 0);
    assert.equal(overflow.hasOverflow, true);
  });

  it("G4: no overflow when all items fit in preview", () => {
    const samples = buildFinanceAttentionSamples({
      overdueInstallments: [],
      pendingReceipts: [
        { id: "rcpt-1", registrationId: "reg-b", registrationContext: null },
      ],
      pendingManualPayments: [
        { id: "pay-1", registrationId: "reg-c", status: "Pending", registrationContext: null },
      ],
      includeInstallments: false,
    });
    const overflow = resolveFinanceAttentionOverflow({
      samples,
      pendingManualTotal: 1,
      pendingReceiptTotal: 1,
      overdueInstallmentTotal: 0,
      includeInstallments: false,
    });
    assert.equal(overflow.hasOverflow, false);
    assert.equal(overflow.morePendingManual, 0);
    assert.equal(overflow.morePendingReceipt, 0);
  });

  it("G4: kind-aware overflow — receipts and manuals separately", () => {
    const samples = buildFinanceAttentionSamples({
      overdueInstallments: [],
      pendingReceipts: [
        { id: "rcpt-1", registrationId: "reg-b", registrationContext: null },
      ],
      pendingManualPayments: [
        { id: "pay-1", registrationId: "reg-c", status: "Pending", registrationContext: null },
        { id: "pay-2", registrationId: "reg-d", status: "Pending", registrationContext: null },
      ],
      includeInstallments: false,
    });
    const overflow = resolveFinanceAttentionOverflow({
      samples,
      pendingManualTotal: 22,
      pendingReceiptTotal: 5,
      overdueInstallmentTotal: 0,
      includeInstallments: false,
    });
    assert.equal(overflow.shownCount, 3);
    assert.equal(overflow.morePendingReceipt, 4);
    assert.equal(overflow.morePendingManual, 20);
  });

  it("G4: sample destinations — receipt→Receipts, manual→Payments; registrationId preserved", () => {
    const samples = buildFinanceAttentionSamples({
      overdueInstallments: [],
      pendingReceipts: [
        { id: "rcpt-1", registrationId: "reg-receipt-uuid", registrationContext: null },
      ],
      pendingManualPayments: [
        {
          id: "pay-1",
          registrationId: "reg-payment-uuid",
          status: "Pending",
          registrationContext: null,
        },
      ],
      includeInstallments: false,
    });
    assert.equal(samples[0]?.kind, "pending-receipt");
    assert.match(samples[0]?.href ?? "", /tab=receipts/);
    assert.match(samples[0]?.href ?? "", /registrationId=reg-receipt-uuid/);
    assert.equal(samples[1]?.kind, "pending-manual");
    assert.match(samples[1]?.href ?? "", /tab=payments/);
    assert.match(samples[1]?.href ?? "", /registrationId=reg-payment-uuid/);
  });

  it("G4: panel wires overflow + compact identity; overflow destinations are aggregate tabs", () => {
    const panel = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-overview-panel.tsx"),
      "utf8"
    );
    assert.match(panel, /resolveFinanceAttentionOverflow/);
    assert.match(panel, /FINANCE_OVERVIEW_TEST_IDS\.attentionOverflow/);
    assert.match(panel, /FINANCE_OVERVIEW_TEST_IDS\.attentionMorePayments/);
    assert.match(panel, /FINANCE_OVERVIEW_TEST_IDS\.attentionMoreReceipts/);
    assert.match(panel, /density="compact"/);
    assert.match(panel, /href="\/finance\?tab=payments"/);
    assert.match(panel, /href="\/finance\?tab=receipts"/);
    assert.match(panel, /kpiOpenPaymentsList/);
    // No new invoice/payment fetches beyond existing overview loads.
    assert.equal((panel.match(/fetch\("\/api\/finance\/payments/g) ?? []).length, 1);
    assert.doesNotMatch(panel, /fetchRegistrationInvoice|\/api\/finance\/invoices/);
    assert.equal(FINANCE_OVERVIEW_TEST_IDS.attentionOverflow, "finance-attention-overflow");
  });

  it("G4: KPI aggregate semantics unchanged (hrefs + values)", () => {
    const cards = buildFinanceKpiCards(
      parseFinanceSummary({
        pendingManualPayments: 22,
        pendingReceiptReviews: 5,
        paidPayments: 51,
      }),
      0,
      { includeInstallments: false }
    );
    assert.equal(cards.find((c) => c.id === "pending-manual")?.value, 22);
    assert.equal(cards.find((c) => c.id === "pending-manual")?.href, "/finance?tab=payments");
    assert.equal(cards.find((c) => c.id === "pending-receipts")?.href, "/finance?tab=receipts");
    assert.equal(cards.find((c) => c.id === "paid-payments")?.value, 51);
    assert.equal(cards.find((c) => c.id === "paid-payments")?.href, undefined);
  });

  it("G4 safety: overview does not import FinanceService or finance-core", () => {
    const panel = readFileSync(
      resolve(WEB_ROOT, "src/finance/finance-overview-panel.tsx"),
      "utf8"
    );
    const logic = readFileSync(resolve(WEB_ROOT, "src/finance/finance-reports-logic.ts"), "utf8");
    assert.doesNotMatch(panel, /FinanceService|@app-cloud\/finance-core/);
    assert.doesNotMatch(logic, /FinanceService|@app-cloud\/finance-core/);
  });
});

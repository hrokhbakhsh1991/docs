/**
 * Phase 9.7 R1 — reconciliation triage findings board (REQ-P9-072 · CP-9.7-05).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildReconciliationFindings,
  hasOpenReconciliationFindings,
  RECONCILIATION_TRIAGE_TEST_IDS,
} from "../src/finance/reconciliation-triage-logic";

describe("reconciliation-triage.spec.ts — Phase 9.7", () => {
  it("WEB-9.7-TRI-01 exposes triage test ids", () => {
    assert.equal(RECONCILIATION_TRIAGE_TEST_IDS.page, "operator-reconciliation-triage-page");
    assert.equal(RECONCILIATION_TRIAGE_TEST_IDS.findingsList, "operator-reconciliation-findings-list");
    assert.equal(RECONCILIATION_TRIAGE_TEST_IDS.findingCard, "operator-reconciliation-finding-card");
    assert.equal(RECONCILIATION_TRIAGE_TEST_IDS.emptyState, "operator-reconciliation-empty-state");
  });

  it("WEB-9.7-TRI-02 builds findings from finance summary and overdue installments", () => {
    const findings = buildReconciliationFindings(
      {
        pendingManualPayments: 2,
        pendingReceiptReviews: 1,
        paidPayments: 5,
        failedPayments: 1,
      },
      3
    );
    assert.equal(findings.length, 4);
    assert.equal(hasOpenReconciliationFindings(findings), true);
    assert.equal(findings[0]?.id, "pending-receipt-reviews");
    assert.equal(findings[0]?.actionHref, "/finance?tab=receipts");
    assert.ok(findings.some((finding) => finding.id === "overdue-installments"));
    assert.equal(hasOpenReconciliationFindings(buildReconciliationFindings({
      pendingManualPayments: 0,
      pendingReceiptReviews: 0,
      paidPayments: 0,
      failedPayments: 0,
    }, 0)), false);
  });

  it("WEB-9.7-TRI-03 flags ledger journal gap when paid payments lack journal events (R4 KPI)", () => {
    const findings = buildReconciliationFindings(
      {
        pendingManualPayments: 0,
        pendingReceiptReviews: 0,
        paidPayments: 3,
        failedPayments: 0,
      },
      0,
      0
    );
    assert.equal(findings.length, 1);
    assert.equal(findings[0]?.id, "ledger-journal-gap");
    assert.equal(findings[0]?.actionHref, "/finance?tab=ledger");
    assert.equal(
      hasOpenReconciliationFindings(
        buildReconciliationFindings(
          {
            pendingManualPayments: 0,
            pendingReceiptReviews: 0,
            paidPayments: 3,
            failedPayments: 0,
          },
          0,
          2
        )
      ),
      false
    );
  });
});

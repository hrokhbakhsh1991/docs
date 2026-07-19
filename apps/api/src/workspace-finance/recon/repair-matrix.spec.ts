/**
 * Finance recon repair matrix + mode gating (no DB).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FINANCE_RECON_CODE } from "./codes";
import {
  getFinanceReconRepairMatrixEntry,
  listFinanceReconRepairMatrix,
} from "./repair-matrix";

describe("finance recon repair matrix", () => {
  it("covers paid-without-ledger as auto-safe", () => {
    const entry = getFinanceReconRepairMatrixEntry(FINANCE_RECON_CODE.paidNoLedger);
    assert.ok(entry);
    assert.equal(entry.autoSafe, true);
    assert.ok(entry.modes.includes("automatic"));
    assert.equal(entry.rollbackStrategy, "none_idempotent_reenqueue");
  });

  it("requires approved for ledger-without-payment", () => {
    const entry = getFinanceReconRepairMatrixEntry(FINANCE_RECON_CODE.ledgerNoPayment);
    assert.ok(entry);
    assert.equal(entry.autoSafe, false);
    assert.ok(entry.modes.includes("approved"));
    assert.ok(!entry.modes.includes("manual"));
    assert.equal(entry.requiresApprovedConfirm, true);
  });

  it("lists all divergence classes", () => {
    const codes = new Set(listFinanceReconRepairMatrix().map((e) => e.code));
    assert.ok(codes.has(FINANCE_RECON_CODE.paidNoLedger));
    assert.ok(codes.has(FINANCE_RECON_CODE.ledgerNoPayment));
    assert.ok(codes.has(FINANCE_RECON_CODE.dupCapture));
    assert.ok(codes.has(FINANCE_RECON_CODE.prepayNoLedger));
    assert.ok(codes.has(FINANCE_RECON_CODE.outboxFailed));
  });

  it("every matrix entry has rollback strategy and modes", () => {
    for (const entry of listFinanceReconRepairMatrix()) {
      assert.ok(entry.rollbackStrategy.length > 0);
      assert.ok(entry.modes.includes("preview"));
      assert.ok(entry.action.length > 0);
    }
  });
});

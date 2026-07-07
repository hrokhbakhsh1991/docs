/**
 * Phase 9.7 R2 — prepayment + schedule APIs
 * Authority: docs/phase-9/appendices/FINANCE-OPS-UX.md §5.4
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import { buildPaymentScheduleItems, resetFinanceScheduleStoreForTests } from "../src/workspace-finance/finance-schedule-store";

describe("finance-schedule-store.spec.ts — 9.7 R2", () => {
  it("buildPaymentScheduleItems splits invoice total across deposit + installments", () => {
    resetFinanceScheduleStoreForTests();
    const registrationId = randomUUID();
    const items = buildPaymentScheduleItems({
      registrationId,
      template: {
        depositPercent: 30,
        installmentCount: 2,
        graceDays: 7,
        firstDueAt: "2026-07-01T00:00:00.000Z",
        invoiceTotalMinor: "10000000",
        currency: "IRR",
      },
    });
    assert.equal(items.length, 3);
    const sum = items.reduce((acc, row) => acc + BigInt(row.amountMinor), BigInt(0));
    assert.equal(sum, BigInt(10_000_000));
    assert.equal(items[0]?.label, "Prepayment");
  });
});

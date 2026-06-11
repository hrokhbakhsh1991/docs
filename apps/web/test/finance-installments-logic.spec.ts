/**
 * Phase 9.7 R3 — installments board logic (CP-9.7-13).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  classifyInstallmentBoardColumn,
  groupInstallmentsByBoardColumn,
  installmentProgressPercent,
  parseSchedulesListResponse,
  validateGenerateScheduleForm,
  type PaymentScheduleItem,
} from "../src/finance/finance-installments-logic";

function scheduleItem(overrides: Partial<PaymentScheduleItem> = {}): PaymentScheduleItem {
  return {
    id: randomUUID(),
    registrationId: randomUUID(),
    sequence: 1,
    label: "Installment 1",
    dueAt: "2026-07-01T00:00:00.000Z",
    amountMinor: "1000000",
    paidMinor: "0",
    status: "scheduled",
    ...overrides,
  };
}

describe("finance-installments-logic.spec.ts — Phase 9.7 R3", () => {
  it("WEB-9.7-R3-01 classifyInstallmentBoardColumn marks overdue past due", () => {
    const column = classifyInstallmentBoardColumn(
      scheduleItem({
        dueAt: "2020-01-01T00:00:00.000Z",
        status: "due",
      }),
      new Date("2026-06-09T00:00:00.000Z")
    );
    assert.equal(column, "overdue");
  });

  it("WEB-9.7-R3-02 classifyInstallmentBoardColumn marks paid status", () => {
    const column = classifyInstallmentBoardColumn(
      scheduleItem({ status: "paid" }),
      new Date("2026-06-09T00:00:00.000Z")
    );
    assert.equal(column, "paid");
  });

  it("WEB-9.7-R3-03 groupInstallmentsByBoardColumn buckets items", () => {
    const now = new Date("2026-06-09T00:00:00.000Z");
    const buckets = groupInstallmentsByBoardColumn(
      [
        scheduleItem({ status: "paid" }),
        scheduleItem({ dueAt: "2020-01-01T00:00:00.000Z", status: "due" }),
        scheduleItem({ dueAt: "2026-06-10T00:00:00.000Z", status: "scheduled" }),
        scheduleItem({ dueAt: "2026-12-01T00:00:00.000Z", status: "scheduled" }),
      ],
      now
    );
    assert.equal(buckets.paid.length, 1);
    assert.equal(buckets.overdue.length, 1);
    assert.equal(buckets.due_this_week.length, 1);
    assert.equal(buckets.upcoming.length, 1);
  });

  it("WEB-9.7-R3-04 parseSchedulesListResponse and validateGenerateScheduleForm", () => {
    const registrationId = randomUUID();
    const parsed = parseSchedulesListResponse({
      items: [
        {
          id: "item-1",
          registrationId,
          sequence: 0,
          label: "Prepayment",
          dueAt: "2026-07-01T00:00:00.000Z",
          amountMinor: "3000000",
          paidMinor: "0",
          status: "due",
        },
      ],
    });
    assert.equal(parsed.items.length, 1);
    assert.equal(installmentProgressPercent(parsed.items[0]!), 0);

    const validated = validateGenerateScheduleForm({
      registrationId,
      invoiceTotalMinor: "10000000",
      depositPercent: "30",
      installmentCount: "2",
      firstDueAt: "2026-07-01T00:00",
      currency: "IRR",
    });
    assert.equal(validated.ok, true);
  });
});

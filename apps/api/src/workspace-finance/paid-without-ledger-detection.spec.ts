/**
 * Durable detection — Paid without capture probe (mirrors scrape gauge).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countPaidWithoutLedgerCapture,
  paymentLedgerCaptureDomainEventId,
} from "./paid-without-ledger-detection";

describe("INV-P6 paid-without-ledger detection", () => {
  it("paymentLedgerCaptureDomainEventId is stable Phase 3B formula", () => {
    assert.equal(
      paymentLedgerCaptureDomainEventId("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"),
      "payment:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee:ledger-capture-anchor"
    );
  });

  it("counts Paid rows missing capture outbox", () => {
    const tenantId = "t1";
    const paidId = "pay-1";
    const otherPaid = "pay-2";
    const since = new Date("2026-07-01T00:00:00.000Z");
    const count = countPaidWithoutLedgerCapture({
      since,
      payments: [
        {
          id: paidId,
          tenantId,
          status: "Paid",
          paidAt: new Date("2026-07-10T00:00:00.000Z"),
        },
        {
          id: otherPaid,
          tenantId,
          status: "Paid",
          paidAt: new Date("2026-07-10T00:00:00.000Z"),
        },
        {
          id: "pending",
          tenantId,
          status: "Pending",
          paidAt: null,
        },
        {
          id: "old",
          tenantId,
          status: "Paid",
          paidAt: new Date("2026-06-01T00:00:00.000Z"),
        },
      ],
      outbox: [
        {
          tenantId,
          domainEventId: paymentLedgerCaptureDomainEventId(paidId),
          eventType: "finance.ledger.double_entry_applied",
        },
      ],
    });
    assert.equal(count, 1);
  });

  it("zero when every recent Paid has capture", () => {
    const tenantId = "t1";
    const paidId = "pay-ok";
    assert.equal(
      countPaidWithoutLedgerCapture({
        payments: [
          {
            id: paidId,
            tenantId,
            status: "Paid",
            paidAt: new Date("2026-07-10T00:00:00.000Z"),
          },
        ],
        outbox: [
          {
            tenantId,
            domainEventId: paymentLedgerCaptureDomainEventId(paidId),
            eventType: "finance.ledger.double_entry_applied",
          },
        ],
      }),
      0
    );
  });
});

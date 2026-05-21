import assert from "node:assert/strict";
import test from "node:test";
import { PaymentCaptureLedgerAuthorityService } from "./payment-capture-ledger-authority.service";
import { mockLedgerPersistEntityManager } from "./test/mock-ledger-entity-manager";

test("emitPaymentCaptureAtPaid enqueues finance.ledger.double_entry_applied", async () => {
  const events: Array<{ eventType: string; domainEventId?: string | null }> = [];
  const service = new PaymentCaptureLedgerAuthorityService({
    addEvent: async (_manager: any, event: any) => {
      events.push({ eventType: event.eventType, domainEventId: event.domainEventId });
    }
  } as never);

  const result = await service.emitPaymentCaptureAtPaid(
    mockLedgerPersistEntityManager(),
    {
      id: "pay-1",
      tenantId: "tenant-1",
      registrationId: "reg-1",
      amount: "1200000",
      currency: "IRR",
      paidAt: new Date("2030-01-01T00:00:00.000Z")
    },
    "manual_receipt_approve"
  );

  assert.ok(result.journalId);
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[1]!.account, "booking:reg-1");
  assert.equal(result.lines[1]!.side, "credit");
  assert.equal(events.length, 1);
  assert.equal(events[0]!.eventType, "finance.ledger.double_entry_applied");
  assert.equal(events[0]!.domainEventId, "payment:pay-1:ledger-capture-anchor");
});

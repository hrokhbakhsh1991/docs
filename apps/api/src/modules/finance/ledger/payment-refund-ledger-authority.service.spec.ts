import assert from "node:assert/strict";
import test from "node:test";
import { PaymentStatus } from "../../payments/entities/payment.entity";
import { PaymentRefundLedgerAuthorityService } from "./repositories/payment-refund-ledger-authority.service";
import { mockLedgerPersistEntityManager } from "./test/mock-ledger-entity-manager";

test("emitPaymentRefundLedgerReversal enqueues finance.ledger.double_entry_applied with reversal links", async () => {
  const lines: { reversesLineId?: string }[] = [];
  const outbox = {
    async addEvent(
      _m: unknown,
      event: { eventType: string; payload: { lines: typeof lines } }
    ): Promise<void> {
      if (event.eventType === "finance.ledger.double_entry_applied") {
        lines.push(...event.payload.lines);
      }
    }
  };
  const svc = new PaymentRefundLedgerAuthorityService(outbox as never);
  await svc.emitPaymentRefundLedgerReversal(mockLedgerPersistEntityManager(), {
    id: "pay-1",
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    registrationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    amount: "10000",
    currency: "USD",
    paidAt: new Date("2026-01-15T12:00:00.000Z"),
    status: PaymentStatus.PAID,
    providerPaymentId: "psp-1"
  } as never, "refund-idem-1");

  assert.equal(lines.length, 4);
  const reversalLegs = lines.filter((l) => l.reversesLineId !== undefined);
  assert.equal(reversalLegs.length, 2);
  assert.ok(reversalLegs[0]!.reversesLineId);
  assert.ok(reversalLegs[1]!.reversesLineId);
  assert.notEqual(reversalLegs[0]!.reversesLineId, reversalLegs[1]!.reversesLineId);
});

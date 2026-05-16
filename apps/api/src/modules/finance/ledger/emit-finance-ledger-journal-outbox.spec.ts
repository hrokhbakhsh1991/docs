import assert from "node:assert/strict";
import test from "node:test";
import type { EntityManager } from "typeorm";
import type { OutboxService } from "../../outbox/outbox.service";
import { emitFinanceLedgerDoubleEntryAppliedOutbox } from "./emit-finance-ledger-journal-outbox";
import { postDoubleEntryJournal } from "./post-double-entry-journal";
import { REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT } from "./ledger-accounts";
import { bookingWalletId } from "./booking-ledger-authority.service";

const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const regId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("emitFinanceLedgerDoubleEntryAppliedOutbox enqueues when tenant envelope matches lines", async () => {
  const { lines } = postDoubleEntryJournal({
    tenantId: tenantA,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingWalletId(regId),
    amount_minor: "100",
    currency: "USD",
    correlationId: "corr",
    idempotencyKey: "idem-1"
  });
  const payloads: unknown[] = [];
  const outboxService = {
    async addEvent(_m: unknown, ev: unknown) {
      payloads.push(ev);
    }
  } as unknown as OutboxService;
  await emitFinanceLedgerDoubleEntryAppliedOutbox({
    manager: {} as EntityManager,
    outboxService,
    tenantId: tenantA,
    registrationId: regId,
    lines
  });
  assert.equal(payloads.length, 1);
  const ev = payloads[0] as { tenantId: string; payload: { lines: { tenantId: string }[] } };
  assert.equal(ev.tenantId, tenantA);
  assert.equal(ev.payload.lines.every((l) => l.tenantId === tenantA), true);
});

test("emitFinanceLedgerDoubleEntryAppliedOutbox rejects cross-tenant line batch", async () => {
  const { lines } = postDoubleEntryJournal({
    tenantId: tenantA,
    debitAccount: REGISTRATION_LEADER_PAYMENT_CLEARING_ACCOUNT,
    creditAccount: bookingWalletId(regId),
    amount_minor: "100",
    currency: "USD",
    correlationId: "corr",
    idempotencyKey: "idem-2"
  });
  let addCalls = 0;
  const outboxService = {
    async addEvent() {
      addCalls += 1;
    }
  } as unknown as OutboxService;
  await assert.rejects(
    () =>
      emitFinanceLedgerDoubleEntryAppliedOutbox({
        manager: {} as EntityManager,
        outboxService,
        tenantId: tenantB,
        registrationId: regId,
        lines
      }),
    /FINANCE_LEDGER_TENANT_MISMATCH/
  );
  assert.equal(addCalls, 0);
});

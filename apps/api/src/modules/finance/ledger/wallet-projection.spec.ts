import assert from "node:assert/strict";
import test from "node:test";
import { postDoubleEntryJournal } from "./post-double-entry-journal";
import { calculateWalletBalance } from "./wallet-projection";

test("calculateWalletBalance rejects mixed-tenant line slices (no silent cross-tenant aggregation)", () => {
  const { lines: a } = postDoubleEntryJournal({
    tenantId: "t1",
    debitAccount: "gl:clearing",
    creditAccount: "w1",
    amount_minor: "100",
    currency: "USD",
    correlationId: "c-a",
    idempotencyKey: "j-a"
  });
  const { lines: b } = postDoubleEntryJournal({
    tenantId: "t2",
    debitAccount: "gl:clearing",
    creditAccount: "w1",
    amount_minor: "50",
    currency: "USD",
    correlationId: "c-b",
    idempotencyKey: "j-b"
  });
  assert.throws(
    () => calculateWalletBalance("t1", "w1", [...a, ...b]),
    /FINANCE_WALLET_TENANT_SCOPE/
  );
});

test("calculateWalletBalance sums signed minors for one ledger account", () => {
  const { lines: inLines } = postDoubleEntryJournal({
    tenantId: "t1",
    debitAccount: "gl:clearing",
    creditAccount: "w1",
    amount_minor: "1000",
    currency: "USD",
    correlationId: "c1",
    idempotencyKey: "j-in"
  });
  const { lines: outLines } = postDoubleEntryJournal({
    tenantId: "t1",
    debitAccount: "w1",
    creditAccount: "gl:clearing",
    amount_minor: "300",
    currency: "USD",
    correlationId: "c2",
    idempotencyKey: "j-out"
  });
  const p = calculateWalletBalance("t1", "w1", [...outLines, ...inLines]);
  assert.equal(p.balance_minor, "700");
  assert.equal(p.entryCount, 2);
  assert.equal(p.currency, "USD");
});

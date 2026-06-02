import assert from "node:assert/strict";
import test from "node:test";

import { sumWalletBalanceFromLedgerLines } from "./wallet-projection";

test("sumWalletBalanceFromLedgerLines rejects mixed-tenant line slices (no silent cross-tenant aggregation)", () => {
  const a = {
    id: "1",
    journalId: "j",
    tenantId: "t1",
    account: "w1",
    side: "credit" as const,
    amount_minor: "10",
    currency: "IRR",
    correlationId: "c",
    idempotencyKey: "k",
    createdAt: "2020-01-01T00:00:00.000Z"
  };
  const b = { ...a, id: "2", tenantId: "t2" };
  assert.throws(
    () => sumWalletBalanceFromLedgerLines("t1", "w1", [a, b]),
    /FINANCE_WALLET_TENANT_SCOPE/
  );
});

test("sumWalletBalanceFromLedgerLines sums signed minors for one ledger account", () => {
  const outLines = [
    {
      id: "1",
      journalId: "j",
      tenantId: "t1",
      account: "w1",
      side: "debit" as const,
      amount_minor: "30",
      currency: "IRR",
      correlationId: "c1",
      idempotencyKey: "k1",
      createdAt: "2020-01-01T00:00:00.000Z"
    }
  ];
  const inLines = [
    {
      id: "2",
      journalId: "j",
      tenantId: "t1",
      account: "w1",
      side: "credit" as const,
      amount_minor: "50",
      currency: "IRR",
      correlationId: "c2",
      idempotencyKey: "k2",
      createdAt: "2020-01-02T00:00:00.000Z"
    }
  ];
  const p = sumWalletBalanceFromLedgerLines("t1", "w1", [...outLines, ...inLines]);
  assert.equal(p.balance_minor, "20");
  assert.equal(p.currency, "IRR");
  assert.equal(p.entryCount, 2);
});

/**
 * WALLET-P2C — mapper unit tests (no database).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mapWalletAccount,
  mapWalletLedgerEntry,
  mapWalletMutation,
  mapWalletTransaction,
} from "./infrastructure/wallet-prisma-mappers";

describe("WALLET-P2C wallet prisma mappers", () => {
  it("maps account rows without balance fields", () => {
    const mapped = mapWalletAccount({
      id: "acct-1",
      tenantId: "tenant-1",
      workspaceId: "ws-1",
      userId: "user-1",
      status: "active",
      currency: "USD",
      createdAt: new Date("2026-09-02T09:00:00.000Z"),
      updatedAt: new Date("2026-09-02T09:00:00.000Z"),
    });
    assert.equal(mapped.currency, "USD");
    assert.equal("balanceMinor" in mapped, false);
  });

  it("maps transaction and ledger mutation bundle", () => {
    const postedAt = new Date("2026-09-02T09:00:00.000Z");
    const transaction = {
      id: "tx-1",
      tenantId: "tenant-1",
      workspaceId: "ws-1",
      accountId: "acct-1",
      kind: "operator_credit",
      status: "posted",
      amountMinor: "1000",
      currency: "USD",
      creationIdempotencyKey: "idem-1",
      commandFingerprint: "fp-1",
      referenceType: "ops_note",
      referenceId: "note-1",
      actorUserId: "op-1",
      actorRole: "operator",
      reversesTransactionId: null,
      postedAt,
      createdAt: postedAt,
      updatedAt: postedAt,
    };
    const entry = {
      id: "le-1",
      tenantId: "tenant-1",
      transactionId: "tx-1",
      accountId: "acct-1",
      direction: "credit",
      amountMinor: "1000",
      currency: "USD",
      postedAt,
      createdAt: postedAt,
    };

    const mappedTx = mapWalletTransaction(transaction);
    assert.equal(mappedTx.reference?.type, "ops_note");
    assert.equal(mappedTx.actor.actorRole, "operator");

    const mappedEntry = mapWalletLedgerEntry(entry);
    assert.equal(mappedEntry.direction, "credit");

    const mutation = mapWalletMutation(transaction, [entry]);
    assert.equal(mutation.ledgerEntries.length, 1);
    assert.equal(mutation.transaction.kind, "operator_credit");
  });
});

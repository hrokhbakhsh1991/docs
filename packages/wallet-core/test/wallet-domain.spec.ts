/**
 * Phase 2B — wallet-core domain and application service tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertTransactionNotPosted,
  buildMemberBalanceView,
  buildMemberTransactionHistory,
  calculateBalance,
  createOperatorCredit,
  createOperatorDebit,
  createReversal,
  operatorCreditFingerprint,
  resolveIdempotencyReplay,
  validateAmountMinor,
  walletOk,
  type WalletAccount,
  type WalletLedgerEntry,
  type WalletTransaction,
} from "../src/index.ts";

const TENANT = "tenant-1";
const WORKSPACE = "ws-wallet";
const USER = "user-1";
const ACCOUNT_ID = "acct-1";
const NOW = "2026-09-02T09:00:00.000Z";

function activeAccount(overrides: Partial<WalletAccount> = {}): WalletAccount {
  return {
    id: ACCOUNT_ID,
    tenantId: TENANT,
    workspaceId: WORKSPACE,
    userId: USER,
    status: "active",
    currency: "USD",
    ...overrides,
  };
}

function creditCommand(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    workspaceId: WORKSPACE,
    userId: USER,
    accountId: ACCOUNT_ID,
    amountMinor: "1000",
    currency: "usd",
    creationIdempotencyKey: "idem-credit-1",
    reference: { type: "ops_note", id: "note-1" },
    actor: { actorUserId: "op-1", actorRole: "operator" as const },
    transactionId: "tx-credit-1",
    ledgerEntryId: "le-credit-1",
    nowIso: NOW,
    ...overrides,
  };
}

function debitCommand(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT,
    workspaceId: WORKSPACE,
    userId: USER,
    accountId: ACCOUNT_ID,
    amountMinor: "400",
    currency: "USD",
    creationIdempotencyKey: "idem-debit-1",
    reference: null,
    actor: { actorUserId: "op-1", actorRole: "operator" as const },
    transactionId: "tx-debit-1",
    ledgerEntryId: "le-debit-1",
    nowIso: NOW,
    ...overrides,
  };
}

describe("wallet-core domain MVP", () => {
  it("accepts valid operator credit and posts append-only ledger entry", () => {
    const result = createOperatorCredit(activeAccount(), creditCommand());
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.value.transaction.status, "posted");
    assert.equal(result.value.transaction.kind, "operator_credit");
    assert.equal(result.value.ledgerEntries.length, 1);
    assert.equal(result.value.ledgerEntries[0]?.direction, "credit");
    assert.equal(result.value.ledgerEntries[0]?.amountMinor, "1000");
    assert.equal(result.value.ledgerEntries[0]?.currency, "USD");
  });

  it("accepts valid operator debit when balance is sufficient", () => {
    const credit = createOperatorCredit(activeAccount(), creditCommand());
    assert.equal(credit.ok, true);
    if (!credit.ok) return;

    const debit = createOperatorDebit(
      activeAccount(),
      debitCommand(),
      credit.value.ledgerEntries,
    );
    assert.equal(debit.ok, true);
    if (!debit.ok) return;

    assert.equal(debit.value.transaction.kind, "operator_debit");
    assert.equal(debit.value.ledgerEntries[0]?.direction, "debit");
  });

  it("rejects debit with WALLET_INSUFFICIENT_FUNDS", () => {
    const debit = createOperatorDebit(activeAccount(), debitCommand({ amountMinor: "500" }), []);
    assert.equal(debit.ok, false);
    if (debit.ok) return;
    assert.equal(debit.error.code, "WALLET_INSUFFICIENT_FUNDS");
  });

  it("rejects zero and negative amounts", () => {
    for (const amount of ["0", "-1", "1.5", "abc", ""]) {
      const amountResult = validateAmountMinor(amount);
      assert.equal(amountResult.ok, false, `expected invalid amount: ${amount}`);
      if (amountResult.ok) continue;
      assert.equal(amountResult.error.code, "WALLET_INVALID_AMOUNT");
    }
  });

  it("rejects invalid amount strings on credit", () => {
    const result = createOperatorCredit(
      activeAccount(),
      creditCommand({ amountMinor: "00" }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "WALLET_INVALID_AMOUNT");
  });

  it("rejects currency mismatch against account", () => {
    const result = createOperatorCredit(
      activeAccount(),
      creditCommand({ currency: "EUR" }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "WALLET_CURRENCY_MISMATCH");
  });

  it("rejects inactive or suspended accounts", () => {
    for (const status of ["suspended", "closed"] as const) {
      const result = createOperatorCredit(
        activeAccount({ status }),
        creditCommand(),
      );
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.error.code, "WALLET_ACCOUNT_NOT_ACTIVE");
    }
  });

  it("calculates balance from posted entries only", () => {
    const credit = createOperatorCredit(activeAccount(), creditCommand({ amountMinor: "1500" }));
    assert.equal(credit.ok, true);
    if (!credit.ok) return;

    const debit = createOperatorDebit(
      activeAccount(),
      debitCommand({ amountMinor: "500", transactionId: "tx-d2", ledgerEntryId: "le-d2" }),
      credit.value.ledgerEntries,
    );
    assert.equal(debit.ok, true);
    if (!debit.ok) return;

    const entries = [...credit.value.ledgerEntries, ...debit.value.ledgerEntries];
    const balance = calculateBalance(activeAccount(), entries);
    assert.equal(balance.ok, true);
    if (!balance.ok) return;
    assert.equal(balance.value.balanceMinor, "1000");
  });

  it("ignores failed/cancelled transactions in member history view", () => {
    const credit = createOperatorCredit(activeAccount(), creditCommand());
    assert.equal(credit.ok, true);
    if (!credit.ok) return;

    const failedTx: WalletTransaction = {
      ...credit.value.transaction,
      id: "tx-failed",
      status: "failed",
      postedAt: null,
    };

    const history = buildMemberTransactionHistory(
      activeAccount(),
      [credit.value.transaction, failedTx],
      credit.value.ledgerEntries,
    );
    assert.equal(history.ok, true);
    if (!history.ok) return;
    assert.equal(history.value.items.length, 1);
    assert.equal(history.value.items[0]?.transaction.id, credit.value.transaction.id);
  });

  it("reversal arithmetic restores pre-transaction balance", () => {
    const credit = createOperatorCredit(activeAccount(), creditCommand({ amountMinor: "2000" }));
    assert.equal(credit.ok, true);
    if (!credit.ok) return;

    const before = calculateBalance(activeAccount(), []);
    assert.equal(before.ok, true);
    if (!before.ok) return;

    const afterCredit = calculateBalance(activeAccount(), credit.value.ledgerEntries);
    assert.equal(afterCredit.ok, true);
    if (!afterCredit.ok) return;
    assert.equal(afterCredit.value.balanceMinor, "2000");

    const reversal = createReversal(
      activeAccount(),
      {
        tenantId: TENANT,
        workspaceId: WORKSPACE,
        userId: USER,
        accountId: ACCOUNT_ID,
        creationIdempotencyKey: "idem-rev-1",
        reference: null,
        actor: { actorUserId: "op-1", actorRole: "operator" },
        originalTransactionId: credit.value.transaction.id,
        reversalTransactionId: "tx-rev-1",
        reversalLedgerEntryId: "le-rev-1",
        nowIso: "2026-09-02T10:00:00.000Z",
      },
      credit.value.transaction,
      credit.value.ledgerEntries,
      null,
    );
    assert.equal(reversal.ok, true);
    if (!reversal.ok) return;

    const allEntries = [
      ...credit.value.ledgerEntries,
      ...reversal.value.ledgerEntries,
    ];
    const afterReversal = calculateBalance(activeAccount(), allEntries);
    assert.equal(afterReversal.ok, true);
    if (!afterReversal.ok) return;
    assert.equal(afterReversal.value.balanceMinor, before.value.balanceMinor);
  });

  it("rejects duplicate posting via assertTransactionNotPosted", () => {
    const credit = createOperatorCredit(activeAccount(), creditCommand());
    assert.equal(credit.ok, true);
    if (!credit.ok) return;

    const again = assertTransactionNotPosted(credit.value.transaction);
    assert.equal(again.ok, false);
    if (again.ok) return;
    assert.equal(again.error.code, "WALLET_TRANSACTION_ALREADY_POSTED");
  });

  it("rejects duplicate reversal of the same original transaction", () => {
    const credit = createOperatorCredit(activeAccount(), creditCommand());
    assert.equal(credit.ok, true);
    if (!credit.ok) return;

    const existingReversal: WalletTransaction = {
      id: "tx-rev-existing",
      tenantId: TENANT,
      workspaceId: WORKSPACE,
      accountId: ACCOUNT_ID,
      kind: "reversal",
      status: "posted",
      amountMinor: "1000",
      currency: "USD",
      creationIdempotencyKey: "idem-rev-old",
      reference: null,
      actor: { actorUserId: "op-1", actorRole: "operator" },
      reversesTransactionId: credit.value.transaction.id,
      createdAt: NOW,
      postedAt: NOW,
    };

    const reversal = createReversal(
      activeAccount(),
      {
        tenantId: TENANT,
        workspaceId: WORKSPACE,
        userId: USER,
        accountId: ACCOUNT_ID,
        creationIdempotencyKey: "idem-rev-2",
        reference: null,
        actor: { actorUserId: "op-1", actorRole: "operator" },
        originalTransactionId: credit.value.transaction.id,
        reversalTransactionId: "tx-rev-2",
        reversalLedgerEntryId: "le-rev-2",
        nowIso: NOW,
      },
      credit.value.transaction,
      credit.value.ledgerEntries,
      existingReversal,
    );
    assert.equal(reversal.ok, false);
    if (reversal.ok) return;
    assert.equal(reversal.error.code, "WALLET_REVERSAL_INVALID");
  });

  it("resolves idempotency replay for same fingerprint and conflicts on mismatch", () => {
    const command = creditCommand();
    const fingerprint = operatorCreditFingerprint(command);
    const fresh = walletOk({ marker: "fresh" });

    const replay = resolveIdempotencyReplay(
      {
        tenantId: TENANT,
        creationIdempotencyKey: command.creationIdempotencyKey,
        commandFingerprint: fingerprint,
        resultSnapshot: { marker: "stored" },
      },
      fingerprint,
      fresh.value,
    );
    assert.equal(replay.ok, true);
    if (!replay.ok) return;
    assert.deepEqual(replay.value, { marker: "stored" });

    const conflict = resolveIdempotencyReplay(
      {
        tenantId: TENANT,
        creationIdempotencyKey: command.creationIdempotencyKey,
        commandFingerprint: "different-fingerprint",
        resultSnapshot: { marker: "stored" },
      },
      fingerprint,
      fresh.value,
    );
    assert.equal(conflict.ok, false);
    if (conflict.ok) return;
    assert.equal(conflict.error.code, "WALLET_IDEMPOTENCY_CONFLICT");
  });

  it("rejects ownership mismatch across tenant/workspace/user", () => {
    const result = createOperatorCredit(
      activeAccount(),
      creditCommand({ tenantId: "other-tenant" }),
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error.code, "WALLET_OWNERSHIP_MISMATCH");
  });

  it("rejects cross-account ledger entries during balance calculation", () => {
    const credit = createOperatorCredit(activeAccount(), creditCommand());
    assert.equal(credit.ok, true);
    if (!credit.ok) return;

    const crossAccountEntry: WalletLedgerEntry = {
      ...credit.value.ledgerEntries[0]!,
      accountId: "other-acct",
    };

    const balance = calculateBalance(activeAccount(), [crossAccountEntry]);
    assert.equal(balance.ok, false);
    if (balance.ok) return;
    assert.equal(balance.error.code, "WALLET_OWNERSHIP_MISMATCH");
  });

  it("uses BigInt-only arithmetic and never Number for monetary math", () => {
    const large = "9007199254740992";
    const credit = createOperatorCredit(
      activeAccount(),
      creditCommand({ amountMinor: large, transactionId: "tx-big", ledgerEntryId: "le-big" }),
    );
    assert.equal(credit.ok, true);
    if (!credit.ok) return;

    const balance = buildMemberBalanceView(activeAccount(), credit.value.ledgerEntries);
    assert.equal(balance.ok, true);
    if (!balance.ok) return;
    assert.equal(balance.value.balanceMinor, large);
    assert.equal(typeof balance.value.balanceMinor, "string");
  });

  it("does not expose mutable balance on authoritative account model", () => {
    const account = activeAccount();
    assert.equal("balanceMinor" in account, false);
    assert.equal("balance" in account, false);
  });

  it("preserves append-only semantics — reversal leaves original rows unchanged", () => {
    const credit = createOperatorCredit(activeAccount(), creditCommand());
    assert.equal(credit.ok, true);
    if (!credit.ok) return;

    const originalTx = structuredClone(credit.value.transaction);
    const originalEntries = structuredClone(credit.value.ledgerEntries);

    const reversal = createReversal(
      activeAccount(),
      {
        tenantId: TENANT,
        workspaceId: WORKSPACE,
        userId: USER,
        accountId: ACCOUNT_ID,
        creationIdempotencyKey: "idem-rev-append",
        reference: null,
        actor: { actorUserId: "op-1", actorRole: "operator" },
        originalTransactionId: credit.value.transaction.id,
        reversalTransactionId: "tx-rev-append",
        reversalLedgerEntryId: "le-rev-append",
        nowIso: NOW,
      },
      credit.value.transaction,
      credit.value.ledgerEntries,
      null,
    );
    assert.equal(reversal.ok, true);
    if (!reversal.ok) return;

    assert.deepEqual(credit.value.transaction, originalTx);
    assert.deepEqual(credit.value.ledgerEntries, originalEntries);
    assert.equal(reversal.value.transaction.kind, "reversal");
    assert.equal(reversal.value.ledgerEntries[0]?.direction, "debit");
  });
});

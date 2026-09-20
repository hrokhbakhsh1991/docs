/**
 * WALLET-P2D — wallet-http-contracts validation tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertWalletIdempotencyKeyPresent,
  parseOperatorAccountLookupUserId,
  parseOperatorCreditBody,
  parseOperatorDebitBody,
  parseOperatorReversalBody,
  parseOptionalListCursor,
  parseWalletTransactionsLimit,
  WALLET_HTTP_ERROR_CODES,
} from "../src/index";

describe("wallet-http-contracts", () => {
  it("accepts valid operator credit/debit bodies with string minor amounts", () => {
    const credit = parseOperatorCreditBody({
      amountMinor: "1000",
      currency: "IRR",
    });
    assert.equal(credit.amountMinor, "1000");
    assert.equal(credit.currency, "IRR");

    const debit = parseOperatorDebitBody({
      amountMinor: "500",
      currency: "USD",
      reference: { type: "ops", id: "note-1" },
    });
    assert.equal(debit.amountMinor, "500");
    assert.equal(debit.reference?.type, "ops");
  });

  it("rejects floating-point and negative amount strings", () => {
    assert.throws(() =>
      parseOperatorCreditBody({ amountMinor: "10.5", currency: "IRR" }),
    );
    assert.throws(() =>
      parseOperatorDebitBody({ amountMinor: "-1", currency: "IRR" }),
    );
  });

  it("validates pagination limit and cursor", () => {
    assert.equal(parseWalletTransactionsLimit(null), 50);
    assert.equal(parseWalletTransactionsLimit("25"), 25);
    assert.equal(parseWalletTransactionsLimit("999"), 200);
    assert.throws(() => parseWalletTransactionsLimit("abc"));
    assert.equal(parseOptionalListCursor(null), undefined);
    assert.equal(parseOptionalListCursor("opaque-cursor"), "opaque-cursor");
    assert.throws(() => parseOptionalListCursor("x".repeat(1025)));
  });

  it("requires Idempotency-Key contract", () => {
    assert.throws(() => assertWalletIdempotencyKeyPresent(undefined));
    assert.throws(() => assertWalletIdempotencyKeyPresent(""));
    assert.throws(() => assertWalletIdempotencyKeyPresent("short"));
    assert.doesNotThrow(() => assertWalletIdempotencyKeyPresent("idem-key-12345678"));
  });

  it("validates operator account lookup userId and reversal body", () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    assert.equal(parseOperatorAccountLookupUserId(userId), userId);
    assert.throws(() => parseOperatorAccountLookupUserId(null));
    assert.throws(() => parseOperatorAccountLookupUserId("not-a-uuid"));

    const reversal = parseOperatorReversalBody({
      accountId: "00000000-0000-4000-8000-000000000002",
    });
    assert.equal(reversal.accountId, "00000000-0000-4000-8000-000000000002");
  });

  it("exposes stable wallet HTTP error code inventory", () => {
    assert.ok(WALLET_HTTP_ERROR_CODES.includes("WALLET_IDEMPOTENCY_CONFLICT"));
    assert.ok(WALLET_HTTP_ERROR_CODES.includes("IDEMPOTENCY_KEY_REQUIRED"));
    assert.ok(WALLET_HTTP_ERROR_CODES.includes("WALLET_WORKSPACE_UNSUPPORTED"));
  });
});

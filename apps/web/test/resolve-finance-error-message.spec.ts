import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  localizeFinanceMessage,
  normalizeFinanceErrorCode,
  resolveFinanceErrorMessage,
  toFinanceClientErrorCode,
} from "../src/i18n/resolve-finance-error-message.ts";

describe("resolve-finance-error-message", () => {
  it("normalizes list HTTP codes to FETCH_FAILED keys", () => {
    assert.equal(normalizeFinanceErrorCode("RECEIPTS_LIST_HTTP_503"), "RECEIPTS_FETCH_FAILED");
    assert.equal(normalizeFinanceErrorCode("PAYMENTS_LIST_HTTP_502"), "PAYMENTS_FETCH_FAILED");
    assert.equal(
      normalizeFinanceErrorCode("PREPAYMENTS_LIST_HTTP_503"),
      "PREPAYMENTS_FETCH_FAILED"
    );
    assert.equal(normalizeFinanceErrorCode("SCHEDULES_LIST_HTTP_500"), "SCHEDULES_FETCH_FAILED");
    assert.equal(normalizeFinanceErrorCode("OVERVIEW_HTTP_503"), "OVERVIEW_FETCH_FAILED");
    assert.equal(normalizeFinanceErrorCode("LEDGER_HTTP_503"), "LEDGER_FETCH_FAILED");
    assert.equal(normalizeFinanceErrorCode("FINANCE_PAYMENTS_HTTP_503"), "PAYMENTS_FETCH_FAILED");
    assert.equal(normalizeFinanceErrorCode("RECEIPT_REVIEW_HTTP_502"), "REVIEW_RECEIPT_FAILED");
    assert.equal(normalizeFinanceErrorCode("INVOICE_HTTP_503"), "INVOICE_FETCH_FAILED");
    assert.equal(normalizeFinanceErrorCode("MANUAL_PAYMENT_HTTP_500"), "MANUAL_PAYMENT_FAILED");
    assert.equal(normalizeFinanceErrorCode("SUBMIT_RECEIPT_HTTP_502"), "SUBMIT_RECEIPT_FAILED");
    assert.equal(normalizeFinanceErrorCode("RECORD_PREPAYMENT_HTTP_503"), "RECORD_PREPAYMENT_FAILED");
    assert.equal(normalizeFinanceErrorCode("GENERATE_SCHEDULE_HTTP_500"), "GENERATE_SCHEDULE_FAILED");
    assert.equal(normalizeFinanceErrorCode("FINANCE_SUMMARY_HTTP_503"), "FINANCE_SUMMARY_FAILED");
    assert.equal(normalizeFinanceErrorCode("Failed to fetch"), "NETWORK_ERROR");
    assert.equal(
      normalizeFinanceErrorCode("FINANCE_SUMMARY_HTTP_503"),
      "FINANCE_SUMMARY_FAILED"
    );
  });

  it("maps TypeError network failures to NETWORK_ERROR", () => {
    assert.equal(toFinanceClientErrorCode(new TypeError("Failed to fetch"), "FALLBACK"), "NETWORK_ERROR");
    assert.equal(
      toFinanceClientErrorCode(new Error("RECEIPT_REVIEW_HTTP_503"), "FALLBACK"),
      "REVIEW_RECEIPT_FAILED"
    );
  });

  it("resolves localized receipts fetch failure", () => {
    const errors: Record<string, string> = {
      RECEIPTS_FETCH_FAILED: "Failed to load the receipt review queue. Try again.",
      NETWORK_ERROR: "Network error. Check your connection and try again.",
      REVIEW_RECEIPT_FAILED: "Receipt review failed.",
    };
    const t = (key: string) => {
      const value = errors[key];
      if (value === undefined) {
        throw new Error(`missing:${key}`);
      }
      return value;
    };
    assert.equal(
      resolveFinanceErrorMessage(t, "RECEIPTS_LIST_HTTP_503"),
      "Failed to load the receipt review queue. Try again."
    );
    assert.equal(
      localizeFinanceMessage(() => {
        throw new Error("no validation");
      }, t, "Failed to fetch"),
      "Network error. Check your connection and try again."
    );
    assert.equal(
      localizeFinanceMessage(() => {
        throw new Error("no validation");
      }, t, "RECEIPT_REVIEW_HTTP_503"),
      "Receipt review failed."
    );
  });
});

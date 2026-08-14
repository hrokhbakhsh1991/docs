import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FINANCE_GENERIC_ERROR_FALLBACK_KEY,
  isUsableFinanceTranslationResult,
  localizeFinanceMessage,
  normalizeFinanceErrorCode,
  resolveFinanceErrorMessage,
  toFinanceClientErrorCode,
  type FinanceTranslateFn,
} from "../src/i18n/resolve-finance-error-message.ts";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EN = JSON.parse(readFileSync(join(WEB_ROOT, "messages/en/finance.json"), "utf8")) as {
  readonly validation: Record<string, string>;
  readonly errors: Record<string, string>;
};
const FA = JSON.parse(readFileSync(join(WEB_ROOT, "messages/fa/finance.json"), "utf8")) as {
  readonly validation: Record<string, string>;
  readonly errors: Record<string, string>;
};

function translatorFromBag(
  bag: Record<string, string>,
  options?: {
    readonly namespace?: string;
    /** Simulate next-intl: return canonical path instead of throwing when missing. */
    readonly missingReturnsCanonicalPath?: boolean;
  }
): FinanceTranslateFn {
  const namespace = options?.namespace;
  const missingReturnsCanonicalPath = options?.missingReturnsCanonicalPath === true;
  const t = ((key: string) => {
    const value = bag[key];
    if (value !== undefined) {
      return value;
    }
    if (missingReturnsCanonicalPath && namespace !== undefined) {
      return `${namespace}.${key}`;
    }
    throw new Error(`missing:${key}`);
  }) as FinanceTranslateFn;
  Object.defineProperty(t, "has", {
    value: (key: string) => Object.prototype.hasOwnProperty.call(bag, key),
    enumerable: false,
  });
  return t;
}

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
    assert.equal(
      normalizeFinanceErrorCode("RECORD_PREPAYMENT_HTTP_503"),
      "RECORD_PREPAYMENT_FAILED"
    );
    assert.equal(
      normalizeFinanceErrorCode("GENERATE_SCHEDULE_HTTP_500"),
      "GENERATE_SCHEDULE_FAILED"
    );
    assert.equal(
      normalizeFinanceErrorCode("SET_OBLIGATION_OVERRIDE_HTTP_500"),
      "SET_OBLIGATION_OVERRIDE_FAILED"
    );
    assert.equal(normalizeFinanceErrorCode("FINANCE_SUMMARY_HTTP_503"), "FINANCE_SUMMARY_FAILED");
    assert.equal(normalizeFinanceErrorCode("Failed to fetch"), "NETWORK_ERROR");
    assert.equal(normalizeFinanceErrorCode("FINANCE_SUMMARY_HTTP_503"), "FINANCE_SUMMARY_FAILED");
  });

  it("maps TypeError network failures to NETWORK_ERROR", () => {
    assert.equal(
      toFinanceClientErrorCode(new TypeError("Failed to fetch"), "FALLBACK"),
      "NETWORK_ERROR"
    );
    assert.equal(
      toFinanceClientErrorCode(new Error("RECEIPT_REVIEW_HTTP_503"), "FALLBACK"),
      "REVIEW_RECEIPT_FAILED"
    );
  });

  it("A: known validation key prefers validation over errors", () => {
    const tValidation = translatorFromBag({
      REGISTRATION_ID_INVALID: EN.validation.REGISTRATION_ID_INVALID,
    });
    const tErrors = translatorFromBag({
      REGISTRATION_ID_INVALID: "SHOULD_NOT_USE_ERRORS_COPY",
      NETWORK_ERROR: EN.errors.NETWORK_ERROR,
    });
    assert.equal(
      localizeFinanceMessage(tValidation, tErrors, "REGISTRATION_ID_INVALID"),
      EN.validation.REGISTRATION_ID_INVALID
    );
  });

  it("B: INVOICE_FETCH_FAILED resolves from errors (EN + FA bags), not validation", () => {
    assert.equal(EN.validation.INVOICE_FETCH_FAILED, undefined);
    assert.equal(FA.validation.INVOICE_FETCH_FAILED, undefined);
    assert.equal(typeof EN.errors.INVOICE_FETCH_FAILED, "string");
    assert.equal(typeof FA.errors.INVOICE_FETCH_FAILED, "string");

    for (const [locale, messages] of [
      ["en", EN],
      ["fa", FA],
    ] as const) {
      const tValidation = translatorFromBag(
        { ...messages.validation },
        { namespace: "finance.validation", missingReturnsCanonicalPath: true }
      );
      const tErrors = translatorFromBag({ ...messages.errors });
      const localized = localizeFinanceMessage(tValidation, tErrors, "INVOICE_FETCH_FAILED");
      assert.equal(localized, messages.errors.INVOICE_FETCH_FAILED, locale);
      assert.notEqual(localized, "INVOICE_FETCH_FAILED");
      assert.notEqual(localized, "finance.validation.INVOICE_FETCH_FAILED");
      assert.notEqual(localized, messages.errors.NETWORK_ERROR);
    }
  });

  it("B: INVOICE_HTTP_503 normalizes then uses errors copy", () => {
    const tValidation = translatorFromBag(
      {},
      { namespace: "finance.validation", missingReturnsCanonicalPath: true }
    );
    const tErrors = translatorFromBag({
      INVOICE_FETCH_FAILED: EN.errors.INVOICE_FETCH_FAILED,
      NETWORK_ERROR: EN.errors.NETWORK_ERROR,
    });
    assert.equal(
      localizeFinanceMessage(tValidation, tErrors, "INVOICE_HTTP_503"),
      EN.errors.INVOICE_FETCH_FAILED
    );
  });

  it("C: next-intl-style finance.validation.<KEY> fallback is treated as a miss", () => {
    assert.equal(
      isUsableFinanceTranslationResult(
        "finance.validation.INVOICE_FETCH_FAILED",
        "INVOICE_FETCH_FAILED"
      ),
      false
    );
    assert.equal(
      isUsableFinanceTranslationResult("finance.errors.NETWORK_ERROR", "NETWORK_ERROR"),
      false
    );
    assert.equal(
      isUsableFinanceTranslationResult(EN.errors.INVOICE_FETCH_FAILED, "INVOICE_FETCH_FAILED"),
      true
    );

    const tValidation = translatorFromBag(
      {},
      { namespace: "finance.validation", missingReturnsCanonicalPath: true }
    );
    // No `has` — probes t() and must reject canonical fallback string.
    const tValidationNoHas = ((key: string) => `finance.validation.${key}`) as FinanceTranslateFn;
    const tErrors = translatorFromBag({
      INVOICE_FETCH_FAILED: EN.errors.INVOICE_FETCH_FAILED,
      NETWORK_ERROR: EN.errors.NETWORK_ERROR,
    });
    assert.equal(resolveFinanceErrorMessage(tValidation, "INVOICE_FETCH_FAILED"), null);
    assert.equal(resolveFinanceErrorMessage(tValidationNoHas, "INVOICE_FETCH_FAILED"), null);
    assert.equal(
      localizeFinanceMessage(tValidationNoHas, tErrors, "INVOICE_FETCH_FAILED"),
      EN.errors.INVOICE_FETCH_FAILED
    );
  });

  it("D: unknown code uses generic NETWORK_ERROR, not raw path or backend code", () => {
    const tValidation = translatorFromBag(
      {},
      { namespace: "finance.validation", missingReturnsCanonicalPath: true }
    );
    const tErrors = translatorFromBag(
      { NETWORK_ERROR: EN.errors.NETWORK_ERROR },
      { namespace: "finance.errors", missingReturnsCanonicalPath: true }
    );
    const localized = localizeFinanceMessage(tValidation, tErrors, "TOTALLY_UNKNOWN_CODE_XYZ");
    assert.equal(localized, EN.errors.NETWORK_ERROR);
    assert.notEqual(localized, "TOTALLY_UNKNOWN_CODE_XYZ");
    assert.ok(localized !== null && !localized.includes("finance.validation."));
    assert.ok(localized !== null && !localized.includes("finance.errors.TOTALLY"));
  });

  it("E: thrown validation lookup falls through to errors", () => {
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
      localizeFinanceMessage(
        () => {
          throw new Error("no validation");
        },
        t,
        "Failed to fetch"
      ),
      "Network error. Check your connection and try again."
    );
    assert.equal(
      localizeFinanceMessage(
        () => {
          throw new Error("no validation");
        },
        t,
        "RECEIPT_REVIEW_HTTP_503"
      ),
      "Receipt review failed."
    );
  });

  it("F: invoice card still localizes via shared helper (no invoice-specific mapping)", () => {
    const invoiceCard = readFileSync(
      join(WEB_ROOT, "src/finance/finance-invoice-balance-card.tsx"),
      "utf8"
    );
    assert.match(invoiceCard, /localizeFinanceMessage\(tValidation,\s*tErrors,\s*error\)/);
    assert.match(invoiceCard, /toFinanceClientErrorCode\(fetchError,\s*"INVOICE_FETCH_FAILED"\)/);
    assert.doesNotMatch(invoiceCard, /tErrors\(["']INVOICE_FETCH_FAILED["']\)/);
    assert.doesNotMatch(invoiceCard, /tValidation\(["']INVOICE_FETCH_FAILED["']\)/);
    assert.match(
      readFileSync(join(WEB_ROOT, "src/i18n/resolve-finance-error-message.ts"), "utf8"),
      /isUsableFinanceTranslationResult/
    );
  });

  it("G: EN/FA parity for invoice fetch + generic fallback keys", () => {
    assert.equal(FINANCE_GENERIC_ERROR_FALLBACK_KEY, "NETWORK_ERROR");
    for (const key of [
      "INVOICE_FETCH_FAILED",
      "INVOICE_PARSE_FAILED",
      "SET_OBLIGATION_OVERRIDE_FAILED",
      "NETWORK_ERROR",
    ] as const) {
      assert.equal(typeof EN.errors[key], "string");
      assert.equal(typeof FA.errors[key], "string");
      assert.ok(EN.errors[key].trim().length > 0);
      assert.ok(FA.errors[key].trim().length > 0);
      assert.equal(EN.validation[key], undefined);
      assert.equal(FA.validation[key], undefined);
    }
  });
});

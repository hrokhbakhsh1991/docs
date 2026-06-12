/**
 * Localized numeric input — Persian display, ASCII storage
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeNumericInputValue,
  toAsciiDigits,
  toLocalizedDigits,
} from "../src/i18n/format-localized-digits";

describe("localized-numeric-input.spec.ts", () => {
  it("WEB-I18N-INPUT-01 maps Persian and Arabic-Indic digits to ASCII", () => {
    assert.equal(toAsciiDigits("٠١٢"), "012");
    assert.equal(toAsciiDigits("۰۱۲"), "012");
  });

  it("WEB-I18N-INPUT-02 keeps decimal point in ASCII for API", () => {
    assert.equal(normalizeNumericInputValue("۳۵.۵", "decimal"), "35.5");
  });

  it("WEB-I18N-INPUT-03 displays Western digits as Persian when locale is fa", () => {
    assert.equal(toLocalizedDigits("42", "fa"), "۴۲");
  });

  it("WEB-I18N-INPUT-04 normalizes phone mode preserving leading plus", () => {
    assert.equal(normalizeNumericInputValue("+۹۸۹۱۲", "phone"), "+98912");
    assert.equal(normalizeNumericInputValue("۰۹۱۲۳۴۵۶۷۸۹", "phone"), "09123456789");
  });

  it("WEB-I18N-INPUT-05 phone: Persian display from ASCII state, mixed keyboard input", () => {
    const ascii = "+989121000001";
    assert.equal(toLocalizedDigits(ascii, "fa"), "+۹۸۹۱۲۱۰۰۰۰۰۱");
    assert.equal(normalizeNumericInputValue("+۹۸۹۱۲۱۰۰۰۰۰۱", "phone"), ascii);
    assert.equal(normalizeNumericInputValue("+989121000001", "phone"), ascii);
    assert.equal(normalizeNumericInputValue("۰۹۸۹۱۲۱۰۰۰۰۰۱", "phone"), "0989121000001");
  });
});

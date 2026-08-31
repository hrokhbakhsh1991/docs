import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatLocalizedNumber,
  formatMemberMinorAmount,
  normalizeNumericInputValue,
  toAsciiDigits,
  toLocalizedDigits,
} from "../src/i18n/format-localized-digits";

describe("portal format-localized-digits", () => {
  it("PTL-L10N-01 display maps ASCII digits to Persian for fa locale", () => {
    assert.equal(toLocalizedDigits("0", "fa"), "۰");
    assert.equal(toLocalizedDigits("1", "fa"), "۱");
    assert.equal(toLocalizedDigits("2", "fa"), "۲");
    assert.equal(toLocalizedDigits("3", "fa"), "۳");
    assert.equal(toLocalizedDigits("123456", "fa"), "۱۲۳۴۵۶");
    assert.equal(toLocalizedDigits("123456", "en"), "123456");
  });

  it("PTL-L10N-01b formatLocalizedNumber localizes user-facing counts", () => {
    assert.equal(formatLocalizedNumber(1, "fa", { useGrouping: false }), "۱");
    assert.equal(formatLocalizedNumber(2, "fa", { useGrouping: false }), "۲");
    assert.equal(formatLocalizedNumber(3, "fa", { useGrouping: false }), "۳");
    assert.equal(formatLocalizedNumber(10, "fa", { useGrouping: false }), "۱۰");
    assert.equal(formatLocalizedNumber(1, "en", { useGrouping: false }), "1");
    assert.equal(formatLocalizedNumber(2, "en", { useGrouping: false }), "2");
    assert.equal(formatLocalizedNumber(10, "en", { useGrouping: false }), "10");
  });

  it("PTL-L10N-02 mixed UI strings localize embedded digits only", () => {
    assert.equal(toLocalizedDigits("کد 123456", "fa"), "کد ۱۲۳۴۵۶");
  });

  it("PTL-L10N-03 phone input normalizes Persian digits to ASCII state", () => {
    assert.equal(normalizeNumericInputValue("۰۹۱۲۱۲۳۴۵۶۷", "phone"), "09121234567");
    assert.equal(normalizeNumericInputValue("09121234567", "phone"), "09121234567");
  });

  it("PTL-L10N-04 OTP input normalizes Persian paste to ASCII", () => {
    assert.equal(normalizeNumericInputValue("۱۲۳۴۵۶", "digits"), "123456");
    assert.equal(normalizeNumericInputValue("123456", "digits"), "123456");
  });

  it("PTL-L10N-05 formatLocalizedNumber uses Intl for fa display", () => {
    assert.equal(formatLocalizedNumber(2026, "fa", { useGrouping: false }), "۲۰۲۶");
  });

  it("PTL-L10N-06 toAsciiDigits leaves technical ASCII identifiers unchanged", () => {
    assert.equal(toAsciiDigits("uuid-9a0b-1234"), "uuid-9a0b-1234");
  });

  it("PTL-L10N-11 formatMemberMinorAmount localizes receipt-style amounts", () => {
    assert.equal(formatMemberMinorAmount("1500000", "IRR", "fa"), "۱٬۵۰۰٬۰۰۰ ریال");
    assert.equal(formatMemberMinorAmount("1500000", "IRR", "en"), "1,500,000 IRR");
  });
});

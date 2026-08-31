import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatLocalizedInteger,
  toAsciiDigits,
  toLocalizedDigits,
} from "../src/localized-digits";

describe("catalog-registration-auth localized-digits", () => {
  it("CRA-L10N-01 toLocalizedDigits maps ASCII to Persian for fa locale", () => {
    assert.equal(toLocalizedDigits("123456", "fa"), "۱۲۳۴۵۶");
    assert.equal(toLocalizedDigits("123456", "fa-IR"), "۱۲۳۴۵۶");
    assert.equal(toLocalizedDigits("123456", "en"), "123456");
  });

  it("CRA-L10N-02 mixed strings preserve non-digits", () => {
    assert.equal(toLocalizedDigits("کد 123456", "fa"), "کد ۱۲۳۴۵۶");
  });

  it("CRA-L10N-03 formatLocalizedInteger localizes countdown seconds", () => {
    assert.equal(formatLocalizedInteger(30, "fa"), "۳۰");
    assert.equal(formatLocalizedInteger(30, "en"), "30");
  });

  it("CRA-L10N-04 toAsciiDigits re-export normalizes Persian input", () => {
    assert.equal(toAsciiDigits("۰۹۱۲۱۲۳۴۵۶۷"), "09121234567");
  });
});

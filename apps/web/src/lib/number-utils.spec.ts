import test from "node:test";
import assert from "node:assert/strict";

import { convertNumbers, toEnglishDecimalString, toEnglishIntegerString } from "./number-utils";

test("convertNumbers to en maps Persian and Arabic-Indic digits", () => {
  assert.equal(convertNumbers("۰۱۲۳۴۵۶۷۸۹", "en"), "0123456789");
  assert.equal(convertNumbers("٠١٢٣٤٥٦٧٨٩", "en"), "0123456789");
  assert.equal(convertNumbers("+۹۸۹۱۲۳۴۵۶۷۸۹", "en"), "+989123456789");
});

test("convertNumbers to fa maps ASCII digits", () => {
  assert.equal(convertNumbers("0123456789", "fa"), "۰۱۲۳۴۵۶۷۸۹");
});

test("toEnglishIntegerString strips non-digits after conversion", () => {
  assert.equal(toEnglishIntegerString("۱۲۳abc۴۵"), "12345");
});

test("toEnglishDecimalString keeps one dot", () => {
  const persianWithArabicDecimalSep = `\u06f1\u06f2\u066b\u06f3\u06f4`;
  assert.equal(toEnglishDecimalString(persianWithArabicDecimalSep), "12.34");
  assert.equal(toEnglishDecimalString("12.34"), "12.34");
  assert.equal(toEnglishDecimalString("1..2"), "1.2");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeOtpDigits } from "../src/normalize-otp-digits";

test("OTP entry accepts Persian, Arabic-Indic and Latin digits including leading zeros", () => {
  assert.equal(normalizeOtpDigits("۰١ ۵-7"), "0157");
  assert.equal(normalizeOtpDigits("حروف"), "");
});

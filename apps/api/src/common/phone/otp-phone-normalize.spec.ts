import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOtpPhoneInput } from "./otp-phone-normalize";

test("normalizeOtpPhoneInput strips spaces and punctuation, keeps + and digits", () => {
  assert.equal(normalizeOtpPhoneInput(" +98 912 123 6598 "), "+989121236598");
});

test("normalizeOtpPhoneInput trims outer whitespace", () => {
  assert.equal(normalizeOtpPhoneInput("  +15551234567  "), "+15551234567");
});

test("normalizeOtpPhoneInput preserves single leading +", () => {
  assert.equal(normalizeOtpPhoneInput("+1 (555) 000-0001"), "+15550000001");
});

/**
 * OTP segment input normalization
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OTP_SEGMENT_LENGTH,
  normalizeOtpDigits,
} from "../src/features/auth/otp-segment-input.logic";

describe("otp-segment-input.spec.ts", () => {
  it("WEB-OTP-01 normalizes paste to four digits", () => {
    assert.equal(OTP_SEGMENT_LENGTH, 4);
    assert.equal(normalizeOtpDigits("12-34"), "1234");
    assert.equal(normalizeOtpDigits("12345678"), "1234");
    assert.equal(normalizeOtpDigits("ab1c2d3"), "123");
  });

  it("WEB-OTP-02 strips non-ASCII-digit separators and caps at segment length", () => {
    assert.equal(normalizeOtpDigits(""), "");
    assert.equal(normalizeOtpDigits("  1 2 "), "12");
    assert.equal(normalizeOtpDigits("0000"), "0000");
    assert.equal(normalizeOtpDigits("1a2b3c4d"), "1234");
  });

  it("WEB-OTP-03 partial paste preserves leading digits only", () => {
    assert.equal(normalizeOtpDigits("9"), "9");
    assert.equal(normalizeOtpDigits("12"), "12");
    assert.equal(normalizeOtpDigits("123"), "123");
  });

  it("WEB-OTP-04 normalizes Persian and Arabic-Indic digits", () => {
    assert.equal(normalizeOtpDigits("۱۲۳۴"), "1234");
    assert.equal(normalizeOtpDigits("٠١٢٣"), "0123");
    assert.equal(normalizeOtpDigits("۱۲-۳۴"), "1234");
  });
});

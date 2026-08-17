import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatOtpDigitIndex } from "../src/format-otp-digit-index";

describe("formatOtpDigitIndex", () => {
  it("GL-OTP-01 FA indexes are Persian digits", () => {
    assert.equal(formatOtpDigitIndex(1, "fa"), "۱");
    assert.equal(formatOtpDigitIndex(4, "fa"), "۴");
    assert.equal(formatOtpDigitIndex(1, "fa-IR"), "۱");
  });

  it("GL-OTP-01 EN indexes stay ASCII", () => {
    assert.equal(formatOtpDigitIndex(1, "en"), "1");
    assert.equal(formatOtpDigitIndex(4, "en-US"), "4");
  });
});

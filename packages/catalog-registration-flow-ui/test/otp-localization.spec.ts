import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeOtpDigits,
  OTP_SEGMENT_LENGTH,
} from "@app-tour/ui-primitives/otp-segment-input-logic";

import { toLocalizedDigits } from "@app-tour/catalog-registration-auth";

describe("catalog-registration-flow-ui otp localization contract", () => {
  it("CRF-OTP-01 normalize accepts Persian and ASCII OTP input", () => {
    assert.equal(OTP_SEGMENT_LENGTH, 4);
    assert.equal(normalizeOtpDigits("۱۲۳۴"), "1234");
    assert.equal(normalizeOtpDigits("1234"), "1234");
    assert.equal(normalizeOtpDigits("۱۲-۳۴"), "1234");
  });

  it("CRF-OTP-02 display localizes OTP cells for fa locale", () => {
    assert.equal(toLocalizedDigits("1", "fa"), "۱");
    assert.equal(toLocalizedDigits("1234", "fa"), "۱۲۳۴");
  });
});

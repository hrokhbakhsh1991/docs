/**
 * P6-1 — public catalog registration flow logic
 * @see docs/phase-19/platform-portal-otp-flow.mdoc
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPublicRegistrationProfilePayload,
  initialPublicRegistrationOtp,
  initialPublicRegistrationPhone,
  isPublicRegistrationMobileValid,
  normalizePublicRegistrationMobile,
  PUBLIC_REGISTRATION_DEV_OTP,
  PUBLIC_REGISTRATION_MIN_MOBILE_DIGITS,
  readPublicRegistrationErrorCode,
} from "../src/features/auth/public-registration-logic";

describe("public-registration-logic.spec.ts — P6-1", () => {
  it("PR-LOGIC-01 guest phone starts empty; OTP 1234 stays a development default", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      assert.equal(initialPublicRegistrationPhone(), "");
      assert.equal(initialPublicRegistrationOtp(), PUBLIC_REGISTRATION_DEV_OTP);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("PR-LOGIC-02 mobile validation requires minimum digits", () => {
    assert.equal(isPublicRegistrationMobileValid("1234567"), false);
    assert.equal(
      isPublicRegistrationMobileValid("1".repeat(PUBLIC_REGISTRATION_MIN_MOBILE_DIGITS)),
      true
    );
  });

  it("PR-LOGIC-02b normalizePublicRegistrationMobile preserves E.164 for US dev phones", () => {
    assert.equal(normalizePublicRegistrationMobile("+15550001001"), "+15550001001");
    assert.equal(normalizePublicRegistrationMobile("15550001001"), "+15550001001");
    assert.equal(normalizePublicRegistrationMobile("09123456789"), "+989123456789");
  });

  it("PR-LOGIC-03 profile payload omits email when empty", () => {
    const payload = buildPublicRegistrationProfilePayload({
      onboardingToken: "tok",
      displayName: "Ali",
      profileEmail: "",
    });
    assert.equal(payload.display_name, "Ali");
    assert.equal(payload.onboarding_token, "tok");
    assert.equal("email" in payload, false);
  });

  it("PR-LOGIC-04 profile payload includes email when provided", () => {
    const payload = buildPublicRegistrationProfilePayload({
      onboardingToken: "tok",
      displayName: "Ali",
      profileEmail: "ali@example.com",
    });
    assert.equal(payload.email, "ali@example.com");
  });

  it("PR-LOGIC-05 readPublicRegistrationErrorCode falls back to network", () => {
    assert.equal(readPublicRegistrationErrorCode({}), "network");
    assert.equal(readPublicRegistrationErrorCode({ error: { code: "OTP_INVALID" } }), "OTP_INVALID");
  });
});

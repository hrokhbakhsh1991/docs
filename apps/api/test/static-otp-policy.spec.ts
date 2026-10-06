import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLocalDevStaticOtpEnabled,
  isProductionStaticOtpExplicitlyEnabled,
  isStagingStaticOtpExplicitlyEnabled,
  isStaticOtpEnabled,
} from "../src/identity/static-otp-policy";

describe("static-otp-policy", () => {
  it("OTP-STG-01 staging static OTP requires explicit flag + staging profile", () => {
    assert.equal(
      isStagingStaticOtpExplicitlyEnabled({
        NODE_ENV: "production",
        APP_INFRA_PROFILE: "staging",
        STAGING_ALLOW_STATIC_OTP: "true",
      }),
      true
    );
    assert.equal(
      isStagingStaticOtpExplicitlyEnabled({
        NODE_ENV: "production",
        APP_INFRA_PROFILE: "production",
        STAGING_ALLOW_STATIC_OTP: "true",
      }),
      false
    );
    assert.equal(
      isStagingStaticOtpExplicitlyEnabled({
        NODE_ENV: "development",
        APP_INFRA_PROFILE: "staging",
        STAGING_ALLOW_STATIC_OTP: "true",
      }),
      true
    );
  });

  it("OTP-STG-02 production profile never enables static OTP via NODE_ENV alone", () => {
    assert.equal(
      isLocalDevStaticOtpEnabled({
        NODE_ENV: "production",
        AUTH_ALLOW_DEV_STATIC_OTP: "true",
      }),
      false
    );
    assert.equal(
      isStaticOtpEnabled({
        NODE_ENV: "production",
        APP_INFRA_PROFILE: "production",
        AUTH_ALLOW_DEV_STATIC_OTP: "true",
      }),
      false
    );
  });

  it("OTP-PROD-01 production static OTP requires the explicit single-VPS opt-in", () => {
    assert.equal(
      isProductionStaticOtpExplicitlyEnabled({
        NODE_ENV: "production",
        APP_INFRA_PROFILE: "production",
        AUTH_ALLOW_DEV_STATIC_OTP: "true",
      }),
      false
    );
    assert.equal(
      isProductionStaticOtpExplicitlyEnabled({
        NODE_ENV: "production",
        APP_INFRA_PROFILE: "production",
        AUTH_ALLOW_DEV_STATIC_OTP: "true",
        ALLOW_PRODUCTION_STATIC_OTP: "true",
      }),
      true
    );
    assert.equal(
      isStaticOtpEnabled({
        NODE_ENV: "production",
        APP_INFRA_PROFILE: "production",
        AUTH_ALLOW_DEV_STATIC_OTP: "true",
        ALLOW_PRODUCTION_STATIC_OTP: "true",
      }),
      true
    );
  });
});

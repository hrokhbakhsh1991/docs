import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  guestVisibleProfileMobile,
  initialPublicRegistrationOtp,
  initialPublicRegistrationPhone,
  PUBLIC_REGISTRATION_DEV_OTP,
  PUBLIC_REGISTRATION_DEV_PHONE,
} from "../src/public-registration-dev-defaults";
import { createCatalogRegistrationFlowInitialData } from "../src/registration-flow-state";

describe("public-registration-dev-defaults", () => {
  it("GL-PHONE-01 does not prefill the US smoke number in development", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      assert.equal(initialPublicRegistrationPhone(), "");
      assert.equal(createCatalogRegistrationFlowInitialData().phone, "");
      assert.equal(initialPublicRegistrationOtp(), PUBLIC_REGISTRATION_DEV_OTP);
      assert.equal(PUBLIC_REGISTRATION_DEV_PHONE, "+15550009901");
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("GL-BRAND-03 guestVisibleProfileMobile hides empty and the US smoke fixture", () => {
    assert.equal(guestVisibleProfileMobile(undefined), "");
    assert.equal(guestVisibleProfileMobile(null), "");
    assert.equal(guestVisibleProfileMobile("  "), "");
    assert.equal(guestVisibleProfileMobile(PUBLIC_REGISTRATION_DEV_PHONE), "");
    assert.equal(guestVisibleProfileMobile(`  ${PUBLIC_REGISTRATION_DEV_PHONE}  `), "");
    assert.equal(guestVisibleProfileMobile("09128881147"), "09128881147");
  });
});

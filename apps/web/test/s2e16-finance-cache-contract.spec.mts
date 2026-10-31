import assert from "node:assert/strict";
import test from "node:test";

import {
  isS2E16RequestAllowed,
  resolveS2E16IdentityInputs,
} from "./fixtures/s2e16-finance-cache-contract.mts";

test("S2-E16 requires distinct synthetic finance identities for both tenants", () => {
  assert.deepEqual(
    resolveS2E16IdentityInputs({
      DENALI_FIRST_STAGING_FINANCE_MOBILE: "+15559000001",
      DENALI_SECOND_STAGING_FINANCE_MOBILE: "+15559000002",
      OPERATOR_DEV_OTP: "1234",
    }),
    {
      tenantAMobile: "+15559000001",
      tenantBMobile: "+15559000002",
      otp: "1234",
    }
  );
});

test("S2-E16 rejects real, missing, or cross-tenant duplicate identities", () => {
  assert.throws(
    () =>
      resolveS2E16IdentityInputs({
        DENALI_FIRST_STAGING_FINANCE_MOBILE: "+15559000001",
        DENALI_SECOND_STAGING_FINANCE_MOBILE: "+15559000001",
      }),
    /S2E16_FINANCE_IDENTITIES_MUST_BE_DISTINCT/
  );
  assert.throws(
    () =>
      resolveS2E16IdentityInputs({
        DENALI_FIRST_STAGING_FINANCE_MOBILE: "+14155550123",
        DENALI_SECOND_STAGING_FINANCE_MOBILE: "+15559000002",
      }),
    /S2E16_TENANT_A_FINANCE_MOBILE_MUST_BE_SYNTHETIC/
  );
  assert.throws(
    () => resolveS2E16IdentityInputs({ DENALI_SECOND_STAGING_FINANCE_MOBILE: "+15559000002" }),
    /S2E16_TENANT_A_FINANCE_MOBILE_MUST_BE_SYNTHETIC/
  );
  assert.throws(
    () =>
      resolveS2E16IdentityInputs({
        DENALI_FIRST_STAGING_FINANCE_MOBILE: "+15559000001",
        DENALI_SECOND_STAGING_FINANCE_MOBILE: "+15559000002",
      }),
    /S2E16_STATIC_OTP_REQUIRED/
  );
});

test("S2-E16 permits only safe reads and the two OTP login bootstrap writes", () => {
  assert.equal(isS2E16RequestAllowed("GET", "/api/finance/payments"), true);
  assert.equal(isS2E16RequestAllowed("OPTIONS", "/api/finance/payments"), true);
  assert.equal(isS2E16RequestAllowed("POST", "/api/auth/request-otp"), true);
  assert.equal(isS2E16RequestAllowed("POST", "/api/auth/login-web-session"), true);
  assert.equal(isS2E16RequestAllowed("POST", "/api/finance/payments"), false);
  assert.equal(isS2E16RequestAllowed("PATCH", "/api/finance/payments/id"), false);
  assert.equal(isS2E16RequestAllowed("DELETE", "/api/auth/session"), false);
});

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  assertBffLoginRateLimit,
  readBffLoginRateLimitKey,
  resetBffLoginRateLimitForTests,
} from "../src/auth/bff-login-rate-limit";

describe("portal bff-login-rate-limit wrapper", () => {
  afterEach(() => {
    resetBffLoginRateLimitForTests();
  });

  it("keeps portal OTP rate key semantics on the shared helper", () => {
    const req = new Request("http://denali.portal.localhost:3003/api/public-auth/request-otp", {
      headers: {
        host: "denali.portal.localhost:3003",
        "x-forwarded-for": "203.0.113.20",
      },
    });

    assert.equal(
      readBffLoginRateLimitKey(req, "+15550001002"),
      "denali.portal.localhost:3003:203.0.113.20:+15550001002"
    );
  });

  it("keeps portal OTP limit at ten attempts per window", () => {
    const key = "portal-host:127.0.0.1:+15550001002";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.doesNotThrow(() => assertBffLoginRateLimit(key));
    }
    assert.throws(() => assertBffLoginRateLimit(key), /OTP_RATE_LIMITED/);
  });
});

/**
 * BFF login rate limit key + window
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  assertBffLoginRateLimit,
  readBffLoginRateLimitKey,
  resetBffLoginRateLimitForTests,
} from "../src/auth/bff-login-rate-limit";

describe("bff-login-rate-limit.spec.ts", () => {
  afterEach(() => {
    resetBffLoginRateLimitForTests();
  });

  it("BFF-RL-01 rate key scopes host, ip, and phone", () => {
    const req = new Request("http://denali.localhost:3000/api/auth/request-otp", {
      headers: {
        host: "denali.localhost:3000",
        "x-forwarded-for": "203.0.113.10",
      },
    });
    assert.equal(
      readBffLoginRateLimitKey(req, "+15550001001"),
      "denali.localhost:3000:203.0.113.10:+15550001001"
    );
  });

  it("BFF-RL-02 blocks after ten attempts in window", () => {
    const key = "test-host:127.0.0.1:+15550001001";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.doesNotThrow(() => assertBffLoginRateLimit(key));
    }
    assert.throws(() => assertBffLoginRateLimit(key), /OTP_RATE_LIMITED/);
  });
});

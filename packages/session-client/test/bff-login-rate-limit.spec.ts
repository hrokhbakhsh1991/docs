import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  assertBffLoginRateLimit,
  checkBffLoginRateLimit,
  readBffLoginRateLimitKey,
  resetBffLoginRateLimitForTests,
} from "../src";

describe("bff-login-rate-limit", () => {
  afterEach(() => {
    resetBffLoginRateLimitForTests();
  });

  it("scopes rate key by host, ip, and phone", () => {
    const req = new Request("http://denali.localhost:3000/api/auth/request-otp", {
      headers: {
        host: "denali.localhost:3000",
        "x-forwarded-for": "203.0.113.10, 198.51.100.2",
      },
    });

    assert.equal(
      readBffLoginRateLimitKey(req, "+15550001001"),
      "denali.localhost:3000:203.0.113.10:+15550001001"
    );
  });

  it("uses request URL host fallback when host header is absent", () => {
    const req = new Request("http://portal.localhost:3003/api/public-auth/request-otp", {
      headers: {
        "x-real-ip": "203.0.113.11",
      },
    });

    assert.equal(readBffLoginRateLimitKey(req), "portal.localhost:3003:203.0.113.11");
  });

  it("blocks after ten attempts in a window", () => {
    const key = "test-host:127.0.0.1:+15550001001";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      assert.doesNotThrow(() => assertBffLoginRateLimit(key));
    }
    assert.throws(() => assertBffLoginRateLimit(key), /OTP_RATE_LIMITED/);
    assert.equal(checkBffLoginRateLimit(key), false);
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { resolveThrottleClientIp } from "../../src/common/throttling/public-registration-throttle";

test("resolveThrottleClientIp ignores x-forwarded-for when no trusted proxies configured", () => {
  assert.equal(
    resolveThrottleClientIp({
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
      ip: "198.51.100.20",
      socket: { remoteAddress: "198.51.100.20" }
    }),
    "198.51.100.20"
  );
});

test("resolveThrottleClientIp resolves client from x-forwarded-for when remote is trusted", () => {
  assert.equal(
    resolveThrottleClientIp(
      {
        headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.2" },
        ip: "10.0.0.2",
        socket: { remoteAddress: "10.0.0.2" }
      },
      { trustedProxyCidrs: ["10.0.0.0/8"] }
    ),
    "203.0.113.1"
  );
});

test("resolveThrottleClientIp rejects malformed x-forwarded-for and falls back to remote", () => {
  assert.equal(
    resolveThrottleClientIp(
      {
        headers: { "x-forwarded-for": "203.0.113.1, not-an-ip" },
        ip: "10.0.0.2",
        socket: { remoteAddress: "10.0.0.2" }
      },
      { trustedProxyCidrs: ["10.0.0.0/8"] }
    ),
    "10.0.0.2"
  );
});

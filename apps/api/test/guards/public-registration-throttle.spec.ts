import assert from "node:assert/strict";
import test from "node:test";
import { resolveThrottleClientIp } from "../../src/common/throttling/public-registration-throttle";

test("resolveThrottleClientIp prefers first x-forwarded-for entry", () => {
  assert.equal(
    resolveThrottleClientIp({
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
      ip: "127.0.0.1"
    }),
    "203.0.113.1"
  );
});

test("resolveThrottleClientIp falls back to req.ip", () => {
  assert.equal(
    resolveThrottleClientIp({
      headers: {},
      ip: "192.0.2.10"
    }),
    "192.0.2.10"
  );
});

test("resolveThrottleClientIp uses unknown without ip or forwarded header", () => {
  assert.equal(
    resolveThrottleClientIp({
      headers: {},
      ip: undefined
    }),
    "unknown"
  );
});

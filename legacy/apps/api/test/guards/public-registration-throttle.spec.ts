import assert from "node:assert/strict";
import test from "node:test";
import {
  publicRegistrationThrottleKey,
  resolveThrottleClientIp
} from "../../src/common/throttling/public-registration-throttle";
import { requestContextStorage } from "../../src/common/request-context/request-context";

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

test("publicRegistrationThrottleKey differs when tenantId is in request context", () => {
  const ctx = {} as never;
  const ip = "198.51.100.10";
  const name = "tour-create";
  const base = publicRegistrationThrottleKey(ctx, ip, name);
  const withTenant = requestContextStorage.run(
    { requestId: "r1", tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    () => publicRegistrationThrottleKey(ctx, ip, name)
  );
  assert.notEqual(base, withTenant);
});

test("publicRegistrationThrottleKey differs when userId is set with tenantId", () => {
  const ctx = {} as never;
  const ip = "198.51.100.11";
  const name = "tour-create";
  const tenantOnly = requestContextStorage.run(
    { requestId: "r2", tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    () => publicRegistrationThrottleKey(ctx, ip, name)
  );
  const tenantAndUser = requestContextStorage.run(
    {
      requestId: "r3",
      tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    },
    () => publicRegistrationThrottleKey(ctx, ip, name)
  );
  assert.notEqual(tenantOnly, tenantAndUser);
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

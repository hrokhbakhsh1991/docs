import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resolvePasswordClientIp,
  readPasswordClientIpConfig,
  signPasswordIngress,
  verifyPasswordIngress,
} from "../src/password-ingress-server";

test("password ingress proof binds IP, phone, tenant and freshness", () => {
  const secret = Buffer.alloc(32, 1);
  const input = {
    tenantId: "tenant-a",
    mobile: "09120000000",
    ip: "192.0.2.4",
    timestamp: 1_700_000_000_000,
  };
  const signature = signPasswordIngress(input, secret);
  assert.equal(verifyPasswordIngress(input, signature, secret, input.timestamp + 1_000), true);
  assert.equal(
    verifyPasswordIngress({ ...input, tenantId: "tenant-b" }, signature, secret, input.timestamp),
    false
  );
  assert.equal(
    verifyPasswordIngress({ ...input, mobile: "09120000001" }, signature, secret, input.timestamp),
    false
  );
  assert.equal(
    verifyPasswordIngress({ ...input, ip: "192.0.2.5" }, signature, secret, input.timestamp),
    false
  );
  assert.equal(verifyPasswordIngress(input, signature, secret, input.timestamp + 30_001), false);
  assert.equal(verifyPasswordIngress(input, "not-a-signature", secret, input.timestamp), false);
});

test("trusted edge mode accepts only a valid client IP from a configured proxy", () => {
  const config = readPasswordClientIpConfig({
    NODE_ENV: "production",
    PASSWORD_AUTH_CLIENT_IP_MODE: "trusted-edge",
    PASSWORD_AUTH_TRUSTED_EDGE_CIDRS: "185.143.232.0/22,2001:db8::/32",
  });
  assert.ok(config);
  assert.equal(resolvePasswordClientIp("185.143.233.10", "203.0.113.5", config), "203.0.113.5");
  assert.equal(resolvePasswordClientIp("198.51.100.10", "203.0.113.5", config), null);
  assert.equal(
    resolvePasswordClientIp("185.143.233.10", "203.0.113.5, 198.51.100.2", config),
    null
  );
  assert.equal(resolvePasswordClientIp("185.143.233.10", "", config), null);
  assert.equal(
    resolvePasswordClientIp("2001:db8::1", "2001:db8:ffff::1", config),
    "2001:db8:ffff::1"
  );
});

test("production IP mode is explicit and rejects malformed or all-address CIDRs", () => {
  assert.equal(readPasswordClientIpConfig({ NODE_ENV: "production" }), null);
  assert.equal(
    readPasswordClientIpConfig({
      NODE_ENV: "production",
      PASSWORD_AUTH_CLIENT_IP_MODE: "trusted-edge",
      PASSWORD_AUTH_TRUSTED_EDGE_CIDRS: "0.0.0.0/0",
    }),
    null
  );
  assert.equal(
    readPasswordClientIpConfig({
      NODE_ENV: "production",
      PASSWORD_AUTH_CLIENT_IP_MODE: "trusted-edge",
      PASSWORD_AUTH_TRUSTED_EDGE_CIDRS: "invalid",
    }),
    null
  );
  assert.ok(readPasswordClientIpConfig({ NODE_ENV: "development" }));
  const direct = readPasswordClientIpConfig({ NODE_ENV: "production", PASSWORD_AUTH_CLIENT_IP_MODE: "direct" });
  assert.ok(direct);
  assert.equal(resolvePasswordClientIp("198.51.100.10", "203.0.113.7", direct), "198.51.100.10");
});

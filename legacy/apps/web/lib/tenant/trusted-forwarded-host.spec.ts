import assert from "node:assert/strict";
import test from "node:test";

import {
  isIpInTrustedProxyCidrs,
  parseTrustedProxyCidrsCsv,
  resolveInboundHostname,
} from "./trusted-forwarded-host";

test("parseTrustedProxyCidrsCsv splits and trims", () => {
  assert.deepEqual(parseTrustedProxyCidrsCsv(" 127.0.0.1/32 , 10.0.0.0/8 "), [
    "127.0.0.1/32",
    "10.0.0.0/8",
  ]);
});

test("resolveInboundHostname ignores x-forwarded-host when trust proxy disabled", () => {
  const headers = new Headers({
    host: "ws1-rbac.localhost:3000",
    "x-forwarded-host": "evil.example",
  });
  assert.equal(resolveInboundHostname(headers, { remoteIp: "127.0.0.1" }), "ws1-rbac.localhost:3000");
});

test("resolveInboundHostname uses x-forwarded-host when proxy trust + CIDR match", () => {
  const prevTrust = process.env.NEXT_PUBLIC_TRUST_PROXY;
  const prevCidrs = process.env.NEXT_PUBLIC_TRUSTED_PROXY_CIDRS;
  process.env.NEXT_PUBLIC_TRUST_PROXY = "true";
  process.env.NEXT_PUBLIC_TRUSTED_PROXY_CIDRS = "127.0.0.1/32";

  try {
    const headers = new Headers({
      host: "ws1-rbac.localhost:3000",
      "x-forwarded-host": "ws2-rbac.localhost",
    });
    assert.equal(
      resolveInboundHostname(headers, { remoteIp: "127.0.0.1" }),
      "ws2-rbac.localhost",
    );
    assert.equal(isIpInTrustedProxyCidrs("127.0.0.1", ["127.0.0.1/32"]), true);
  } finally {
    if (prevTrust === undefined) {
      delete process.env.NEXT_PUBLIC_TRUST_PROXY;
    } else {
      process.env.NEXT_PUBLIC_TRUST_PROXY = prevTrust;
    }
    if (prevCidrs === undefined) {
      delete process.env.NEXT_PUBLIC_TRUSTED_PROXY_CIDRS;
    } else {
      process.env.NEXT_PUBLIC_TRUSTED_PROXY_CIDRS = prevCidrs;
    }
  }
});

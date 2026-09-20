import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";

import { readIngressHost } from "./read-ingress-host";

const originalTrustProxyHops = process.env.TRUST_PROXY_HOPS;
const originalTrustedProxyIps = process.env.TRUSTED_PROXY_IPS;

afterEach(() => {
  if (originalTrustProxyHops === undefined) delete process.env.TRUST_PROXY_HOPS;
  else process.env.TRUST_PROXY_HOPS = originalTrustProxyHops;
  if (originalTrustedProxyIps === undefined) delete process.env.TRUSTED_PROXY_IPS;
  else process.env.TRUSTED_PROXY_IPS = originalTrustedProxyIps;
});

function request(headers: IncomingMessage["headers"]): IncomingMessage {
  return {
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  } as IncomingMessage;
}

describe("readIngressHost", () => {
  it("ignores client-supplied forwarded host by default", () => {
    delete process.env.TRUST_PROXY_HOPS;
    delete process.env.TRUSTED_PROXY_IPS;
    assert.equal(readIngressHost(request({
      host: "denali.localhost:3001",
      "x-forwarded-host": "urban.localhost:3001",
    })), "denali.localhost");
  });

  it("accepts the first forwarded host only from a configured proxy", () => {
    process.env.TRUST_PROXY_HOPS = "1";
    process.env.TRUSTED_PROXY_IPS = "127.0.0.1";
    assert.equal(readIngressHost(request({
      host: "127.0.0.1:3001",
      "x-forwarded-host": "urban.localhost:3001, proxy.localhost:3001",
    })), "urban.localhost");
  });
});

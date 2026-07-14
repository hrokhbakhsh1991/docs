import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isLocalhostIngressHost } from "../src/is-localhost-ingress-host";

describe("isLocalhostIngressHost — PCMS-COOK-02", () => {
  it("PCMS-LH-01 accepts denali.localhost and denali.portal.localhost", () => {
    assert.equal(isLocalhostIngressHost("denali.localhost:3002"), true);
    assert.equal(isLocalhostIngressHost("denali.portal.localhost:3003"), true);
  });

  it("PCMS-LH-02 accepts bare localhost with port", () => {
    assert.equal(isLocalhostIngressHost("localhost:3002"), true);
  });

  it("PCMS-LH-03 rejects IP literals", () => {
    assert.equal(isLocalhostIngressHost("127.0.0.1:3002"), false);
    assert.equal(isLocalhostIngressHost("[::1]:3002"), false);
  });

  it("PCMS-LH-04 rejects production FQDNs", () => {
    assert.equal(isLocalhostIngressHost("denali.club"), false);
    assert.equal(isLocalhostIngressHost("portal.denali.club:443"), false);
  });
});

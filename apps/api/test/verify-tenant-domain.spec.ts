import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { verifyTenantDomainCname } from "../src/platform/verify-tenant-domain.ts";

describe("verifyTenantDomainCname", () => {
  it("pass match", () => {
    const result = verifyTenantDomainCname({
      hostname: "www.example.com",
      cnameTarget: "club.example.test",
      observedCname: "club.example.test",
    });
    assert.equal(result.ok, true);
  });

  it("fail wrong", () => {
    const old = process.env.PLATFORM_DOMAIN_VERIFY_STUB;
    delete process.env.PLATFORM_DOMAIN_VERIFY_STUB;
    try {
      const result = verifyTenantDomainCname({
        hostname: "www.example.com",
        cnameTarget: "club.example.test",
        observedCname: "wrong.example.test",
      });
      assert.equal(result.ok, false);
    } finally {
      process.env.PLATFORM_DOMAIN_VERIFY_STUB = old;
    }
  });

  it("live verify passes with stub env", async () => {
    const oldStub = process.env.PLATFORM_DOMAIN_VERIFY_STUB;
    const oldDns = process.env.PLATFORM_DOMAIN_DNS_LOOKUP;
    process.env.PLATFORM_DOMAIN_VERIFY_STUB = "pass";
    process.env.PLATFORM_DOMAIN_DNS_LOOKUP = "off";
    try {
      const { verifyTenantDomainCnameLive } = await import("../src/platform/verify-tenant-domain.ts");
      const result = await verifyTenantDomainCnameLive({
        hostname: "www.example.com",
        cnameTarget: "club.example.test",
      });
      assert.equal(result.ok, true);
    } finally {
      process.env.PLATFORM_DOMAIN_VERIFY_STUB = oldStub;
      process.env.PLATFORM_DOMAIN_DNS_LOOKUP = oldDns;
    }
  });
});

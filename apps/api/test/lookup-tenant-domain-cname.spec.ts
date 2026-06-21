import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { lookupTenantDomainCname } from "../src/platform/lookup-tenant-domain-cname.ts";

describe("lookupTenantDomainCname", () => {
  it("returns null when DNS lookup is off", async () => {
    const previous = process.env.PLATFORM_DOMAIN_DNS_LOOKUP;
    process.env.PLATFORM_DOMAIN_DNS_LOOKUP = "off";
    try {
      const result = await lookupTenantDomainCname("www.example.com");
      assert.equal(result, null);
    } finally {
      process.env.PLATFORM_DOMAIN_DNS_LOOKUP = previous;
    }
  });
});

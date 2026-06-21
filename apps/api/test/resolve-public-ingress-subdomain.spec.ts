import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePublicIngressSubdomain } from "../src/tenant/resolve-public-ingress-subdomain.ts";

describe("resolvePublicIngressSubdomain", () => {
  it("returns platform subdomain from admin host", async () => {
    process.env.PLATFORM_ROOT_DOMAIN = "example.test";
    process.env.TENANT_ROOT_DOMAIN = "example.test";
    const subdomain = await resolvePublicIngressSubdomain("acme.admin.example.test");
    assert.equal(subdomain, "acme");
  });
});

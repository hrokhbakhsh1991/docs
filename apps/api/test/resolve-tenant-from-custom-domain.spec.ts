import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformDomainRepository } from "../src/platform/platform-domain.repository.ts";
import { resolveTenantFromCustomDomainHost } from "../src/platform/resolve-tenant-from-custom-domain.ts";

describe("resolveTenantFromCustomDomainHost", () => {
  it("returns subdomain when domain is verified and ssl active", async () => {
    const repository = new PlatformDomainRepository({
      tenantDomain: {
        findFirst: async () => ({
          tenantId: "t1",
          surface: "marketing",
          tenant: { subdomain: "acme" },
        }),
      },
    } as never);

    const result = await resolveTenantFromCustomDomainHost("www.custom.test", {
      domainRepository: repository,
    });
    assert.deepEqual(result, { tenantId: "t1", subdomain: "acme", surface: "marketing" });
  });
});

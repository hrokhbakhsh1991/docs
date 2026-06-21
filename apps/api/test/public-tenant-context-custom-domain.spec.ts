import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformDomainRepository } from "../src/platform/platform-domain.repository.ts";
import { resolveTenantFromCustomDomainHost } from "../src/platform/resolve-tenant-from-custom-domain.ts";

/**
 * PTC-CD-01 minimum: unit coverage for custom-host tenant resolution.
 * Full HTTP integration with seeded domain row deferred — requires Postgres + migrate.
 */
describe("public tenant context custom domain", () => {
  it("resolves verified active custom hostname to tenant subdomain", async () => {
    const repository = new PlatformDomainRepository({
      tenantDomain: {
        findFirst: async () => ({
          tenantId: "t1",
          surface: "marketing",
          tenant: { subdomain: "acme" },
        }),
      },
    } as never);

    const resolved = await resolveTenantFromCustomDomainHost("www.custom.test", {
      domainRepository: repository,
    });
    assert.equal(resolved?.subdomain, "acme");
  });
});

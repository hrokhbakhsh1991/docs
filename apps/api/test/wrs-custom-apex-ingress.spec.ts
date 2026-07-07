import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformDomainRepository } from "../src/platform/platform-domain.repository.ts";
import { resolveTenantFromCustomDomainHost } from "../src/platform/resolve-tenant-from-custom-domain.ts";
import { resolvePublicIngressSubdomain } from "../src/tenant/resolve-public-ingress-subdomain.ts";

const DENALI_TENANT_ID = "00000000-0000-4000-8000-000000000003";

describe("WRS custom apex ingress", () => {
  it("WRS-API-01 resolves denali.club via verified tenant_domains row", async () => {
    const repository = new PlatformDomainRepository({
      tenantDomain: {
        findFirst: async ({ where }: { where: { hostname: string } }) => {
          if (where.hostname === "denali.club") {
            return {
              tenantId: DENALI_TENANT_ID,
              surface: "marketing",
              tenant: { subdomain: "denali" },
            };
          }
          return null;
        },
      },
    } as never);

    const resolved = await resolveTenantFromCustomDomainHost("denali.club", {
      domainRepository: repository,
    });
    assert.equal(resolved?.tenantId, DENALI_TENANT_ID);
    assert.equal(resolved?.subdomain, "denali");
    assert.equal(resolved?.surface, "marketing");
  });

  it("WRS-API-02 resolvePublicIngressSubdomain prefers platform host before custom domain", async () => {
    const subdomain = await resolvePublicIngressSubdomain("operator.localhost");
    assert.equal(subdomain, "operator");
  });

  it("WRS-API-03 legacy shop ingress strips to club apex subdomain", async () => {
    const subdomain = await resolvePublicIngressSubdomain("shop.operator.localhost:3002");
    assert.equal(subdomain, "operator");
  });
});

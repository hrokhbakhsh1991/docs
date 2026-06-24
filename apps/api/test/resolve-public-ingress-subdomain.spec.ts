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

  it("P8-0-N-001 raw VPS IP uses PUBLIC_TENANT_FALLBACK_LABEL when allowlisted", async () => {
    process.env.TENANT_ROOT_DOMAIN = "localhost";
    process.env.PUBLIC_TENANT_FALLBACK_LABEL = "operator";
    process.env.PUBLIC_TENANT_FALLBACK_HOSTS = "89.45.89.206";
    const subdomain = await resolvePublicIngressSubdomain("89.45.89.206:23001");
    assert.equal(subdomain, "operator");
  });

  it("P8-0-N-001 bare IP unknown without fallback env", async () => {
    delete process.env.PUBLIC_TENANT_FALLBACK_LABEL;
    delete process.env.PUBLIC_TENANT_FALLBACK_HOSTS;
    process.env.TENANT_ROOT_DOMAIN = "localhost";
    const subdomain = await resolvePublicIngressSubdomain("89.45.89.206");
    assert.equal(subdomain, null);
  });
});

describe("resolvePublicIngressSurfaceKind — P8-0-N-003", () => {
  it("G-ING-04a club_admin vs club_portal vs club_apex", async () => {
    const { resolvePublicIngressSurfaceKind } = await import(
      "../src/tenant/resolve-public-ingress-subdomain.ts"
    );
    process.env.TENANT_ROOT_DOMAIN = "localhost";
    assert.equal(resolvePublicIngressSurfaceKind("operator.admin.localhost"), "club_admin");
    assert.equal(resolvePublicIngressSurfaceKind("operator.portal.localhost"), "club_portal");
    assert.equal(resolvePublicIngressSurfaceKind("operator.localhost"), "club_apex");
    assert.equal(resolvePublicIngressSurfaceKind("shop.operator.localhost"), "club_apex");
  });
});

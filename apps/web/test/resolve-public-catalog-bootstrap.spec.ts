/**
 * Public catalog tenant bootstrap (M17.1)
 * Authority: docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  isPublicCatalogPath,
  resolvePublicCatalogBootstrapForHost,
} from "../src/tenant/resolve-public-catalog-bootstrap.server";
import { resolveIdentityBffTenantId } from "../src/auth/resolve-identity-bff-tenant";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  ALLOW_DEV_WEB_SESSION: process.env.ALLOW_DEV_WEB_SESSION,
};

afterEach(() => {
  process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
  process.env.ALLOW_DEV_WEB_SESSION = ENV_SNAPSHOT.ALLOW_DEV_WEB_SESSION;
});

describe("resolve-public-catalog-bootstrap.spec.ts — M17.1", () => {
  it("PUB-BOOT-01 isPublicCatalogPath matches catalog routes", () => {
    assert.equal(isPublicCatalogPath("/catalog"), true);
    assert.equal(isPublicCatalogPath("/catalog/tour-1/register"), true);
    assert.equal(isPublicCatalogPath("/dashboard"), false);
  });

  it("PUB-BOOT-02 dev host map resolves urban tenant", async () => {
    process.env.NODE_ENV = "development";
    process.env.ALLOW_DEV_WEB_SESSION = "true";
    const bootstrap = await resolvePublicCatalogBootstrapForHost("urban.localhost:3000");
    assert.equal(bootstrap.tenantId, "00000000-0000-4000-8000-000000000004");
    assert.equal(bootstrap.pluginId, "urban");
  });

  it("PUB-BOOT-03 unresolved production host throws (no silent urban fallback)", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.ALLOW_DEV_WEB_SESSION;
    await assert.rejects(
      () => resolvePublicCatalogBootstrapForHost("unknown-brand.example.com"),
      /PUBLIC_CATALOG_TENANT_UNRESOLVED/
    );
    await assert.rejects(
      () => resolveIdentityBffTenantId("unknown-brand.example.com"),
      /PUBLIC_CATALOG_TENANT_UNRESOLVED/
    );
  });
});

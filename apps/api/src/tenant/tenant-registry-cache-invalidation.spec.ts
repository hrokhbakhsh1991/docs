/**
 * DEC-074 / PU-F-01 — write-path registry cache invalidation.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { RegisteredTenant } from "./tenant-registry";
import {
  getCachedTenantById,
  getCachedTenantBySubdomain,
  getCachedTenantThemeById,
  invalidateTenantRegistryCache,
  resetTenantRegistryCacheForTests,
  setCachedTenantById,
  setCachedTenantBySubdomain,
  setCachedTenantThemeById,
} from "./tenant-registry-cache";

const sampleTenant = (id: string, subdomain: string): RegisteredTenant => ({
  id,
  subdomain,
  workspaceType: "starter",
  theme: { primaryColor: "#111111" },
});

describe("tenant registry cache invalidation (DEC-074)", () => {
  afterEach(() => {
    resetTenantRegistryCacheForTests();
  });

  it("invalidateTenantRegistryCache clears byId, bySubdomain, and themeById", () => {
    const tenant = sampleTenant("tenant-1", "acme");
    setCachedTenantById(tenant.id, tenant);
    setCachedTenantBySubdomain(tenant.subdomain, tenant);
    setCachedTenantThemeById(tenant.id, { rateLimitRps: 99 });

    invalidateTenantRegistryCache(tenant.id, tenant.subdomain);

    assert.equal(getCachedTenantById(tenant.id), undefined);
    assert.equal(getCachedTenantBySubdomain(tenant.subdomain), undefined);
    assert.equal(getCachedTenantThemeById(tenant.id), undefined);
  });

  it("invalidate without subdomain still clears id and theme layers", () => {
    const tenant = sampleTenant("tenant-2", "beta");
    setCachedTenantById(tenant.id, tenant);
    setCachedTenantBySubdomain(tenant.subdomain, tenant);
    setCachedTenantThemeById(tenant.id, { featureFlags: { x: true } });

    invalidateTenantRegistryCache(tenant.id);

    assert.equal(getCachedTenantById(tenant.id), undefined);
    assert.equal(getCachedTenantThemeById(tenant.id), undefined);
    assert.equal(getCachedTenantBySubdomain(tenant.subdomain)?.id, tenant.id);
  });

  it("no-op on empty tenant id", () => {
    setCachedTenantById("keep-me", null);
    invalidateTenantRegistryCache("   ");
    assert.equal(getCachedTenantById("keep-me"), null);
  });
});

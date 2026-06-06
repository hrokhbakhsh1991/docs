/**
 * Phase 3 step 17 — registry cache max-size sweep (DEC-068 / SCAL-DEBT-12).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  readTenantRegistryCacheSizesForTests,
  resetTenantRegistryCacheForTests,
  resolveTenantRegistryCacheMaxEntries,
  setCachedTenantById,
  setCachedTenantThemeById,
} from "./tenant-registry-cache";

describe("tenant registry cache bounds (DEC-068)", () => {
  const prevMax = process.env.TENANT_REGISTRY_CACHE_MAX_ENTRIES;

  afterEach(() => {
    resetTenantRegistryCacheForTests();
    if (prevMax === undefined) {
      delete process.env.TENANT_REGISTRY_CACHE_MAX_ENTRIES;
    } else {
      process.env.TENANT_REGISTRY_CACHE_MAX_ENTRIES = prevMax;
    }
  });

  it("resolves default max entries", () => {
    delete process.env.TENANT_REGISTRY_CACHE_MAX_ENTRIES;
    assert.equal(resolveTenantRegistryCacheMaxEntries(), 1024);
  });

  it("evicts oldest byId entries when max cap is exceeded", () => {
    process.env.TENANT_REGISTRY_CACHE_MAX_ENTRIES = "2";

    setCachedTenantById("tenant-a", null);
    setCachedTenantById("tenant-b", null);
    setCachedTenantById("tenant-c", null);

    const sizes = readTenantRegistryCacheSizesForTests();
    assert.equal(sizes.byId, 2);
  });

  it("evicts oldest theme entries when max cap is exceeded", () => {
    process.env.TENANT_REGISTRY_CACHE_MAX_ENTRIES = "2";

    setCachedTenantThemeById("theme-a", { rateLimitRps: 1 });
    setCachedTenantThemeById("theme-b", { rateLimitRps: 2 });
    setCachedTenantThemeById("theme-c", { rateLimitRps: 3 });

    const sizes = readTenantRegistryCacheSizesForTests();
    assert.equal(sizes.themeById, 2);
  });
});

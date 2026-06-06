import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  getCachedTenantConfigPayload,
  invalidateTenantConfigResponseCache,
  resetTenantConfigResponseCacheForTests,
  setCachedTenantConfigPayload,
} from "./tenant-config-response-cache";

describe("tenant-config response cache (DEC-129)", () => {
  const previousTtl = process.env.TENANT_CONFIG_RESPONSE_CACHE_TTL_MS;

  afterEach(() => {
    resetTenantConfigResponseCacheForTests();
    if (previousTtl === undefined) {
      delete process.env.TENANT_CONFIG_RESPONSE_CACHE_TTL_MS;
    } else {
      process.env.TENANT_CONFIG_RESPONSE_CACHE_TTL_MS = previousTtl;
    }
  });

  it("returns cached payload until TTL expires", async () => {
    setCachedTenantConfigPayload("tenant-a", '{"tenantId":"tenant-a"}');
    assert.equal(getCachedTenantConfigPayload("tenant-a"), '{"tenantId":"tenant-a"}');
    assert.equal(getCachedTenantConfigPayload("TENANT-A"), '{"tenantId":"tenant-a"}');
  });

  it("evicts payload on invalidation", () => {
    setCachedTenantConfigPayload("tenant-b", '{"tenantId":"tenant-b"}');
    invalidateTenantConfigResponseCache("tenant-b");
    assert.equal(getCachedTenantConfigPayload("tenant-b"), undefined);
  });

  it("expires entries after TTL", async () => {
    process.env.TENANT_CONFIG_RESPONSE_CACHE_TTL_MS = "20";
    setCachedTenantConfigPayload("tenant-c", '{"tenantId":"tenant-c"}');
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(getCachedTenantConfigPayload("tenant-c"), undefined);
  });
});

import assert from "node:assert";
import { describe, it } from "node:test";
import { seedTenantBrandingConfig } from "../src/platform/seed-tenant-branding-config.ts";

describe("P1-N-048: seedTenantBrandingConfig", () => {
  it("should be a function that accepts tx, tenantId, and workspaceType", () => {
    assert.strictEqual(typeof seedTenantBrandingConfig, "function");
    assert.strictEqual(seedTenantBrandingConfig.length, 3);
  });

  it("should return a Promise", () => {
    // Mock transaction client
    const mockTx = {
      tenantConfig: {
        upsert: async () => ({}),
      },
    };

    const result = seedTenantBrandingConfig(mockTx as any, "test-tenant-id", "denali");

    assert.ok(result instanceof Promise, "Should return a Promise");
  });
});

// Made with Bob

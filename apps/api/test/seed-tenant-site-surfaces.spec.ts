import assert from "node:assert";
import { describe, it } from "node:test";
import { seedTenantSiteSurfacesConfig } from "../src/platform/seed-tenant-site-surfaces-config.ts";

describe("P1-N-050: seedTenantSiteSurfacesConfig", () => {
  it("should enable admin surface", async () => {
    let savedPayload: any = null;

    const mockTx = {
      tenantConfig: {
        upsert: async ({ create }: any) => {
          savedPayload = create.payload;
          return {};
        },
      },
    };

    await seedTenantSiteSurfacesConfig(mockTx as any, "test-tenant-id");

    assert.strictEqual(savedPayload.admin, true, "admin surface should be true");
  });

  it("should enable marketing surface", async () => {
    let savedPayload: any = null;

    const mockTx = {
      tenantConfig: {
        upsert: async ({ create }: any) => {
          savedPayload = create.payload;
          return {};
        },
      },
    };

    await seedTenantSiteSurfacesConfig(mockTx as any, "test-tenant-id");

    assert.strictEqual(savedPayload.marketing, true, "marketing surface should be true");
  });
});

// Made with Bob

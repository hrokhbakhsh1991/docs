/**
 * P4-C — tenant site_surfaces read path
 * @see docs/phase-17/platform-club-surfaces-config.mdoc
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_TENANT_SITE_SURFACES,
  normalizeTenantSiteSurfaces,
  readTenantSiteSurfacesByTenantId,
} from "../src/platform/read-tenant-site-surfaces.ts";

describe("read-tenant-site-surfaces (P4-C SS)", () => {
  it("SS-01 returns defaults when DATABASE_URL unset (memory harness)", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const surfaces = await readTenantSiteSurfacesByTenantId("00000000-0000-4000-8000-000000000001");
      assert.deepEqual(surfaces, DEFAULT_TENANT_SITE_SURFACES);
    } finally {
      if (prev !== undefined) {
        process.env.DATABASE_URL = prev;
      } else {
        delete process.env.DATABASE_URL;
      }
    }
  });

  it("SS-02 normalizeTenantSiteSurfaces coerces payload", () => {
    assert.deepEqual(normalizeTenantSiteSurfaces(null), DEFAULT_TENANT_SITE_SURFACES);
    assert.deepEqual(normalizeTenantSiteSurfaces({ marketing: false, portal: false }), {
      admin: true,
      marketing: false,
      portal: false,
    });
    assert.equal(normalizeTenantSiteSurfaces({ admin: false }).admin, true);
  });
});

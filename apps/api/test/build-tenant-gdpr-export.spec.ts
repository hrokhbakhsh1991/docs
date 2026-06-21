import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTenantGdprExport } from "../src/platform/build-tenant-gdpr-export.ts";

describe("buildTenantGdprExport", () => {
  it("scopes tours to tenantId", async () => {
    const tenantId = "00000000-0000-4000-8000-000000000001";
    const prisma = {
      tenant: {
        findUnique: async () => ({
          id: tenantId,
          subdomain: "acme",
          status: "active",
        }),
      },
      tenantConfig: { findMany: async () => [] },
      userTenant: { findMany: async () => [] },
      operatorPendingInvite: { findMany: async () => [] },
      tour: {
        findMany: async () => [
          {
            id: "tour-1",
            tenantId,
            canonical: {},
            title: "Tour",
            publishStatus: "draft",
            publishedAt: null,
            createdAt: new Date("2026-06-21T10:00:00.000Z"),
          },
        ],
      },
      tenantDomain: { findMany: async () => [] },
      auditEvent: { findMany: async () => [] },
      platformAuditEvent: { findMany: async () => [] },
    };

    const bundle = await buildTenantGdprExport(tenantId, { prisma: prisma as never });
    assert.equal(bundle.manifest.tenantId, tenantId);
    for (const tour of bundle.tours as Array<{ tenantId: string }>) {
      assert.equal(tour.tenantId, tenantId);
    }
  });
});

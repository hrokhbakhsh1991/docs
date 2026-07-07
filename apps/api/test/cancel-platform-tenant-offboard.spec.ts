import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PlatformTenantRepository } from "../src/platform/platform-tenant.repository.ts";
import { cancelPlatformTenantOffboard } from "../src/platform/cancel-platform-tenant-offboard.ts";

describe("cancelPlatformTenantOffboard", () => {
  it("returns active from offboarding", async () => {
    const updatedRow = {
      id: "t1",
      subdomain: "acme",
      workspaceType: "denali",
      status: "active",
      createdAt: new Date("2026-06-21T10:00:00.000Z"),
      offboardingStartedAt: null,
      scheduledDeletionAt: null,
    };
    const repository = new PlatformTenantRepository({
      tenant: {
        findUnique: async () => ({
          id: "t1",
          subdomain: "acme",
          workspaceType: "denali",
          status: "offboarding",
          createdAt: new Date("2026-06-21T10:00:00.000Z"),
          offboardingStartedAt: new Date("2026-06-21T10:00:00.000Z"),
          scheduledDeletionAt: new Date("2026-07-21T10:00:00.000Z"),
        }),
      },
    } as never);
    const prisma = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          tenant: { update: async () => updatedRow },
          platformAuditEvent: { create: async () => ({}) },
        }),
    };

    const result = await cancelPlatformTenantOffboard(
      { tenantId: "t1", actorId: "+989121234567" },
      { repository, prisma: prisma as never }
    );
    assert.equal(result?.status, "active");
  });
});

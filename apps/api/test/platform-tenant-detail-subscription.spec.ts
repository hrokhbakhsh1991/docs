import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { toPlatformTenantDetailDto } from "../src/platform/platform-tenant-detail.dto.ts";

describe("toPlatformTenantDetailDto subscription", () => {
  before(() => {
    process.env.PLATFORM_ROOT_DOMAIN = "example.test";
  });

  after(() => {
    delete process.env.PLATFORM_ROOT_DOMAIN;
  });

  it("includes subscription planId", () => {
    const detail = toPlatformTenantDetailDto({
      tenant: {
        id: "00000000-0000-4000-8000-000000000014",
        subdomain: "demo",
        workspaceType: "denali",
        status: "active",
        createdAt: new Date("2026-06-21T10:00:00.000Z"),
      },
      ownerInvite: null,
      subscription: {
        tenantId: "00000000-0000-4000-8000-000000000014",
        planId: "standard",
        status: "active",
        currentPeriodEnd: new Date("2026-07-21T10:00:00.000Z"),
        updatedAt: new Date("2026-06-21T10:00:00.000Z"),
        plan: {
          id: "standard",
          displayName: "Standard",
          priceMonthly: null,
          currency: "IRR",
          features: { custom_domain: false },
          createdAt: new Date("2026-06-21T10:00:00.000Z"),
        },
      },
      workspaceCommerce: {
        paymentMode: "offline_receipt",
        gatewayProvider: null,
        currency: "IRR",
      },
    });

    assert.equal(detail.subscription?.planId, "standard");
    assert.equal(detail.subscription?.planDisplayName, "Standard");
  });
});

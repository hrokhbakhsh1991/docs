import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertTenantPlatformFeature } from "../src/platform/assert-tenant-platform-feature.ts";
import { PlatformFeatureForbidden } from "../src/platform/platform.errors.ts";
import type { PlatformPlanRepository } from "../src/platform/platform-plan.repository.ts";
import type { PlatformSubscriptionRepository } from "../src/platform/platform-subscription.repository.ts";

describe("assertTenantPlatformFeature", () => {
  it("AF-01 standard plan blocks custom_domain", async () => {
    const planRepository = {
      async getById(id: string) {
        assert.equal(id, "standard");
        return {
          id: "standard",
          displayName: "Standard",
          priceMonthly: null,
          currency: "IRR",
          features: { custom_domain: false, max_operators: 10 },
          createdAt: new Date(),
        };
      },
      async listAll() {
        return [];
      },
    } satisfies Pick<PlatformPlanRepository, "getById" | "listAll">;

    const subscriptionRepository = {
      async getByTenantId() {
        return null;
      },
    } satisfies Pick<PlatformSubscriptionRepository, "getByTenantId">;

    await assert.rejects(
      () =>
        assertTenantPlatformFeature("00000000-0000-4000-8000-000000000014", "custom_domain", {
          planRepository: planRepository as PlatformPlanRepository,
          subscriptionRepository: subscriptionRepository as PlatformSubscriptionRepository,
        }),
      PlatformFeatureForbidden
    );
  });

  it("AF-02 enterprise plan allows custom_domain", async () => {
    const subscriptionRepository = {
      async getByTenantId() {
        return {
          tenantId: "00000000-0000-4000-8000-000000000014",
          planId: "enterprise",
          status: "active",
          currentPeriodEnd: null,
          updatedAt: new Date(),
          plan: {
            id: "enterprise",
            displayName: "Enterprise",
            priceMonthly: null,
            currency: "IRR",
            features: { custom_domain: true, max_operators: 100 },
            createdAt: new Date(),
          },
        };
      },
    } satisfies Pick<PlatformSubscriptionRepository, "getByTenantId">;

    await assert.doesNotReject(() =>
      assertTenantPlatformFeature("00000000-0000-4000-8000-000000000014", "custom_domain", {
        subscriptionRepository: subscriptionRepository as PlatformSubscriptionRepository,
      })
    );
  });
});

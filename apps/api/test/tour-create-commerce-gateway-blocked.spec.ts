/**
 * P5-C-N-009 — GU-02b createTour blocks gateway commerce before persist
 * @see docs/phase-18/platform-workspace-commerce.mdoc
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";
import type { WorkspaceCommerceConfig } from "@app-tour/workspace-sdk/metadata";

import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import type { Tour } from "../src/storage/tour-storage.interface";
import {
  isWorkspaceCommerceGatewayBlockedError,
  WorkspaceCommerceGatewayBlockedError,
} from "../src/workspace-metadata/assert-workspace-commerce-gateway-blocked.ts";
import { ToursService } from "../src/tours/tours.service.ts";

const GATEWAY_COMMERCE: WorkspaceCommerceConfig = Object.freeze({
  paymentMode: "gateway",
  gatewayProvider: "zibal",
  currency: "IRR",
});

class CreateCountingRepository extends InMemoryTourRepository {
  createTourCalls = 0;

  override async createTour(input: {
    tenantId: string;
    canonical: Tour["canonical"];
  }): Promise<Tour> {
    this.createTourCalls += 1;
    return super.createTour(input);
  }
}

describe("tour-create-commerce-gateway-blocked (P5-C GU-02b)", () => {
  const priorStorageDriver = process.env.STORAGE_DRIVER;
  const priorGatewayLift = process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;
  const starterTenantId = "00000000-0000-4000-8000-000000000001";

  before(() => {
    process.env.STORAGE_DRIVER = "memory";
    delete process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;
  });

  after(() => {
    if (priorStorageDriver === undefined) {
      delete process.env.STORAGE_DRIVER;
    } else {
      process.env.STORAGE_DRIVER = priorStorageDriver;
    }
    if (priorGatewayLift === undefined) {
      delete process.env.P5_D_GATEWAY_ACTIVATION_ENABLED;
    } else {
      process.env.P5_D_GATEWAY_ACTIVATION_ENABLED = priorGatewayLift;
    }
  });

  const activeMember: TenantAuthContext = {
    userId: "gateway-block-user",
    tenantId: starterTenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-gateway-block",
  };

  it("GU-02b rejects gateway commerce before canonical writeTour", async () => {
    const counting = new CreateCountingRepository();
    let commerceResolveCalls = 0;
    const service = new ToursService(
      new CanonicalTourService(new TourStorageDbAdapter(counting), new LegacyCanonicalAdapter()),
      {
        resolveCommerce: async () => {
          commerceResolveCalls += 1;
          return GATEWAY_COMMERCE;
        },
      }
    );

    await assert.rejects(
      () =>
        service.createTour(activeMember, {
          data: { basics: { title: "Gateway blocked" }, details: { summary: "ok" } },
        }),
      (error: unknown) => {
        assert.ok(isWorkspaceCommerceGatewayBlockedError(error));
        assert.ok(error instanceof WorkspaceCommerceGatewayBlockedError);
        assert.equal(error.statusCode, 503);
        return true;
      }
    );

    assert.equal(commerceResolveCalls, 1);
    assert.equal(counting.createTourCalls, 0);
  });
});

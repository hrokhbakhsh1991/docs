import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import { InMemoryTourRepository } from "../src/storage/in-memory-tour.repository";
import type { Tour } from "../src/storage/tour-storage.interface";
import { ToursService } from "../src/tours/tours.service";

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

describe("RULE-003 — validation before persist ordering", () => {
  const activeMember: TenantAuthContext = {
    userId: "user-1",
    tenantId: "tenant-a",
    role: "member",
    status: "ACTIVE",
    workspaceId: "ws-1",
  };

  it("does not call storage createTour when validateCanonical fails", async () => {
    const counting = new CreateCountingRepository();
    const service = new ToursService(
      new CanonicalTourService(new TourStorageDbAdapter(counting), new LegacyCanonicalAdapter()),
    );

    await assert.rejects(
      () =>
        service.createTour(activeMember, {
          roots: ["basics", "details"],
          data: { basics: {}, details: { summary: "" } },
        }),
      /CANONICAL_VALIDATION_FAILED/,
    );

    assert.equal(counting.createTourCalls, 0);
  });

  it("calls storage createTour once when validation passes", async () => {
    const counting = new CreateCountingRepository();
    const service = new ToursService(
      new CanonicalTourService(new TourStorageDbAdapter(counting), new LegacyCanonicalAdapter()),
    );

    await service.createTour(activeMember, {
      data: { basics: { title: "Ordered OK" }, details: { summary: "" } },
    });

    assert.equal(counting.createTourCalls, 1);
  });
});

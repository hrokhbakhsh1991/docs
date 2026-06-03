import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createApiAbility } from "../casl/api-ability";
import type { TourRecord, TourWhere } from "../db/tour-record";
import type { TourStorageRepository } from "../db/tour.repository";
import { CanonicalTourService } from "./canonical-tour.service";
import { LegacyCanonicalAdapter } from "./legacy-canonical-adapter";

class CountingTourStore implements TourStorageRepository {
  findManyCalls = 0;

  async findMany(_where: TourWhere): Promise<readonly TourRecord[]> {
    this.findManyCalls += 1;
    return [];
  }

  async findFirst(): Promise<TourRecord | null> {
    return null;
  }

  async findById(): Promise<TourRecord | null> {
    return null;
  }

  async create(data: {
    tenantId: string;
    canonical: TourRecord["canonical"];
  }): Promise<TourRecord> {
    return {
      id: "tour-1",
      tenantId: data.tenantId,
      canonical: data.canonical,
      createdAt: new Date().toISOString(),
    };
  }
}

describe("CanonicalTourService writeTour (no full scan)", () => {
  it("does not call findMany on canonical store after create", async () => {
    const store = new CountingTourStore();
    const service = new CanonicalTourService(store, new LegacyCanonicalAdapter());
    const ability = createApiAbility({
      userId: "u1",
      tenantId: "tenant-a",
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });

    await service.writeTour({
      ability,
      tenantId: "tenant-a",
      canonical: {
        schemaVersion: 1,
        roots: ["basics"],
        data: { basics: { title: "x" } },
      },
    });

    assert.equal(store.findManyCalls, 0);
  });
});

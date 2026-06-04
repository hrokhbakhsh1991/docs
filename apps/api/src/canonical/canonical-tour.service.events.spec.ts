import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import { resetDomainEventBusForTests, subscribeDomainEvent } from "@app-tour/platform-events";

import { createApiAbility } from "../casl/api-ability";
import { TourStorageDbAdapter } from "../db/tour-storage.adapter";
import { InMemoryTourRepository } from "../storage/in-memory-tour.repository";
import { CanonicalTourService } from "./canonical-tour.service";
import { LegacyCanonicalAdapter } from "./legacy-canonical-adapter";

describe("CanonicalTourService TourCreated event", () => {
  beforeEach(() => {
    resetDomainEventBusForTests();
  });

  it("P4-E-EVT-01: publishes TourCreated with tenantId", async () => {
    const seen: string[] = [];
    subscribeDomainEvent("TourCreated", (evt) => {
      seen.push(evt.tenantId);
    });

    const service = new CanonicalTourService(
      new TourStorageDbAdapter(new InMemoryTourRepository()),
      new LegacyCanonicalAdapter(),
    );
    const ability = createApiAbility({
      userId: "u1",
      tenantId: "tenant-a",
      workspaceId: "ws-1",
      role: "admin",
      status: "ACTIVE",
    });

    await service.writeTour({
      ability,
      tenantId: "tenant-a",
      canonical: {
        schemaVersion: 1,
        roots: ["basics"],
        data: { basics: { title: "E2E" } },
      },
    });

    assert.deepEqual(seen, ["tenant-a"]);
  });
});

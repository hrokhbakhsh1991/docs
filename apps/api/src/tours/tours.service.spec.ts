import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { CanonicalTourService } from "../canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../db/tour-storage.adapter";
import { InMemoryTourRepository } from "../storage/in-memory-tour.repository";
import { ToursService } from "./tours.service";

describe("ToursService", () => {
  const service = new ToursService(
    new CanonicalTourService(
      new TourStorageDbAdapter(new InMemoryTourRepository()),
      new LegacyCanonicalAdapter(),
    ),
  );

  const activeMember: TenantAuthContext = {
    userId: "user-1",
    tenantId: "tenant-a",
    role: "member",
    status: "ACTIVE",
    workspaceId: "ws-1",
  };

  it("denies create for suspended member before storage (accessibleBy)", async () => {
    await assert.rejects(
      () =>
        service.createTour(
          { ...activeMember, status: "SUSPENDED" },
          { data: { basics: { title: "Blocked" }, details: { summary: "" } } },
        ),
      /FORBIDDEN_TOUR_CREATE/,
    );
  });

  it("rejects body tenantId that does not match auth tenant (CRIT-STATE-04)", async () => {
    await assert.rejects(
      () =>
        service.createTour(activeMember, {
          tenantId: "tenant-b",
          data: { basics: { title: "Cross" }, details: { summary: "" } },
        }),
      /FORBIDDEN_TENANT_CLAIM_MISMATCH/,
    );
  });

  it("creates tour after Zod + canonical validation", async () => {
    const record = await service.createTour(activeMember, {
      data: { basics: { title: "Service layer" }, details: { summary: "ok" } },
    });
    assert.equal(record.tenantId, "tenant-a");
    assert.equal(record.canonical.data?.basics?.title, "Service layer");
  });
});

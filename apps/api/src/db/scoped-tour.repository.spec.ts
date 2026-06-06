import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createApiAbility } from "../casl/api-ability";
import { TourStorageDbAdapter } from "./tour-storage.adapter";
import { InMemoryTourRepository } from "../storage/in-memory-tour.repository";
import { ScopedTourRepository } from "./scoped-tour.repository";

describe("ScopedTourRepository cross-tenant policy", () => {
  it("findFirst returns null when record exists under another tenant (RLS-scoped read)", async () => {
    const inner = new TourStorageDbAdapter(new InMemoryTourRepository());
    const owner = createApiAbility({
      userId: "u1",
      tenantId: "tenant-a",
      role: "member",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });
    const created = await new ScopedTourRepository(inner, owner).create({
      tenantId: "tenant-a",
      canonical: {
        schemaVersion: 1,
        roots: ["basics"],
        data: { basics: { title: "x" } },
      },
    });

    const intruder = createApiAbility({
      userId: "u2",
      tenantId: "tenant-b",
      role: "member",
      status: "ACTIVE",
      workspaceId: "ws-1",
    });

    const hit = await new ScopedTourRepository(inner, intruder).findFirst({ id: created.id });
    assert.equal(hit, null);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createApiAbility } from "../casl/api-ability";
import { InMemoryTourRepository } from "./in-memory-tour.repository";
import { ScopedTourRepository } from "./scoped-tour.repository";

describe("ScopedTourRepository cross-tenant policy", () => {
  it("findFirst throws FORBIDDEN when record exists under another tenant", async () => {
    const inner = new InMemoryTourRepository();
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

    await assert.rejects(
      () => new ScopedTourRepository(inner, intruder).findFirst({ id: created.id }),
      /FORBIDDEN_TOUR_READ_CROSS_TENANT/,
    );
  });
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrisma } from "../db/prisma";
import { PrismaTourRepository } from "./prisma-tour.repository";

const sampleCanonical = {
  schemaVersion: 1 as const,
  roots: ["basics"] as const,
  data: { basics: { title: "prisma-tour" } },
};

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const describeIntegration = hasDatabase ? describe : describe.skip;

describeIntegration("PrismaTourRepository (integration)", { concurrency: false }, () => {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let repo: PrismaTourRepository;

  before(async () => {
    repo = new PrismaTourRepository();
    const prisma = getPrisma();
    await prisma.tenant.upsert({
      where: { id: tenantA },
      create: {
        id: tenantA,
        subdomain: `tenant-a-${tenantA.slice(0, 8)}`,
        workspaceType: "starter",
        theme: {},
      },
      update: {},
    });
    await prisma.tenant.upsert({
      where: { id: tenantB },
      create: {
        id: tenantB,
        subdomain: `tenant-b-${tenantB.slice(0, 8)}`,
        workspaceType: "starter",
        theme: {},
      },
      update: {},
    });
  });

  after(async () => {
    const prisma = getPrisma();
    for (const tenantId of [tenantA, tenantB]) {
      await prisma.$executeRaw`
        SELECT set_config('app.current_tenant_id', ${tenantId}::text, false)
      `;
      await prisma.tour.deleteMany({ where: { tenantId } });
    }
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await disconnectPrisma();
  });

  it("getById uses compound tenantId+id — no cross-tenant row", async () => {
    const created = await repo.createTour({ tenantId: tenantA, canonical: sampleCanonical });
    const wrongTenant = await repo.getById(created.id, tenantB);
    assert.equal(wrongTenant, null);
    const hit = await repo.getById(created.id, tenantA);
    assert.equal(hit?.id, created.id);
    assert.equal(hit?.tenantId, tenantA);
  });

  it("listByTenant returns only rows for that tenant", async () => {
    const rows = await repo.listByTenant(tenantA);
    assert.ok(rows.every((row) => row.tenantId === tenantA));
  });

  it("save rejects tenantId change for existing id", async () => {
    const created = await repo.createTour({ tenantId: tenantA, canonical: sampleCanonical });
    await assert.rejects(
      () => repo.save({ ...created, tenantId: tenantB }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "FORBIDDEN_TOUR_STORAGE_CROSS_TENANT");
        return true;
      }
    );
  });
});

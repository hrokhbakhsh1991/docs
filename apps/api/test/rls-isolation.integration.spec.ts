import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrisma } from "../src/db/prisma";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/**
 * P4-E-RLS-01 — Postgres RLS on `tours` via session `app.current_tenant_id`.
 * Requires: docker compose up + infra/sql/001_tenant_rls.sql applied.
 * Run: DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5433/app_tour_dev pnpm --filter @apps/api test
 */
describe("RLS isolation (integration)", { skip: !hasDatabase, concurrency: false }, () => {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let tourBId: string;

  before(async () => {
    const prisma = getPrisma();
    await prisma.tenant.create({
      data: {
        id: tenantA,
        subdomain: `rls-a-${tenantA.slice(0, 8)}`,
        workspaceType: "starter",
        theme: {},
      },
    });
    await prisma.tenant.create({
      data: {
        id: tenantB,
        subdomain: `rls-b-${tenantB.slice(0, 8)}`,
        workspaceType: "starter",
        theme: {},
      },
    });

    // Session-level (false): Prisma uses separate transactions per query; local=true drops setting.
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenantB}::text, false)
    `;
    const tour = await prisma.tour.create({
      data: {
        tenantId: tenantB,
        canonical: {
          schemaVersion: 1,
          roots: ["basics"],
          data: { basics: { title: "tenant-b-tour" } },
        },
      },
    });
    tourBId = tour.id;
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

  it("P4-E-RLS-01: tenant A session cannot SELECT tenant B tour row", async () => {
    const prisma = getPrisma();
    await prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenantA}::text, false)
    `;
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id::text AS id FROM tours WHERE id = ${tourBId}::uuid
    `;
    assert.equal(
      rows.length,
      0,
      "RLS must hide tenant B row when app.current_tenant_id is tenant A"
    );
  });
});

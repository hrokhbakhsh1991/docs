import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrisma } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/**
 * P4-E-RLS-01 — Postgres RLS on `tours` via session `app.current_tenant_id`.
 * Requires: docker compose up + migrations applied (tours RLS policy + app_tour NOBYPASSRLS).
 * Run: DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5434/app_tour_dev pnpm --filter @apps/api exec node --import tsx --test test/rls-isolation.integration.spec.ts
 */
describe("RLS isolation (integration)", { skip: !hasDatabase, concurrency: false }, () => {
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  let tourBId: string;

  before(async () => {
    const prisma = getPrisma();
    const [{ rolsuper, rolbypassrls }] = await prisma.$queryRaw<
      { rolsuper: boolean; rolbypassrls: boolean }[]
    >`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
    `;
    assert.equal(
      rolsuper,
      false,
      "app role must be NOSUPERUSER — migrate as DATABASE_URL_ADMIN (20260706130000_app_tour_nosuperuser)"
    );
    assert.equal(
      rolbypassrls,
      false,
      "app role must have NOBYPASSRLS — migrate as DATABASE_URL_ADMIN (20260706120000_app_tour_nobypassrls)"
    );

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

    const tour = await withTenantRls(tenantB, (tx) =>
      tx.tour.create({
        data: {
          tenantId: tenantB,
          canonical: {
            schemaVersion: 1,
            roots: ["basics"],
            data: { basics: { title: "tenant-b-tour" } },
          },
        },
      })
    );
    tourBId = tour.id;
  });

  after(async () => {
    for (const tenantId of [tenantA, tenantB]) {
      await withTenantRls(tenantId, (tx) => tx.tour.deleteMany({ where: { tenantId } }));
    }
    const prisma = getPrisma();
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await disconnectPrisma();
  });

  it("P4-E-RLS-01: tenant A session cannot SELECT tenant B tour row", async () => {
    const rows = await withTenantRls(tenantA, (tx) =>
      tx.$queryRaw<{ id: string }[]>`
        SELECT id::text AS id FROM tours WHERE id = ${tourBId}::uuid
      `
    );
    assert.equal(
      rows.length,
      0,
      "RLS must hide tenant B row when app.current_tenant_id is tenant A"
    );
  });
});

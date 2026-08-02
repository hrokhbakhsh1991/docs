/**
 * Phase 7.8 — ADV-P7-P0-01: RLS read isolation for urban + denali workspace tenants.
 *
 * @see docs/phase-7/appendices/ADVERSARIAL-MATRIX.md
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

const WORKSPACE_TYPES = ["urban", "denali"] as const;

type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

function minimalCanonical(title: string) {
  return {
    schemaVersion: 1,
    roots: ["basics"],
    data: { basics: { title } },
  };
}

for (const workspaceType of WORKSPACE_TYPES) {
  describe(
    `RLS tenant isolation — ${workspaceType} (ADV-P7-P0-01)`,
    { skip: !hasDatabase, concurrency: false },
    () => {
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      let tourAId: string;
      let tourBId: string;

      before(async () => {
        const admin = getPrismaAdmin();
        await admin.tenant.createMany({
          data: [
            {
              id: tenantA,
              subdomain: `p78-a-${workspaceType}-${tenantA.slice(0, 8)}`,
              workspaceType,
              theme: {},
            },
            {
              id: tenantB,
              subdomain: `p78-b-${workspaceType}-${tenantB.slice(0, 8)}`,
              workspaceType,
              theme: {},
            },
          ],
        });

        const tourB = await withTenantRls(tenantB, async (tx) =>
          tx.tour.create({
            data: {
              tenantId: tenantB,
              canonical: minimalCanonical(`${workspaceType}-tenant-b-tour`),
            },
          })
        );
        tourBId = tourB.id;

        const tourA = await withTenantRls(tenantA, async (tx) =>
          tx.tour.create({
            data: {
              tenantId: tenantA,
              canonical: minimalCanonical(`${workspaceType}-tenant-a-tour`),
            },
          })
        );
        tourAId = tourA.id;
      });

      after(async () => {
        const admin = getPrismaAdmin();
        for (const tenantId of [tenantA, tenantB]) {
          await withTenantRls(tenantId, async (tx) => {
            await tx.tour.deleteMany({ where: { tenantId } });
          });
        }
        await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
        await disconnectPrisma();
      });

      it(`ADV-P7-P0-01: ${workspaceType} — tenant A session cannot SELECT tenant B tour`, async () => {
        const rows = await withTenantRls(
          tenantA,
          async (tx) =>
            tx.$queryRaw<{ id: string }[]>`
            SELECT id::text AS id FROM tours WHERE id = ${tourBId}::uuid
          `
        );
        assert.equal(rows.length, 0);
      });

      it(`ADV-P7-P0-01: ${workspaceType} — tenant B session cannot SELECT tenant A tour`, async () => {
        const rows = await withTenantRls(
          tenantB,
          async (tx) =>
            tx.$queryRaw<{ id: string }[]>`
            SELECT id::text AS id FROM tours WHERE id = ${tourAId}::uuid
          `
        );
        assert.equal(rows.length, 0);
      });

      it(`ADV-P7-P0-01: ${workspaceType} — findMany under tenant A excludes tenant B rows`, async () => {
        const rows = await withTenantRls(tenantA, async (tx) =>
          tx.tour.findMany({ where: { tenantId: tenantB } })
        );
        assert.equal(rows.length, 0);
      });
    }
  );
}

/**
 * Phase 7.8 — ADV-P7-P0-02: RLS write boundary for urban + denali workspace tenants.
 *
 * @see docs/phase-7/appendices/ADVERSARIAL-MATRIX.md
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { Prisma } from "@prisma/client";

import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

const WORKSPACE_TYPES = ["urban", "denali"] as const;

function minimalCanonical(title: string) {
  return {
    schemaVersion: 1,
    roots: ["basics"],
    data: { basics: { title } },
  };
}

function isRlsWriteViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2003" || error.code === "P2010";
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("row-level security") ||
    message.includes("violates row-level security") ||
    message.includes("new row violates")
  );
}

for (const workspaceType of WORKSPACE_TYPES) {
  describe(
    `RLS write boundary — ${workspaceType} (ADV-P7-P0-02)`,
    { skip: !hasDatabase, concurrency: false },
    () => {
      const tenantA = randomUUID();
      const tenantB = randomUUID();
      let tourBId: string;

      before(async () => {
        const admin = getPrismaAdmin();
        await admin.tenant.createMany({
          data: [
            {
              id: tenantA,
              subdomain: `p78w-a-${workspaceType}-${tenantA.slice(0, 8)}`,
              workspaceType,
              theme: {},
            },
            {
              id: tenantB,
              subdomain: `p78w-b-${workspaceType}-${tenantB.slice(0, 8)}`,
              workspaceType,
              theme: {},
            },
          ],
        });

        const tourB = await withTenantRls(tenantB, async (tx) =>
          tx.tour.create({
            data: {
              tenantId: tenantB,
              canonical: minimalCanonical(`${workspaceType}-write-b`),
              title: "tenant-b-title",
            },
          })
        );
        tourBId = tourB.id;
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

      it(`ADV-P7-P0-02: ${workspaceType} — UPDATE under tenant A cannot mutate tenant B tour`, async () => {
        const result = await withTenantRls(tenantA, async (tx) =>
          tx.tour.updateMany({
            where: { id: tourBId },
            data: { title: "rls-write-violation" },
          })
        );
        assert.equal(result.count, 0);

        const unchanged = await withTenantRls(tenantB, async (tx) =>
          tx.tour.findUnique({ where: { id: tourBId } })
        );
        assert.equal(unchanged?.title, "tenant-b-title");
      });

      it(`ADV-P7-P0-02: ${workspaceType} — DELETE under tenant A cannot remove tenant B tour`, async () => {
        const result = await withTenantRls(tenantA, async (tx) =>
          tx.tour.deleteMany({ where: { id: tourBId } })
        );
        assert.equal(result.count, 0);

        const stillThere = await withTenantRls(tenantB, async (tx) =>
          tx.tour.findUnique({ where: { id: tourBId } })
        );
        assert.ok(stillThere);
      });

      it(`ADV-P7-P0-02: ${workspaceType} — INSERT with foreign tenant_id rejected under tenant A session`, async () => {
        await assert.rejects(
          () =>
            withTenantRls(tenantA, async (tx) =>
              tx.tour.create({
                data: {
                  tenantId: tenantB,
                  canonical: minimalCanonical("foreign-tenant-insert"),
                },
              })
            ),
          (error: unknown) => isRlsWriteViolation(error)
        );
      });
    }
  );
}

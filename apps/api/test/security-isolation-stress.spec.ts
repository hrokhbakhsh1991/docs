import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";
import { PrismaTourRepository } from "../src/storage/prisma-tour.repository";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/** Concurrent ALS-bound workers — one distinct tenant per worker. */
const TENANT_STRESS_COUNT = 10;

/** Extra rounds hammer the Prisma pool / RLS session binding under overlap. */
const STRESS_ROUNDS = 25;

type TenantFixture = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly marker: string;
};

/**
 * High-concurrency isolation proof — each worker binds a unique tenant in ALS, then
 * immediately queries tours. Any cross-tenant row under the wrong ALS scope is a leak.
 *
 * Requires: DATABASE_URL + RLS on `tours` (infra/sql/001_tenant_rls.sql).
 */
describe(
  "security isolation stress (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const repo = new PrismaTourRepository();
    const fixtures: TenantFixture[] = [];
    const runId = randomUUID().slice(0, 8);

    before(async () => {
      const admin = getPrismaAdmin();
      for (let i = 0; i < TENANT_STRESS_COUNT; i += 1) {
        const tenantId = randomUUID();
        const marker = `stress-${runId}-tenant-${i}`;
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain: `iso-stress-${runId}-${i}`,
            workspaceType: "starter",
            theme: {},
          },
        });

        const tour = await repo.createTour({
          tenantId,
          canonical: {
            schemaVersion: 1,
            roots: ["basics"],
            data: { basics: { title: marker } },
          },
        });

        fixtures.push({ tenantId, tourId: tour.id, marker });
      }
    });

    after(async () => {
      const admin = getPrismaAdmin();
      for (const { tenantId } of fixtures) {
        await withTenantRls(tenantId, async (tx) => {
          await tx.tour.deleteMany({ where: { tenantId } });
        });
      }
      await admin.tenant.deleteMany({
        where: { id: { in: fixtures.map((f) => f.tenantId) } },
      });
      await disconnectPrisma();
    });

    async function assertWorkerIsolation(worker: TenantFixture): Promise<void> {
      await runWithTenantContext(worker.tenantId, async () => {
        const own = await repo.getByIdForActiveContext(worker.tourId);
        assert.ok(own !== null, `expected own tour for tenant ${worker.tenantId}`);
        assert.equal(
          own.tenantId,
          worker.tenantId,
          "own tour row must carry the ALS-bound tenantId"
        );
        assert.equal(
          (own.canonical as { data: { basics: { title: string } } }).data.basics.title,
          worker.marker,
          "canonical payload must match the seeded marker (no swapped row)"
        );

        for (const other of fixtures) {
          if (other.tenantId === worker.tenantId) {
            continue;
          }
          const cross = await repo.getByIdForActiveContext(other.tourId);
          if (cross !== null) {
            throw new Error(
              [
                "SECURITY_ISOLATION_LEAK",
                `alsTenant=${worker.tenantId}`,
                `readTourId=${other.tourId}`,
                `ownerTenant=${cross.tenantId}`,
                `marker=${(cross.canonical as { data: { basics: { title: string } } }).data.basics.title}`,
              ].join(" ")
            );
          }
        }

        const listed = await repo.listByTenant(worker.tenantId);
        assert.ok(
          listed.every((row) => row.tenantId === worker.tenantId),
          "listByTenant must not return foreign tenant rows under concurrent RLS"
        );
        assert.ok(
          !listed.some((row) =>
            fixtures.some((f) => f.tourId === row.id && f.tenantId !== worker.tenantId)
          ),
          "listByTenant must not include another worker's tour id"
        );
      });
    }

    it("P4-E-RLS-STRESS: 10 concurrent ALS contexts never cross-read tours", async () => {
      for (let round = 0; round < STRESS_ROUNDS; round += 1) {
        const results = await Promise.allSettled(
          fixtures.map((worker) => assertWorkerIsolation(worker))
        );

        const leaks = results.filter(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        if (leaks.length > 0) {
          const messages = leaks.map((r) =>
            r.reason instanceof Error ? r.reason.message : String(r.reason)
          );
          assert.fail(
            `isolation failed in round ${round + 1}/${STRESS_ROUNDS}: ${messages.join("; ")}`
          );
        }
      }
    });
  }
);

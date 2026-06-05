/**
 * Bulk import consistency — 100 tours per tenant in one batch job with RLS partition checks.
 *
 * No dedicated bulk-import API exists; this simulates bulk write mode via interleaved
 * {@link persistNewTourAtomically} chunks with explicit tenant context per chunk.
 *
 * Requires DATABASE_URL (Postgres + app_tour role + phase-5 migrations). Example:
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
 *     pnpm --filter @apps/api exec node --import tsx --test test/4-integration/bulk-import-consistency.spec.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { persistNewTourAtomically } from "../../src/canonical/atomic-canonical-tour-persist";
import {
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "../../src/canonical/pre-transaction-validation";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { withTenantRls } from "../../src/db/with-tenant-rls";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const SKIP_MESSAGE =
  "bulk-import-consistency requires DATABASE_URL (e.g. postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db)";

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

const BULK_COUNT_PER_TENANT = 100;
const CHUNK_SIZE = 10;

type ImportResult = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly marker: string;
  readonly index: number;
};

type TenantBatch = {
  readonly tenantId: string;
  readonly markerPrefix: string;
};

function canonicalTitle(canonical: unknown): string | undefined {
  if (
    typeof canonical === "object" &&
    canonical !== null &&
    "data" in canonical &&
    typeof (canonical as { data?: unknown }).data === "object" &&
    (canonical as { data: { basics?: { title?: string } } }).data?.basics?.title !== undefined
  ) {
    return (canonical as { data: { basics: { title: string } } }).data.basics.title;
  }
  return undefined;
}

async function persistTourInBatch(batch: TenantBatch, index: number): Promise<ImportResult> {
  const marker = `${batch.markerPrefix}-${String(index).padStart(3, "0")}`;
  try {
    const canonical = await runPreTransactionValidation({
      body: {
        data: {
          basics: { title: marker },
          details: { summary: `bulk-import-${index}` },
        },
      },
      tenantId: batch.tenantId,
      workspaceType: "starter",
    });
    const result = await persistNewTourAtomically({
      tenantId: batch.tenantId,
      canonical,
    });
    return { tenantId: batch.tenantId, tourId: result.id, marker, index };
  } finally {
    clearPreTransactionValidationGate();
  }
}

/**
 * Single batch job: interleaved A/B chunks so both tenants write under bulk concurrency
 * while each chunk keeps an explicit tenant context via persistNewTourAtomically.
 */
async function runBulkImportBatchJob(
  tenantA: TenantBatch,
  tenantB: TenantBatch
): Promise<{ readonly a: ImportResult[]; readonly b: ImportResult[] }> {
  const resultsA: ImportResult[] = [];
  const resultsB: ImportResult[] = [];
  const chunkCount = BULK_COUNT_PER_TENANT / CHUNK_SIZE;

  for (let chunk = 0; chunk < chunkCount; chunk += 1) {
    const indices = Array.from({ length: CHUNK_SIZE }, (_, offset) => chunk * CHUNK_SIZE + offset);

    const [chunkA, chunkB] = await Promise.all([
      Promise.all(indices.map((index) => persistTourInBatch(tenantA, index))),
      Promise.all(indices.map((index) => persistTourInBatch(tenantB, index))),
    ]);

    resultsA.push(...chunkA);
    resultsB.push(...chunkB);
  }

  return { a: resultsA, b: resultsB };
}

describe(
  "4-integration — bulk import consistency (100+100 tours, RLS partition integrity)",
  { skip: hasDatabase ? false : SKIP_MESSAGE, concurrency: false },
  () => {
    const runId = randomUUID().slice(0, 8);
    const tenantAId = integrationTenantId();
    const tenantBId = integrationTenantId();
    const markerPrefixA = `bulk-import-a-${runId}`;
    const markerPrefixB = `bulk-import-b-${runId}`;

    let admin: PrismaClient;
    let appRole: PrismaClient;
    const priorStorageDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.DATABASE_URL = APP_TOUR_URL;
      await disconnectPrisma();

      admin = getPrismaAdmin();
      appRole = new PrismaClient({ datasources: { db: { url: APP_TOUR_URL } } });

      for (const [tenantId, label] of [
        [tenantAId, "a"],
        [tenantBId, "b"],
      ] as const) {
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain: `bulk-${label}-${runId}-${tenantId.slice(0, 8)}`,
            workspaceType: "starter",
            theme: {},
          },
        });
      }
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorageDriver;
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        for (const tenantId of [tenantAId, tenantBId]) {
          await admin.auditEvent.deleteMany({ where: { tenantId } });
          await admin.outboxEvent.deleteMany({ where: { tenantId } });
          await admin.tour.deleteMany({ where: { tenantId } });
        }
        await admin.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await appRole.$disconnect();
      await disconnectPrisma();
    });

    it("BULK-IMPORT-01: batch job writes 100+100 tours with no cross-tenant partition leaks", async () => {
      const batchA: TenantBatch = { tenantId: tenantAId, markerPrefix: markerPrefixA };
      const batchB: TenantBatch = { tenantId: tenantBId, markerPrefix: markerPrefixB };

      const imported = await runBulkImportBatchJob(batchA, batchB);

      assert.equal(
        imported.a.length,
        BULK_COUNT_PER_TENANT,
        "tenant A batch must persist 100 tours"
      );
      assert.equal(
        imported.b.length,
        BULK_COUNT_PER_TENANT,
        "tenant B batch must persist 100 tours"
      );

      const tourIdsA = new Set(imported.a.map((row) => row.tourId));
      const tourIdsB = new Set(imported.b.map((row) => row.tourId));
      assert.equal(
        tourIdsA.size,
        BULK_COUNT_PER_TENANT,
        "tenant A tour ids must be distinct within batch"
      );
      assert.equal(
        tourIdsB.size,
        BULK_COUNT_PER_TENANT,
        "tenant B tour ids must be distinct within batch"
      );

      for (const id of tourIdsA) {
        assert.ok(!tourIdsB.has(id), `tour id ${id} must not appear in both tenant batches`);
      }

      const countA = await withTenantRls(tenantAId, async (tx) => {
        const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*)::bigint AS count FROM tours
        `;
        return Number(rows[0]?.count ?? -1);
      });
      assert.equal(
        countA,
        BULK_COUNT_PER_TENANT,
        "tenant A RLS session must see exactly 100 tours"
      );

      const countB = await withTenantRls(tenantBId, async (tx) => {
        const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*)::bigint AS count FROM tours
        `;
        return Number(rows[0]?.count ?? -1);
      });
      assert.equal(
        countB,
        BULK_COUNT_PER_TENANT,
        "tenant B RLS session must see exactly 100 tours"
      );

      const foreignMarkersInA = await withTenantRls(tenantAId, async (tx) =>
        tx.tour.count({
          where: { title: { startsWith: markerPrefixB } },
        })
      );
      assert.equal(
        foreignMarkersInA,
        0,
        "tenant A session must not surface tenant B bulk-import markers"
      );

      const foreignMarkersInB = await withTenantRls(tenantBId, async (tx) =>
        tx.tour.count({
          where: { title: { startsWith: markerPrefixA } },
        })
      );
      assert.equal(
        foreignMarkersInB,
        0,
        "tenant B session must not surface tenant A bulk-import markers"
      );

      const adminToursA = await admin.tour.findMany({ where: { tenantId: tenantAId } });
      const adminToursB = await admin.tour.findMany({ where: { tenantId: tenantBId } });

      assert.equal(adminToursA.length, BULK_COUNT_PER_TENANT);
      assert.equal(adminToursB.length, BULK_COUNT_PER_TENANT);

      for (const tour of adminToursA) {
        assert.equal(tour.tenantId, tenantAId);
        assert.match(tour.title ?? "", new RegExp(`^${markerPrefixA}-\\d{3}$`));
        assert.match(canonicalTitle(tour.canonical) ?? "", new RegExp(`^${markerPrefixA}-\\d{3}$`));
      }

      for (const tour of adminToursB) {
        assert.equal(tour.tenantId, tenantBId);
        assert.match(tour.title ?? "", new RegExp(`^${markerPrefixB}-\\d{3}$`));
        assert.match(canonicalTitle(tour.canonical) ?? "", new RegExp(`^${markerPrefixB}-\\d{3}$`));
      }

      const wrongPartitionA = await admin.tour.findMany({
        where: { id: { in: [...tourIdsA] }, tenantId: tenantBId },
      });
      assert.equal(
        wrongPartitionA.length,
        0,
        "admin must not find tenant A tour ids under tenant B partition"
      );

      const wrongPartitionB = await admin.tour.findMany({
        where: { id: { in: [...tourIdsB] }, tenantId: tenantAId },
      });
      assert.equal(
        wrongPartitionB.length,
        0,
        "admin must not find tenant B tour ids under tenant A partition"
      );

      for (const foreignTourId of [...tourIdsA].slice(0, 5)) {
        await appRole.$transaction(async (tx) => {
          await tx.$executeRaw`
            SELECT set_config('app.current_tenant_id', ${tenantBId}::text, true)
          `;

          const crossTour = await tx.tour.findUnique({
            where: { tenantId_id: { tenantId: tenantBId, id: foreignTourId } },
          });
          assert.equal(
            crossTour,
            null,
            `RLS leak: tenant B session must not read tenant A tour ${foreignTourId}`
          );

          const crossOutbox = await tx.outboxEvent.findMany({
            where: { tenantId: tenantBId, aggregateId: foreignTourId },
          });
          assert.equal(
            crossOutbox.length,
            0,
            `RLS leak: tenant B session must not read outbox for tenant A tour ${foreignTourId}`
          );
        });
      }

      for (const foreignTourId of [...tourIdsB].slice(0, 5)) {
        await appRole.$transaction(async (tx) => {
          await tx.$executeRaw`
            SELECT set_config('app.current_tenant_id', ${tenantAId}::text, true)
          `;

          const crossTour = await tx.tour.findUnique({
            where: { tenantId_id: { tenantId: tenantAId, id: foreignTourId } },
          });
          assert.equal(
            crossTour,
            null,
            `RLS leak: tenant A session must not read tenant B tour ${foreignTourId}`
          );

          const crossOutbox = await tx.outboxEvent.findMany({
            where: { tenantId: tenantAId, aggregateId: foreignTourId },
          });
          assert.equal(
            crossOutbox.length,
            0,
            `RLS leak: tenant A session must not read outbox for tenant B tour ${foreignTourId}`
          );
        });
      }
    });
  }
);

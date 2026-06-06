/**
 * 2-observability — audit log security compliance (Postgres RLS + schema).
 *
 * Proves audit_events rows written by the atomic createTour path carry tenant_id
 * as an indexed column and are isolated by the same RLS policy as domain data.
 *
 * Run (requires DATABASE_URL — Postgres with Phase 5 migrations applied):
 *   cd apps/api && NODE_ENV=test STORAGE_DRIVER=prisma node --import tsx --test test/2-observability/audit-log-security.spec.ts
 *
 * @see docs/phase-5/audits/AUDIT-TRAIL-SECURITY-REPORT.md
 * @see apps/api/test/5.5-audit-events.spec.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { AUDIT_ACTION_TOUR_CREATED } from "../../src/audit/audit-logger";
import { pseudonymizeAuditActorId } from "../../src/audit/audit-pseudonym";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

const VALID_TOUR_BODY = {
  data: { basics: { title: "audit-log-security" }, details: { summary: "compliance" } },
};

const ACTOR_ID = "audit-log-security-actor";

type PgIndexRow = { indexname: string; indexdef: string };
type PgColumnRow = { column_name: string };
type ExplainRow = { "QUERY PLAN": string };

async function withRlsSession<T>(
  client: PrismaClient,
  tenantId: string,
  run: (tx: PrismaClient) => Promise<T>
): Promise<T> {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)
    `;
    return run(tx as unknown as PrismaClient);
  });
}

/**
 * Compliance matrix: schema index on tenant_id, atomic audit write, RLS parity with tours.
 */
describe(
  "2-observability — audit log security (integration)",
  {
    skip: hasDatabase
      ? false
      : "DATABASE_URL required — Postgres RLS integration (see apps/api/.env.example)",
    concurrency: false,
  },
  () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    let admin: PrismaClient;
    let appRole: PrismaClient;
    let toursService: ToursService;
    let tourId: string;
    let auditRowId: string;
    const priorStorageDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await disconnectPrisma();
      admin = getPrismaAdmin();
      appRole = new PrismaClient({ datasources: { db: { url: APP_TOUR_URL } } });

      for (const [tenantId, label] of [
        [tenantA, "a"],
        [tenantB, "b"],
      ] as const) {
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain: `audit-sec-${label}-${runId}`,
            workspaceType: "starter",
            theme: {},
          },
        });
      }

      toursService = new ToursService(
        new CanonicalTourService(
          new TourStorageDbAdapter(createTourStorageRepository()),
          new LegacyCanonicalAdapter()
        )
      );

      const created = await runWithTenantContext(
        tenantA,
        () =>
          toursService.createTour(
            {
              userId: ACTOR_ID,
              tenantId: tenantA,
              role: "admin",
              status: "ACTIVE",
              workspaceId: "ws-1",
            },
            VALID_TOUR_BODY
          ),
        { actorId: ACTOR_ID, workspaceType: "starter" }
      );
      tourId = created.id;

      const auditRow = await admin.auditEvent.findFirst({
        where: { tenantId: tenantA, entityId: tourId, action: AUDIT_ACTION_TOUR_CREATED },
      });
      assert.ok(auditRow, "fixture must have TOUR_CREATED audit row from atomic createTour");
      auditRowId = auditRow.id;
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorageDriver;
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        for (const tenantId of [tenantA, tenantB]) {
          await admin.auditEvent.deleteMany({ where: { tenantId } });
          await admin.outboxEvent.deleteMany({ where: { tenantId } });
          await admin.tour.deleteMany({ where: { tenantId } });
          await admin.tenant.delete({ where: { id: tenantId } });
        }
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await disconnectPrisma();
      await appRole.$disconnect();
    });

    it("audit_events.tenant_id column exists and is indexed (schema compliance)", async () => {
      const columns = await admin.$queryRaw<PgColumnRow[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_events'
          AND column_name = 'tenant_id'
      `;
      assert.equal(columns.length, 1, "audit_events must expose tenant_id as a physical column");

      const indexes = await admin.$queryRaw<PgIndexRow[]>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'audit_events'
          AND indexdef ILIKE '%tenant_id%'
      `;
      assert.ok(
        indexes.some(
          (row) =>
            row.indexdef.includes("tenant_id") &&
            (row.indexname === "audit_events_tenant_id_created_at_idx" ||
              row.indexname === "idx_audit_tenant_created")
        ),
        `expected composite index on tenant_id; got: ${indexes.map((r) => r.indexname).join(", ") || "(none)"}`
      );
    });

    it("atomic createTour audit row stores tenant_id matching ALS tenant (admin verify)", async () => {
      const row = await admin.auditEvent.findUnique({ where: { id: auditRowId } });
      assert.ok(row);
      assert.equal(row.tenantId, tenantA);
      assert.equal(row.entityId, tourId);
      assert.equal(row.entityType, "tour");
      assert.equal(row.action, AUDIT_ACTION_TOUR_CREATED);
      assert.equal(row.actorId, pseudonymizeAuditActorId(ACTOR_ID, tenantA));
    });

    it("tenant A RLS session can read own audit row by entity id", async () => {
      const rows = await withRlsSession(appRole, tenantA, async (tx) =>
        tx.auditEvent.findMany({ where: { entityId: tourId } })
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.id, auditRowId);
      assert.equal(rows[0]?.tenantId, tenantA);
    });

    it("tenant B RLS session cannot read tenant A audit row by entity id (0 rows)", async () => {
      const foreignByEntity = await withRlsSession(appRole, tenantB, async (tx) =>
        tx.auditEvent.findMany({ where: { entityId: tourId } })
      );
      assert.equal(
        foreignByEntity.length,
        0,
        "cross-tenant session must not resolve audit row by foreign entity id"
      );

      const foreignById = await withRlsSession(appRole, tenantB, async (tx) =>
        tx.auditEvent.findUnique({ where: { id: auditRowId } })
      );
      assert.equal(
        foreignById,
        null,
        "cross-tenant session must not read audit row by primary key"
      );

      const foreignByTenantFilter = await withRlsSession(appRole, tenantB, async (tx) =>
        tx.auditEvent.findMany({ where: { tenantId: tenantA } })
      );
      assert.equal(
        foreignByTenantFilter.length,
        0,
        "tenantId filter cannot bypass RLS — tenant B session sees 0 tenant A rows"
      );
    });

    it("audit_events RLS isolation mirrors tours (same entity, same visibility)", async () => {
      const tourUnderB = await withRlsSession(appRole, tenantB, async (tx) =>
        tx.tour.findUnique({
          where: { tenantId_id: { tenantId: tenantA, id: tourId } },
        })
      );
      assert.equal(tourUnderB, null, "tenant B must not read tenant A tour");

      const auditUnderB = await withRlsSession(appRole, tenantB, async (tx) =>
        tx.auditEvent.findMany({ where: { entityId: tourId } })
      );
      assert.equal(auditUnderB.length, 0, "tenant B must not read tenant A audit for same entity");

      const tourUnderA = await withRlsSession(appRole, tenantA, async (tx) =>
        tx.tour.findUnique({
          where: { tenantId_id: { tenantId: tenantA, id: tourId } },
        })
      );
      assert.ok(tourUnderA, "tenant A must read own tour");

      const auditUnderA = await withRlsSession(appRole, tenantA, async (tx) =>
        tx.auditEvent.findMany({ where: { entityId: tourId } })
      );
      assert.equal(auditUnderA.length, 1, "tenant A must read own audit for same entity");
    });

    it("tenant-scoped audit lookup uses tenant_id index (query plan)", async () => {
      await admin.$executeRawUnsafe(`ANALYZE audit_events`);
      const planRows = await admin.$queryRaw<ExplainRow[]>`
        EXPLAIN (FORMAT TEXT)
        SELECT id FROM audit_events
        WHERE tenant_id = ${tenantA}::uuid
          AND entity_id = ${tourId}::uuid
      `;
      const planText = planRows.map((row) => row["QUERY PLAN"]).join("\n");
      // Tiny fixture tables may still seq-scan; require index exists and plan is bounded.
      const indexRows = await admin.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'audit_events'
          AND indexdef ILIKE '%tenant_id%'
      `;
      assert.ok(indexRows.length > 0, "audit_events must have a tenant_id index");
      const usesIndex = /Index Scan|Bitmap Index Scan/i.test(planText);
      const boundedSeqScan =
        /Seq Scan on audit_events/i.test(planText) && /rows=1\b/i.test(planText);
      assert.ok(
        usesIndex || boundedSeqScan,
        `expected index-backed or bounded seq scan for tenant_id lookup; plan:\n${planText}`
      );
      if (usesIndex) {
        assert.match(
          planText,
          /Index Cond: \(tenant_id =/i,
          `plan should use tenant_id as index condition; plan:\n${planText}`
        );
      }
    });
  }
);

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { withTenantRls } from "../../src/db/with-tenant-rls";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

/** NOBYPASSRLS app role — must not see tenant rows without session tenant. */
const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

/**
 * Phase 5 raw SQL / Prisma RLS exposure — live Postgres (no mocks).
 * CRITICAL: app_tour without `app.current_tenant_id` must see 0 rows on RLS tables.
 *
 * Prerequisite: phase-5 SQL migrations + RLS policies on 5434.
 */
describe(
  "raw SQL and Risma RLS exposure (0-security)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const tourAId = randomUUID();
    const tourBId = randomUUID();
    const outboxAId = randomUUID();
    const outboxBId = randomUUID();
    const auditAId = randomUUID();
    const auditBId = randomUUID();
    const processedAId = randomUUID();

    let admin: PrismaClient;
    let appRole: PrismaClient;

    before(async () => {
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      appRole = new PrismaClient({ datasources: { db: { url: APP_TOUR_URL } } });

      for (const [tenantId, subdomain] of [
        [tenantA, `raw-rls-a-${tenantA.slice(0, 8)}`],
        [tenantB, `raw-rls-b-${tenantB.slice(0, 8)}`],
      ] as const) {
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain,
            workspaceType: "starter",
            theme: {},
          },
        });
      }

      await admin.tour.create({
        data: {
          id: tourAId,
          tenantId: tenantA,
          canonical: {
            schemaVersion: 1,
            roots: ["basics"],
            data: { basics: { title: "tenant-a-tour" } },
          },
        },
      });
      await admin.tour.create({
        data: {
          id: tourBId,
          tenantId: tenantB,
          canonical: {
            schemaVersion: 1,
            roots: ["basics"],
            data: { basics: { title: "tenant-b-tour" } },
          },
        },
      });

      await admin.outboxEvent.create({
        data: {
          id: outboxAId,
          tenantId: tenantA,
          aggregateType: "tour",
          aggregateId: tourAId,
          eventType: "TourCreated",
          payload: { tenantId: tenantA, tourId: tourAId },
          status: "pending",
          domainEventId: `raw-rls-a-${randomUUID()}`,
        },
      });
      await admin.outboxEvent.create({
        data: {
          id: outboxBId,
          tenantId: tenantB,
          aggregateType: "tour",
          aggregateId: tourBId,
          eventType: "TourCreated",
          payload: { tenantId: tenantB, tourId: tourBId },
          status: "pending",
          domainEventId: `raw-rls-b-${randomUUID()}`,
        },
      });

      await admin.auditEvent.create({
        data: {
          id: auditAId,
          tenantId: tenantA,
          action: "TOUR_CREATED",
          entityType: "tour",
          entityId: tourAId,
          metadata: { probe: "raw-rls-a" },
        },
      });
      await admin.auditEvent.create({
        data: {
          id: auditBId,
          tenantId: tenantB,
          action: "TOUR_CREATED",
          entityType: "tour",
          entityId: tourBId,
          metadata: { probe: "raw-rls-b" },
        },
      });

      await admin.processedDomainEvent.create({
        data: {
          id: processedAId,
          tenantId: tenantA,
          domainEventId: `processed-${randomUUID()}`,
        },
      });
    });

    after(async () => {
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        await admin.processedDomainEvent.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.auditEvent.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.outboxEvent.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.tour.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.tenant.deleteMany({
          where: { id: { in: [tenantA, tenantB] } },
        });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await admin.$disconnect();
      await appRole.$disconnect();
      await disconnectPrisma();
    });

    it("app_tour without set_config: Prisma findMany returns 0 rows on RLS tables", async () => {
      assert.equal((await appRole.tour.findMany()).length, 0);
      assert.equal((await appRole.outboxEvent.findMany()).length, 0);
      assert.equal((await appRole.auditEvent.findMany()).length, 0);
      assert.equal((await appRole.processedDomainEvent.findMany()).length, 0);
    });

    it("app_tour without set_config: seeded rows invisible by id", async () => {
      assert.equal(await appRole.tour.findUnique({ where: { id: tourAId } }), null);
      assert.equal(await appRole.outboxEvent.findUnique({ where: { id: outboxAId } }), null);
      assert.equal(await appRole.auditEvent.findUnique({ where: { id: auditAId } }), null);
    });

    it("app_tour without set_config: raw SQL count on outbox_events is 0", async () => {
      const rows = await appRole.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS count FROM outbox_events
      `;
      const count = Number(rows[0]?.count ?? -1);
      assert.equal(count, 0, "RLS must hide outbox_events from app_tour without session");
    });

    it("admin may read seeded tenant data (expected ops bypass)", async () => {
      process.env.DATABASE_URL_ADMIN = ADMIN_URL;
      const adminClient = getPrismaAdmin();
      const tours = await adminClient.tour.findMany({
        where: { id: { in: [tourAId, tourBId] } },
      });
      assert.equal(tours.length, 2);
      const outbox = await adminClient.outboxEvent.findMany({
        where: { id: { in: [outboxAId, outboxBId] } },
      });
      assert.equal(outbox.length, 2);
      await disconnectPrisma();
    });

    it("withTenantRls: sees only scoped tenant rows (cross-tenant isolation)", async () => {
      process.env.DATABASE_URL = APP_TOUR_URL;

      const toursA = await withTenantRls(tenantA, (tx) =>
        tx.tour.findMany({ where: { tenantId: tenantA } })
      );
      assert.equal(toursA.length, 1);
      assert.equal(toursA[0]?.id, tourAId);

      const toursBFromA = await withTenantRls(tenantA, (tx) =>
        tx.tour.findMany({ where: { tenantId: tenantB } })
      );
      assert.equal(toursBFromA.length, 0);

      const outboxA = await withTenantRls(tenantA, (tx) =>
        tx.outboxEvent.findMany({ where: { tenantId: tenantA } })
      );
      assert.equal(outboxA.length, 1);
      assert.equal(outboxA[0]?.id, outboxAId);

      const auditA = await withTenantRls(tenantA, (tx) =>
        tx.auditEvent.findMany({ where: { tenantId: tenantA } })
      );
      assert.equal(auditA.length, 1);
      assert.equal(auditA[0]?.id, auditAId);

      await disconnectPrisma();
    });
  }
);

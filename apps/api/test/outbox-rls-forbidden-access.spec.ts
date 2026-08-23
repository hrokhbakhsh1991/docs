import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

/** NOBYPASSRLS app role — must not see rows without session tenant. */
const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

/**
 * P5-1 / REQ-P5-033 — outbox_events RLS: app_tour without set_config sees 0 rows.
 * Prerequisite: infra/sql/002_phase5_data_layer.sql applied on DATABASE_URL host.
 */
describe(
  "outbox_events RLS forbidden access (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = randomUUID();
    const outboxId = randomUUID();
    let admin: PrismaClient;
    let appRole: PrismaClient;

    before(async () => {
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      appRole = new PrismaClient({ datasources: { db: { url: APP_TOUR_URL } } });

      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `outbox-rls-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      await admin.outboxEvent.create({
        data: {
          id: outboxId,
          tenantId,
          aggregateType: "tour",
          aggregateId: randomUUID(),
          eventType: "TourCreated",
          payload: { tenantId, tourId: randomUUID() },
          status: "pending",
          domainEventId: `p5-1-rls-${randomUUID()}`,
        },
      });
    });

    after(async () => {
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
      await admin.tenant.delete({ where: { id: tenantId } });
      await admin.$disconnect();
      await appRole.$disconnect();
    });

    it("app_tour without set_config cannot read outbox_events (0 rows)", async () => {
      const rows = await appRole.outboxEvent.findMany();
      assert.equal(
        rows.length,
        0,
        "RLS must hide all outbox rows when app.current_tenant_id is unset"
      );
    });

    it("app_tour without set_config cannot read seeded row by id (null)", async () => {
      const row = await appRole.outboxEvent.findUnique({ where: { id: outboxId } });
      assert.equal(row, null);
    });

    it("app_tour with tenant session sees only that tenant outbox rows", async () => {
      const rows = await appRole.$transaction(async (tx) => {
        await tx.$executeRaw`
          SELECT set_config('app.current_tenant_id', ${tenantId}::text, true)
        `;
        return tx.outboxEvent.findMany({ where: { tenantId } });
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.id, outboxId);
    });
  }
);

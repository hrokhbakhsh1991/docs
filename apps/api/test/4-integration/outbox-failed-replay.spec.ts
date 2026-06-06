/**
 * DEC-086 — outbox terminal failed + admin replay heal (INT-SAGA-03 extension).
 *
 * Run:
 *   cd apps/api && DATABASE_URL=... DATABASE_URL_ADMIN=... STORAGE_DRIVER=prisma \
 *     NODE_ENV=test node --import tsx --test test/4-integration/outbox-failed-replay.spec.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { disconnectPrisma } from "../../src/db/prisma";
import { processOutboxRelayForTenantOnce } from "../../src/outbox/outbox-relay";
import { replayFailedOutboxEvent } from "../../src/outbox/outbox-replay";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

describe("outbox failed replay (integration)", { skip: !hasDatabase, concurrency: false }, () => {
  const tenantId = integrationTenantId();
  const runId = randomUUID().slice(0, 8);
  let admin: PrismaClient;
  const priorStorage = process.env.STORAGE_DRIVER;

  before(async () => {
    process.env.STORAGE_DRIVER = "prisma";
    await disconnectPrisma();
    admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
    await admin.tenant.create({
      data: {
        id: tenantId,
        subdomain: `replay-${runId}`,
        workspaceType: "starter",
        theme: {},
      },
    });
  });

  after(async () => {
    process.env.STORAGE_DRIVER = priorStorage;
    await admin.outboxEvent.deleteMany({ where: { tenantId } });
    await admin.tour.deleteMany({ where: { tenantId } });
    await admin.tenant.deleteMany({ where: { id: tenantId } });
    await admin.$disconnect();
    await disconnectPrisma();
  });

  it("INT-SAGA-03 heal: failed poison → fix payload → replay → relay done", async () => {
    const attackerTenant = randomUUID();
    await admin.tenant.create({
      data: {
        id: attackerTenant,
        subdomain: `replay-att-${runId}`,
        workspaceType: "starter",
        theme: {},
      },
    });

    const tourId = randomUUID();
    const outboxRowId = randomUUID();
    const domainEventId = randomUUID();

    await admin.tour.create({
      data: {
        id: tourId,
        tenantId,
        canonical: {
          schemaVersion: 1,
          roots: ["basics"],
          data: { basics: { title: "replay-heal" } },
        },
      },
    });

    await admin.outboxEvent.create({
      data: {
        id: outboxRowId,
        tenantId,
        aggregateType: "tour",
        aggregateId: tourId,
        eventType: "TourCreated",
        payload: { tenantId: attackerTenant, tourId },
        status: "pending",
        domainEventId,
      },
    });

    const failTick = await processOutboxRelayForTenantOnce(tenantId, 20);
    assert.ok(failTick.failed >= 1);

    const failedRow = await admin.outboxEvent.findUniqueOrThrow({ where: { id: outboxRowId } });
    assert.equal(failedRow.status, "failed");
    assert.ok(failedRow.processedAt);
    assert.ok(failedRow.lastError !== null && typeof failedRow.lastError === "object");

    await admin.outboxEvent.update({
      where: { id: outboxRowId },
      data: { payload: { tenantId, tourId } },
    });

    await replayFailedOutboxEvent({
      tenantId,
      outboxId: outboxRowId,
      skipDevOnlyGate: true,
    });

    const pendingRow = await admin.outboxEvent.findUniqueOrThrow({ where: { id: outboxRowId } });
    assert.equal(pendingRow.status, "pending");
    assert.equal(pendingRow.processedAt, null);
    assert.equal(pendingRow.lastError, null);

    const healTick = await processOutboxRelayForTenantOnce(tenantId, 20);
    assert.equal(healTick.published, 1);

    const doneRow = await admin.outboxEvent.findUniqueOrThrow({ where: { id: outboxRowId } });
    assert.equal(doneRow.status, "done");

    await admin.tenant.delete({ where: { id: attackerTenant } });
  });
});

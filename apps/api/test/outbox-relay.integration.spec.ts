import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, describe, it } from "node:test";

import { resetDomainEventBusForTests, subscribeDomainEvent } from "@app-tour/platform-events";
import { PrismaClient } from "@prisma/client";

import {
  claimPendingOutboxBatchForTenant,
  processOutboxRelayForTenantOnce,
  publishClaimedOutboxRow,
} from "../src/outbox/outbox-relay";
import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import {
  drainDomainEventHandlers,
  integrationTenantId,
  preparePostgresOutboxIsolation,
  quiesceStaleOutboxProcessing,
} from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const relaySourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/outbox/outbox-relay.ts"
);

describe("outbox relay (source invariants)", () => {
  it("relay source uses FOR UPDATE SKIP LOCKED in claim query", () => {
    const source = readFileSync(relaySourcePath, "utf8");
    assert.match(source, /FOR UPDATE SKIP LOCKED/);
  });

  it("claim marks processing with tenantId in updateMany WHERE (BULK-UNSAFE-04)", () => {
    const source = readFileSync(relaySourcePath, "utf8");
    assert.match(source, /markClaimedRowsProcessing/);
    assert.match(source, /tenantId:\s*tenantScope/);
    assert.match(source, /OR:\s*rows\.map/);
  });
});

/**
 * P5-4-S3 — relay claims with SKIP LOCKED, sets tenant session, delivers to platform-events bus.
 */
describe("outbox relay (integration)", { skip: !hasDatabase, concurrency: false }, () => {
  const tenantId = integrationTenantId();
  const tourId = randomUUID();
  const domainEventId = randomUUID();
  let admin: PrismaClient;
  let outboxRowId: string;

  before(async () => {
    await preparePostgresOutboxIsolation();
    resetDomainEventBusForTests();
    admin = getPrismaAdmin();
    await admin.outboxEvent.deleteMany({ where: { tenantId } });
    await admin.tenant.create({
      data: {
        id: tenantId,
        subdomain: `relay-${tenantId.slice(0, 8)}`,
        workspaceType: "starter",
        theme: {},
      },
    });

    const row = await admin.outboxEvent.create({
      data: {
        tenantId,
        aggregateType: "tour",
        aggregateId: tourId,
        eventType: "TourCreated",
        payload: { tenantId, tourId },
        status: "pending",
        domainEventId,
      },
    });
    outboxRowId = row.id;
  });

  beforeEach(async () => {
    resetDomainEventBusForTests();
    await quiesceStaleOutboxProcessing(0);
  });

  after(async () => {
    await admin.outboxEvent.deleteMany({ where: { tenantId } });
    await admin.tenant.delete({ where: { id: tenantId } });
    await disconnectPrisma();
  });

  it("delivers manually inserted outbox row to bus with correct tenantId", async () => {
    const seen: { tenantId: string; tourId?: string; eventId: string }[] = [];
    subscribeDomainEvent("TourCreated", (evt) => {
      seen.push({
        tenantId: evt.tenantId,
        tourId: (evt.payload as { tourId?: string }).tourId,
        eventId: evt.eventId,
      });
    });

    const result = await processOutboxRelayForTenantOnce(tenantId, 10);
    await drainDomainEventHandlers();

    assert.equal(result.claimed, 1);
    assert.equal(result.published, 1);
    assert.equal(result.failed, 0);

    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.tenantId, tenantId);
    assert.equal(seen[0]?.tourId, tourId);
    assert.equal(seen[0]?.eventId, domainEventId);

    const row = await admin.outboxEvent.findUnique({ where: { id: outboxRowId } });
    assert.equal(row?.status, "done");
    assert.ok(row?.processedAt !== null);
  });

  it("parallel claim ticks do not double-publish the same pending row", async () => {
    resetDomainEventBusForTests();
    const parallelTourId = randomUUID();
    const parallelDomainEventId = randomUUID();
    const deliveries: string[] = [];

    subscribeDomainEvent("TourCreated", (evt) => {
      deliveries.push(evt.eventId);
    });

    await admin.outboxEvent.deleteMany({
      where: { tenantId, status: { in: ["pending", "processing"] } },
    });

    await admin.outboxEvent.create({
      data: {
        tenantId,
        aggregateType: "tour",
        aggregateId: parallelTourId,
        eventType: "TourCreated",
        payload: { tenantId, tourId: parallelTourId },
        status: "pending",
        domainEventId: parallelDomainEventId,
      },
    });

    const [first, second] = await Promise.all([
      claimPendingOutboxBatchForTenant(tenantId, 1),
      claimPendingOutboxBatchForTenant(tenantId, 1),
    ]);

    const totalClaimed = first.length + second.length;
    assert.equal(totalClaimed, 1, "SKIP LOCKED must allow only one worker to claim the row");

    const claimed = first[0] ?? second[0];
    assert.ok(claimed);
    await publishClaimedOutboxRow(claimed);

    assert.deepEqual(deliveries, [parallelDomainEventId]);

    const stuckProcessing = await admin.outboxEvent.count({
      where: { tenantId, status: "processing", domainEventId: parallelDomainEventId },
    });
    assert.equal(stuckProcessing, 0);
  });

  it("outbox row visible only under matching tenant RLS session before publish", async () => {
    const isolatedTourId = randomUUID();
    const otherTenantId = integrationTenantId();

    await admin.tenant.create({
      data: {
        id: otherTenantId,
        subdomain: `relay-other-${otherTenantId.slice(0, 8)}`,
        workspaceType: "starter",
        theme: {},
      },
    });

    const inserted = await admin.outboxEvent.create({
      data: {
        tenantId,
        aggregateType: "tour",
        aggregateId: isolatedTourId,
        eventType: "TourCreated",
        payload: { tenantId, tourId: isolatedTourId },
        status: "processing",
        domainEventId: randomUUID(),
      },
    });

    await withTenantRls(otherTenantId, async (tx) => {
      const cross = await tx.outboxEvent.findUnique({ where: { id: inserted.id } });
      assert.equal(cross, null, "wrong tenant session must not see foreign outbox row");
    });

    await withTenantRls(tenantId, async (tx) => {
      const visible = await tx.outboxEvent.findUnique({ where: { id: inserted.id } });
      assert.ok(visible, "matching tenant session must see outbox row before bus publish");
    });

    await admin.tenant.delete({ where: { id: otherTenantId } });
  });
});

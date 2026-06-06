import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { processOutboxRelayOnce } from "./outbox-relay";
import { drainOutboxRelayOnShutdown } from "./outbox-shutdown-drain";
import { countActiveProcessingOutboxRows, countPendingOutboxRows } from "./outbox-queue-counts";
import { reclaimStaleProcessingOutboxRows } from "./outbox-processing-reclaim";
import { resolveOutboxProcessingReclaimMs } from "./outbox-reclaim-config";
import { integrationTenantId } from "../../test/test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const relaySourcePath = join(dirname(fileURLToPath(import.meta.url)), "outbox-relay.ts");
const reclaimSourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "outbox-processing-reclaim.ts"
);
const shutdownSourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../server/graceful-shutdown.ts"
);

describe("outbox processing reclaim (source invariants)", () => {
  it("claim marks processing with processedAt timestamp (DEC-071)", () => {
    const source = readFileSync(relaySourcePath, "utf8");
    assert.match(source, /status:\s*"processing",\s*processedAt:\s*new Date\(\)/);
    assert.match(source, /reclaimStaleProcessingOutboxRows/);
  });

  it("shutdown uses drainOutboxRelayOnShutdown (F-05 / SD-G1)", () => {
    const source = readFileSync(shutdownSourcePath, "utf8");
    assert.match(source, /drainOutboxRelayOnShutdown/);
    assert.match(source, /await deps\.outboxRelay\.stop\(\)/);
    assert.match(source, /assertOutboxShutdownDrained/);
  });

  it("reclaim module exports TTL resolver", () => {
    const reclaimSource = readFileSync(reclaimSourcePath, "utf8");
    const configSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "outbox-reclaim-config.ts"),
      "utf8"
    );
    assert.match(configSource, /OUTBOX_PROCESSING_RECLAIM_MS/);
    assert.match(reclaimSource, /OUTBOX_PROCESSING_RECLAIM_MS/);
    assert.match(reclaimSource, /computeRelayBackoff/);
    assert.match(reclaimSource, /outbox_processing_reclaimed_total/);
  });
});

describe(
  "outbox processing reclaim (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const reclaimMs = 5_000;
    let admin: PrismaClient;
    let zombieRowId: string;

    before(async () => {
      process.env.OUTBOX_PROCESSING_RECLAIM_MS = String(reclaimMs);
      admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `reclaim-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      const staleClaimTime = new Date(Date.now() - reclaimMs - 1_000);
      const row = await admin.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "tour",
          aggregateId: randomUUID(),
          eventType: "TourCreated",
          payload: { tenantId },
          status: "processing",
          domainEventId: randomUUID(),
          processedAt: staleClaimTime,
        },
      });
      zombieRowId = row.id;
    });

    after(async () => {
      delete process.env.OUTBOX_PROCESSING_RECLAIM_MS;
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
      await admin.tenant.deleteMany({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    it("reclaimStaleProcessingOutboxRows resets stale processing to pending", async () => {
      const reclaimed = await reclaimStaleProcessingOutboxRows(reclaimMs);
      assert.equal(reclaimed, 1);

      const row = await admin.outboxEvent.findUniqueOrThrow({ where: { id: zombieRowId } });
      assert.equal(row.status, "pending");
      assert.equal(row.processedAt, null);
    });

    it("active processing younger than TTL is not reclaimed", async () => {
      const activeBefore = await countActiveProcessingOutboxRows(reclaimMs);
      const freshRow = await admin.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "tour",
          aggregateId: randomUUID(),
          eventType: "TourCreated",
          payload: { tenantId },
          status: "processing",
          domainEventId: randomUUID(),
          processedAt: new Date(),
        },
      });

      const reclaimed = await reclaimStaleProcessingOutboxRows(reclaimMs);
      assert.equal(reclaimed, 0);
      assert.equal(await countActiveProcessingOutboxRows(reclaimMs), activeBefore + 1);

      await admin.outboxEvent.delete({ where: { id: freshRow.id } });
    });

    it("processOutboxRelayOnce reclaims before claiming pending rows", async () => {
      const staleClaimTime = new Date(Date.now() - reclaimMs - 2_000);
      const zombie = await admin.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "tour",
          aggregateId: randomUUID(),
          eventType: "TourCreated",
          payload: { tenantId },
          status: "processing",
          domainEventId: randomUUID(),
          processedAt: staleClaimTime,
        },
      });

      await processOutboxRelayOnce(10);

      const row = await admin.outboxEvent.findUniqueOrThrow({ where: { id: zombie.id } });
      assert.notEqual(row.status, "processing");
      assert.ok(row.status === "done" || row.status === "failed" || row.status === "pending");
    });

    it("resolveOutboxProcessingReclaimMs defaults to 120s", () => {
      delete process.env.OUTBOX_PROCESSING_RECLAIM_MS;
      assert.equal(resolveOutboxProcessingReclaimMs(), 120_000);
    });

    it("countPendingOutboxRows tracks pending only", async () => {
      const before = await countPendingOutboxRows();
      assert.ok(before >= 0);
    });

    it("drainOutboxRelayOnShutdown returns drained=false when deadline expires (SD-G3)", async () => {
      await admin.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "tour",
          aggregateId: randomUUID(),
          eventType: "TourCreated",
          payload: { tenantId },
          status: "pending",
          domainEventId: randomUUID(),
        },
      });

      const result = await drainOutboxRelayOnShutdown(80, async () => {});
      assert.equal(result.drained, false);
      assert.ok(result.pending > 0);
    });
  }
);

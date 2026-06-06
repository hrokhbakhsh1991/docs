import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { disconnectPrisma, getPrismaAdmin } from "../db/prisma";
import { markOutboxDone, resolveOutboxMarkDoneRetryAttempts } from "./outbox-mark-done";
import {
  healPublishedProcessingOutboxRows,
  reclaimStaleProcessingOutboxRows,
} from "./outbox-processing-reclaim";
import { publishClaimedOutboxRow, type ClaimedOutboxRow } from "./outbox-relay";
import {
  drainDomainEventHandlers,
  integrationTenantId,
  preparePostgresOutboxIsolation,
} from "../../test/test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const relaySourcePath = join(dirname(fileURLToPath(import.meta.url)), "outbox-relay.ts");
const markDoneSourcePath = join(dirname(fileURLToPath(import.meta.url)), "outbox-mark-done.ts");

describe("outbox publish/done pairing (source invariants)", () => {
  it("relay uses markOutboxDoneWithRetry after bus publish (DEC-072)", () => {
    const source = readFileSync(relaySourcePath, "utf8");
    assert.match(source, /markOutboxDoneWithRetry/);
    assert.match(source, /OutboxMarkDoneAfterPublishError/);
  });

  it("mark-done requires processing status predicate", () => {
    const source = readFileSync(markDoneSourcePath, "utf8");
    assert.match(source, /status:\s*"processing"|status\s*=\s*'processing'/);
    assert.match(source, /OUTBOX_MARK_DONE_RETRY_ATTEMPTS/);
  });
});

describe(
  "outbox publish/done pairing (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const reclaimMs = 5_000;
    let admin: PrismaClient;

    before(async () => {
      await preparePostgresOutboxIsolation();
      await drainDomainEventHandlers();
      process.env.OUTBOX_PROCESSING_RECLAIM_MS = String(reclaimMs);
      admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `pairing-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });
    });

    after(async () => {
      delete process.env.OUTBOX_PROCESSING_RECLAIM_MS;
      await admin.processedDomainEvent.deleteMany({ where: { tenantId } });
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
      await admin.tenant.deleteMany({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    it("markOutboxDone rejects rows not in processing", async () => {
      const row = await admin.outboxEvent.create({
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

      await assert.rejects(
        () => markOutboxDone({ id: row.id, tenantId }),
        /OUTBOX_MARK_DONE_CONDITION_FAILED/
      );
    });

    it("publishClaimedOutboxRow marks done after publish (happy path)", async () => {
      const domainEventId = randomUUID();
      const aggregateId = randomUUID();
      const created = await admin.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "tour",
          aggregateId,
          eventType: "TourCreated",
          payload: { tenantId, tourId: aggregateId },
          status: "processing",
          domainEventId,
          processedAt: new Date(),
        },
      });

      const claimed: ClaimedOutboxRow = {
        id: created.id,
        tenantId: created.tenantId,
        aggregateType: created.aggregateType,
        aggregateId: created.aggregateId,
        eventType: created.eventType,
        payload: created.payload,
        domainEventId,
        correlationId: created.correlationId,
        createdAt: created.createdAt,
      };

      await publishClaimedOutboxRow(claimed);

      const after = await admin.outboxEvent.findUniqueOrThrow({ where: { id: created.id } });
      assert.equal(after.status, "done");
      assert.ok(after.processedAt);
    });

    it("healPublishedProcessingOutboxRows closes OZ-02 when processed log exists", async () => {
      const domainEventId = randomUUID();
      const staleClaimTime = new Date(Date.now() - reclaimMs - 2_000);
      const zombie = await admin.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "tour",
          aggregateId: randomUUID(),
          eventType: "TourCreated",
          payload: { tenantId },
          status: "processing",
          domainEventId,
          processedAt: staleClaimTime,
        },
      });

      await admin.processedDomainEvent.create({
        data: { tenantId, domainEventId },
      });

      const healed = await healPublishedProcessingOutboxRows(reclaimMs);
      assert.equal(healed, 1);

      const row = await admin.outboxEvent.findUniqueOrThrow({ where: { id: zombie.id } });
      assert.equal(row.status, "done");
    });

    it("reclaimStaleProcessingOutboxRows heals before resetting to pending", async () => {
      const domainEventId = randomUUID();
      const staleClaimTime = new Date(Date.now() - reclaimMs - 3_000);
      const healedRow = await admin.outboxEvent.create({
        data: {
          tenantId,
          aggregateType: "tour",
          aggregateId: randomUUID(),
          eventType: "TourCreated",
          payload: { tenantId },
          status: "processing",
          domainEventId,
          processedAt: staleClaimTime,
        },
      });

      const reclaimRow = await admin.outboxEvent.create({
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

      await admin.processedDomainEvent.create({
        data: { tenantId, domainEventId },
      });

      await reclaimStaleProcessingOutboxRows(reclaimMs);

      const healed = await admin.outboxEvent.findUniqueOrThrow({ where: { id: healedRow.id } });
      assert.equal(healed.status, "done");

      const reclaimed = await admin.outboxEvent.findUniqueOrThrow({ where: { id: reclaimRow.id } });
      assert.equal(reclaimed.status, "pending");
      assert.equal(reclaimed.processedAt, null);
    });

    it("resolveOutboxMarkDoneRetryAttempts defaults to 3", () => {
      delete process.env.OUTBOX_MARK_DONE_RETRY_ATTEMPTS;
      assert.equal(resolveOutboxMarkDoneRetryAttempts(), 3);
    });
  }
);

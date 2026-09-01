/**
 * DEC-087 — per-tenant FIFO claim guard when OUTBOX_RELAY_ORDERED_PER_TENANT=true.
 *
 * Run:
 *   cd apps/api && DATABASE_URL=... DATABASE_URL_ADMIN=... STORAGE_DRIVER=prisma \
 *     OUTBOX_RELAY_ORDERED_PER_TENANT=true NODE_ENV=test \
 *     node --import tsx --test test/4-integration/outbox-relay-ordered-per-tenant.spec.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { disconnectPrisma } from "../../src/db/prisma";
import { claimPendingOutboxBatchForTenant } from "../../src/outbox/outbox-relay";
import { integrationTenantId, quiesceStaleOutboxProcessing } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const PROBE_EVENT = "OrderedPerTenantProbe";

describe(
  "outbox relay ordered per tenant (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    let admin: PrismaClient;
    const priorStorage = process.env.STORAGE_DRIVER;
    const priorOrdered = process.env.OUTBOX_RELAY_ORDERED_PER_TENANT;
    const priorRelay = process.env.OUTBOX_RELAY_ENABLED;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.OUTBOX_RELAY_ORDERED_PER_TENANT = "true";
      process.env.OUTBOX_RELAY_ENABLED = "false";
      await disconnectPrisma();
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `ordered-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorage;
      process.env.OUTBOX_RELAY_ORDERED_PER_TENANT = priorOrdered;
      if (priorRelay === undefined) {
        delete process.env.OUTBOX_RELAY_ENABLED;
      } else {
        process.env.OUTBOX_RELAY_ENABLED = priorRelay;
      }
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
      await admin.tenant.deleteMany({ where: { id: tenantId } });
      await admin.$disconnect();
      await disconnectPrisma();
    });

    beforeEach(async () => {
      await admin.outboxEvent.deleteMany({ where: { tenantId } });
      await quiesceStaleOutboxProcessing(0);
    });

    it("blocks second pending row while first is processing (same tenant)", async () => {
      const firstId = randomUUID();
      const secondId = randomUUID();
      const aggregateId = randomUUID();
      const firstCreatedAt = new Date("2026-01-01T00:00:00.000Z");
      const secondCreatedAt = new Date("2026-01-01T00:00:00.001Z");

      await admin.outboxEvent.createMany({
        data: [
          {
            id: firstId,
            tenantId,
            aggregateType: "probe",
            aggregateId,
            eventType: PROBE_EVENT,
            payload: { tenantId, seq: 1 },
            status: "pending",
            domainEventId: randomUUID(),
            createdAt: firstCreatedAt,
          },
          {
            id: secondId,
            tenantId,
            aggregateType: "probe",
            aggregateId,
            eventType: PROBE_EVENT,
            payload: { tenantId, seq: 2 },
            status: "pending",
            domainEventId: randomUUID(),
            createdAt: secondCreatedAt,
          },
        ],
      });

      const firstClaim = await claimPendingOutboxBatchForTenant(tenantId, 10);
      assert.equal(firstClaim.length, 1);
      assert.equal(firstClaim[0]?.id, firstId);

      const blockedClaim = await claimPendingOutboxBatchForTenant(tenantId, 10);
      assert.equal(blockedClaim.length, 0, "second row must wait while first is processing");

      await admin.outboxEvent.update({
        where: { id: firstId },
        data: { status: "done", processedAt: new Date() },
      });

      const secondClaim = await claimPendingOutboxBatchForTenant(tenantId, 10);
      assert.equal(secondClaim.length, 1);
      assert.equal(secondClaim[0]?.id, secondId);

      await admin.outboxEvent.update({
        where: { id: secondId },
        data: { status: "done", processedAt: new Date() },
      });
    });
  }
);

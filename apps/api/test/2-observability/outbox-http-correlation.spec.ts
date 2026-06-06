/**
 * TRACE-LOST-03 / DEC-046 — outbox enqueue stores HTTP trace correlation on tour create.
 *
 * Run (Postgres):
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
 *     NODE_ENV=test STORAGE_DRIVER=prisma node --import tsx --test test/2-observability/outbox-http-correlation.spec.ts
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
import { runWithTraceContext } from "../../src/observability/trace-request-context";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const VALID_BODY = {
  data: {
    basics: { title: "Outbox correlation tour" },
    details: { summary: "ok" },
  },
} as const;

describe(
  "2-observability — outbox HTTP correlation (TRACE-LOST-03)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    let admin: PrismaClient;
    const priorStorage = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `p2oc-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorage;
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        await admin.auditEvent.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await admin.$disconnect();
    });

    async function persistWithCanonical() {
      try {
        const canonical = await runPreTransactionValidation({
          body: VALID_BODY,
          tenantId,
          workspaceType: "starter",
        });
        return await persistNewTourAtomically({ tenantId, canonical });
      } finally {
        clearPreTransactionValidationGate(tenantId);
      }
    }

    it("TRACE-LOST-03a: stores active trace id on outbox row when trace ALS is bound", async () => {
      const traceId = randomUUID();

      const result = await runWithTraceContext(traceId, persistWithCanonical);

      const outbox = await admin.outboxEvent.findFirst({
        where: { tenantId, aggregateId: result.id },
      });
      assert.ok(outbox);
      assert.equal(outbox.correlationId, traceId);
    });

    it("TRACE-LOST-03b: stores null correlation_id when trace ALS is absent", async () => {
      const result = await persistWithCanonical();

      const outbox = await admin.outboxEvent.findFirst({
        where: { tenantId, aggregateId: result.id },
      });
      assert.ok(outbox);
      assert.equal(outbox.correlationId, null);
    });
  }
);

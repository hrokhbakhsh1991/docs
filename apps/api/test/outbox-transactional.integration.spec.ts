import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createApiAbility } from "../src/casl/api-ability";
import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { persistNewTourAtomically } from "../src/canonical/atomic-canonical-tour-persist";
import {
  clearPreTransactionValidationGate,
  runPreTransactionValidation,
} from "../src/canonical/pre-transaction-validation";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import { createTourStorageRepository } from "../src/storage/create-tour-storage";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

/**
 * RULE-008 / RULE-013 — tour SoT + projection columns + outbox commit or roll back together.
 */
describe(
  "outbox transactional atomic persist (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    let admin: PrismaClient;
    const priorStorage = process.env.STORAGE_DRIVER;
    const priorAbort = process.env.P5_ATOMIC_TX_TEST_ABORT;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `p54-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorage;
      process.env.P5_ATOMIC_TX_TEST_ABORT = priorAbort;
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

    const validBody = {
      data: {
        basics: { title: "Atomic Tour" },
        details: { summary: "ok" },
      },
    };

    async function persistValidated(
      canonicalOverride?: Awaited<ReturnType<typeof runPreTransactionValidation>>
    ) {
      let canonical = canonicalOverride;
      try {
        canonical ??= await runPreTransactionValidation({
          body: validBody,
          tenantId,
          workspaceType: "starter",
        });
        return await persistNewTourAtomically({ tenantId, canonical });
      } finally {
        clearPreTransactionValidationGate();
      }
    }

    it("commits tour projection columns and outbox row in one transaction", async () => {
      delete process.env.P5_ATOMIC_TX_TEST_ABORT;

      const result = await persistValidated();

      const row = await admin.tour.findUnique({
        where: { tenantId_id: { tenantId, id: result.id } },
      });
      assert.ok(row);
      assert.equal(row.title, "Atomic Tour");
      assert.equal(row.schemaVersion, 1);

      const outbox = await admin.outboxEvent.findMany({ where: { tenantId } });
      assert.equal(outbox.length, 1);
      assert.equal(outbox[0]?.status, "pending");
      assert.equal(outbox[0]?.eventType, "TourCreated");
      assert.equal(outbox[0]?.aggregateId, result.id);
    });

    async function assertAtomicRollback(
      markerTitle: string,
      toursBefore: number,
      outboxBefore: number
    ): Promise<void> {
      assert.equal(
        await admin.tour.count({ where: { tenantId } }),
        toursBefore,
        "tour row (SoT + projection columns) must roll back"
      );
      assert.equal(
        await admin.outboxEvent.count({ where: { tenantId } }),
        outboxBefore,
        "outbox row must roll back"
      );
      const projected = await admin.tour.findFirst({
        where: { tenantId, title: markerTitle },
      });
      assert.equal(projected, null, "tours.title projection must not survive failed TX");
    }

    it("rolls back tour, projection columns, and outbox when abort before outbox insert", async () => {
      process.env.P5_ATOMIC_TX_TEST_ABORT = "before_outbox";
      const markerTitle = "Rollback Before Outbox";

      const toursBefore = await admin.tour.count({ where: { tenantId } });
      const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });

      const canonical = await runPreTransactionValidation({
        body: {
          data: {
            basics: { title: markerTitle },
            details: { summary: "ok" },
          },
        },
        tenantId,
        workspaceType: "starter",
      });

      await assert.rejects(
        () => persistNewTourAtomically({ tenantId, canonical }),
        /P5_ATOMIC_TX_TEST_ABORT/
      );
      clearPreTransactionValidationGate();

      await assertAtomicRollback(markerTitle, toursBefore, outboxBefore);
    });

    it("rolls back tour, projection columns, and outbox when outbox insert throws", async () => {
      delete process.env.P5_ATOMIC_TX_TEST_ABORT;
      process.env.P5_ATOMIC_TX_TEST_ABORT = "outbox";
      const markerTitle = "Rollback On Outbox";

      const toursBefore = await admin.tour.count({ where: { tenantId } });
      const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });

      const canonical = await runPreTransactionValidation({
        body: {
          data: {
            basics: { title: markerTitle },
            details: { summary: "ok" },
          },
        },
        tenantId,
        workspaceType: "starter",
      });

      await assert.rejects(
        () => persistNewTourAtomically({ tenantId, canonical }),
        /P5_ATOMIC_TX_TEST_ABORT/
      );
      clearPreTransactionValidationGate();

      await assertAtomicRollback(markerTitle, toursBefore, outboxBefore);
    });

    it("CanonicalTourService.writeTour on Prisma does not publish in-process before outbox commit", async () => {
      delete process.env.P5_ATOMIC_TX_TEST_ABORT;

      const seen: string[] = [];
      const { subscribeDomainEvent } = await import("@app-tour/platform-events");
      subscribeDomainEvent("TourCreated", (evt) => {
        seen.push(evt.tenantId);
      });

      const service = new CanonicalTourService(
        new TourStorageDbAdapter(createTourStorageRepository()),
        new LegacyCanonicalAdapter()
      );

      await service.writeTour({
        ability: createApiAbility({
          userId: "u1",
          tenantId,
          role: "admin",
          status: "ACTIVE",
          workspaceId: "ws-1",
        }),
        tenantId,
        workspaceType: "starter",
        body: {
          data: {
            basics: { title: "Via service" },
            details: { summary: "ok" },
          },
        },
      });

      assert.deepEqual(seen, [], "Prisma path must not call publishTourCreatedEvent");
      assert.ok((await admin.outboxEvent.count({ where: { tenantId } })) >= 1);
    });
  }
);

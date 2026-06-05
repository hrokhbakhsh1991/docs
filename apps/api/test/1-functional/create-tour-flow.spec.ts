/**
 * 1-functional — end-to-end create tour flow with persist-phase fault injection.
 *
 * Flow under test (HTTP POST /tours):
 *   ToursService.createTour
 *     → CanonicalTourService.writeTour
 *       → runPreTransactionValidation (RULE-003 plugin + schema)
 *       → persistNewTourAtomically / withCanonicalTransaction (tour + audit + outbox)
 *
 * Persist faults use existing test hooks (`P5_ATOMIC_TX_TEST_ABORT`) — no production seams.
 * Requires Postgres (`DATABASE_URL`) for real transaction rollback; skipped otherwise.
 *
 * @see apps/api/test/chaos/atomic-rollback-stress.spec.ts — subprocess chaos coverage
 * @see apps/api/test/1-reliability/service-partial-state.spec.ts — memory-path partial state
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { AUDIT_ACTION_TOUR_CREATED } from "../../src/audit/audit-logger";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { isPreTransactionValidationGateOpenForTests } from "../../src/canonical/pre-transaction-validation";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { ToursService } from "../../src/tours/tours.service";
import { assertZeroOrphanedState } from "../chaos/chaos-db-assertions";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

/** Valid starter canonical — passes plugin validation before persist. */
const VALID_TOUR_BODY = {
  data: { basics: { title: "functional-create-tour" }, details: { summary: "ok" } },
} as const;

/** Invalid starter canonical — basics.title required; fails before any TX. */
const INVALID_TOUR_BODY = {
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: {
    basics: {},
    details: { summary: "ok" },
  },
} as const;

/** Mid-TX abort points simulating connection loss / timeout during persist. */
const PERSIST_ABORT_MODES = ["before_outbox", "outbox", "pre_commit"] as const;
type PersistAbortMode = (typeof PERSIST_ABORT_MODES)[number];

function pickPersistAbortMode(): PersistAbortMode {
  return PERSIST_ABORT_MODES[Math.floor(Math.random() * PERSIST_ABORT_MODES.length)]!;
}

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "func-flow-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-func-flow",
  };
}

async function postTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  body: unknown
): Promise<{ status: number; body: { id?: string; error?: string; code?: string } }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: "/tours",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(payload)),
            ...authHeaders(tenantId),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            server.close();
            const raw = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: raw.length > 0 ? JSON.parse(raw) : {},
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      req.write(payload);
      req.end();
    });
  });
}

function validBodyWithTitle(title: string): typeof VALID_TOUR_BODY {
  return {
    data: { basics: { title }, details: { summary: "ok" } },
  };
}

/**
 * Functional E2E create-tour flow — Postgres integration only.
 * Skip reason surfaces when DATABASE_URL is unset (no in-memory rollback substitute).
 */
describe(
  "1-functional create tour flow (integration)",
  {
    skip: hasDatabase
      ? false
      : "DATABASE_URL required — Postgres integration for real TX rollback (see apps/api/.env.example)",
    concurrency: false,
  },
  () => {
    const tenantId = integrationTenantId();
    const runId = randomUUID().slice(0, 8);
    let admin: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    const priorAbort = process.env.P5_ATOMIC_TX_TEST_ABORT;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      await disconnectPrisma();
      admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `func-flow-${runId}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      const toursService = new ToursService(
        new CanonicalTourService(
          new TourStorageDbAdapter(createTourStorageRepository()),
          new LegacyCanonicalAdapter()
        )
      );
      listener = createRequestListener({ toursService });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorageDriver;
      process.env.P5_ATOMIC_TX_TEST_ABORT = priorAbort;
      delete process.env.P5_ATOMIC_TX_TEST_ABORT;

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
      await disconnectPrisma();
    });

    it("happy path: validate → persist → audit returns 201 with paired outbox", async () => {
      delete process.env.P5_ATOMIC_TX_TEST_ABORT;

      const markerTitle = `func-flow-ok-${runId}`;
      const toursBefore = await admin.tour.count({ where: { tenantId } });
      const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });
      const auditsBefore = await admin.auditEvent.count({ where: { tenantId } });

      const res = await postTour(listener, tenantId, validBodyWithTitle(markerTitle));
      assert.equal(res.status, 201);
      assert.ok(res.body.id);

      assert.equal(
        isPreTransactionValidationGateOpenForTests(tenantId),
        false,
        "gate must be cleared after successful write"
      );

      const tour = await admin.tour.findUnique({
        where: { tenantId_id: { tenantId, id: res.body.id! } },
      });
      assert.ok(tour);
      assert.equal(tour.title, markerTitle);

      const audit = await admin.auditEvent.findFirst({
        where: { tenantId, entityId: res.body.id, entityType: "tour" },
      });
      assert.ok(audit);
      assert.equal(audit.action, AUDIT_ACTION_TOUR_CREATED);

      const outbox = await admin.outboxEvent.findMany({
        where: {
          tenantId,
          aggregateId: res.body.id,
          eventType: "TourCreated",
        },
      });
      assert.equal(outbox.length, 1);
      assert.equal(outbox[0]?.status, "pending");

      const orphans = await assertZeroOrphanedState(admin, tenantId, {
        toursBefore: toursBefore + 1,
        outboxBefore: outboxBefore + 1,
        auditsBefore: auditsBefore + 1,
      });
      assert.equal(orphans.toursWithoutOutbox, 0);
      assert.equal(orphans.outboxWithoutTour, 0);
      assert.equal(orphans.auditWithoutTour, 0);
    });

    it("validation failure returns 400 VALIDATION_FAILURE without touching DB", async () => {
      delete process.env.P5_ATOMIC_TX_TEST_ABORT;

      const toursBefore = await admin.tour.count({ where: { tenantId } });
      const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });
      const auditsBefore = await admin.auditEvent.count({ where: { tenantId } });

      const res = await postTour(listener, tenantId, INVALID_TOUR_BODY);
      assert.equal(res.status, 400);
      assert.equal(res.body.code, "VALIDATION_FAILURE");
      assert.ok(
        res.body.error?.startsWith("CANONICAL_VALIDATION_FAILED"),
        "error message must describe validation failure"
      );

      assert.equal(await admin.tour.count({ where: { tenantId } }), toursBefore);
      assert.equal(await admin.outboxEvent.count({ where: { tenantId } }), outboxBefore);
      assert.equal(await admin.auditEvent.count({ where: { tenantId } }), auditsBefore);
      assert.equal(
        isPreTransactionValidationGateOpenForTests(tenantId),
        false,
        "validation failure must not leave gate open"
      );
    });

    it("persist-phase fault rolls back atomically and returns 500 internal_error", async () => {
      for (const mode of PERSIST_ABORT_MODES) {
        process.env.P5_ATOMIC_TX_TEST_ABORT = mode;
        const markerTitle = `func-flow-fault-${runId}-${mode}`;

        const toursBefore = await admin.tour.count({ where: { tenantId } });
        const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });
        const auditsBefore = await admin.auditEvent.count({ where: { tenantId } });

        const res = await postTour(listener, tenantId, validBodyWithTitle(markerTitle));
        assert.equal(
          res.status,
          500,
          `mode=${mode}: caller must receive HTTP 500, not unhandled crash`
        );
        assert.equal(
          res.body.error,
          "internal_error",
          `mode=${mode}: persist fault must map to structured internal_error (no leak)`
        );
        assert.equal(res.body.id, undefined, `mode=${mode}: no tour id on failure response`);

        assert.equal(
          isPreTransactionValidationGateOpenForTests(tenantId),
          false,
          `mode=${mode}: finally must clear pre-transaction validation gate`
        );

        await assertZeroOrphanedState(admin, tenantId, {
          markerTitle,
          toursBefore,
          outboxBefore,
          auditsBefore,
        });
      }
    });

    it("random persist abort mode: single iteration smoke", async () => {
      const mode = pickPersistAbortMode();
      process.env.P5_ATOMIC_TX_TEST_ABORT = mode;
      const markerTitle = `func-flow-random-${runId}-${mode}`;

      const toursBefore = await admin.tour.count({ where: { tenantId } });
      const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });
      const auditsBefore = await admin.auditEvent.count({ where: { tenantId } });

      const res = await postTour(listener, tenantId, validBodyWithTitle(markerTitle));
      assert.equal(res.status, 500);
      assert.equal(res.body.error, "internal_error");

      await assertZeroOrphanedState(admin, tenantId, {
        markerTitle,
        toursBefore,
        outboxBefore,
        auditsBefore,
      });
    });

    it("retry after persist fault succeeds end-to-end", async () => {
      process.env.P5_ATOMIC_TX_TEST_ABORT = "pre_commit";
      const faultTitle = `func-flow-retry-fault-${runId}`;

      const faultRes = await postTour(listener, tenantId, validBodyWithTitle(faultTitle));
      assert.equal(faultRes.status, 500);
      assert.equal(faultRes.body.error, "internal_error");

      const orphanTour = await admin.tour.findFirst({
        where: { tenantId, title: faultTitle },
      });
      assert.equal(orphanTour, null, "fault attempt must not leave tour row");

      delete process.env.P5_ATOMIC_TX_TEST_ABORT;
      const successTitle = `func-flow-retry-ok-${runId}`;
      const successRes = await postTour(listener, tenantId, validBodyWithTitle(successTitle));
      assert.equal(successRes.status, 201);
      assert.ok(successRes.body.id);

      const tour = await admin.tour.findUnique({
        where: { tenantId_id: { tenantId, id: successRes.body.id! } },
      });
      assert.ok(tour);
      assert.equal(tour.title, successTitle);

      const audit = await admin.auditEvent.findFirst({
        where: { tenantId, entityId: successRes.body.id, action: AUDIT_ACTION_TOUR_CREATED },
      });
      assert.ok(audit);

      const outbox = await admin.outboxEvent.findFirst({
        where: {
          tenantId,
          aggregateId: successRes.body.id,
          eventType: "TourCreated",
        },
      });
      assert.ok(outbox);
    });
  }
);

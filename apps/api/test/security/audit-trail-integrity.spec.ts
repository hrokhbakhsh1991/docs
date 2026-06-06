import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { AUDIT_ACTION_TOUR_CREATED } from "../../src/audit/audit-logger";
import { pseudonymizeAuditActorId } from "../../src/audit/audit-pseudonym";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { ValidationFailure } from "../../src/canonical/validation-failure";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const SUCCESS_MUTATION_COUNT = 20;
const FAILED_MUTATION_COUNT = 10;
const ACTOR_ID = "audit-trail-security-actor";

/** Invalid starter canonical — basics.title required (see 5.2-plugin-validation.spec.ts). */
const INVALID_TOUR_BODY = {
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: {
    basics: {},
    details: { summary: "failed-mutation" },
  },
};

const RUN_SUBDOMAIN = `audit-trail-${randomUUID().slice(0, 12)}`;

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": ACTOR_ID,
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-1",
  };
}

function validTourBody(marker: string): {
  data: { basics: { title: string }; details: { summary: string } };
} {
  return {
    data: {
      basics: { title: `audit-trail-success:${marker}` },
      details: { summary: `marker:${marker}` },
    },
  };
}

async function postTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  body: unknown
): Promise<{ status: number; body: { id?: string; code?: string; error?: string } }> {
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

function assertAppendOnlyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /append-only/i.test(message);
}

/**
 * Phase 5 immutable audit trail — DEC-007 forensic matrix (20 success / 10 failure).
 */
describe(
  "audit trail security integrity (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    let admin: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    let toursService: ToursService;
    const priorStorageDriver = process.env.STORAGE_DRIVER;
    const createdTourIds: string[] = [];

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: RUN_SUBDOMAIN,
          workspaceType: "starter",
          theme: {},
        },
      });

      toursService = new ToursService(
        new CanonicalTourService(
          new TourStorageDbAdapter(createTourStorageRepository()),
          new LegacyCanonicalAdapter()
        )
      );
      listener = createRequestListener({ toursService });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorStorageDriver;
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

    it("20 successes emit TOUR_CREATED audit rows; 10 failures emit none (DEC-007)", async () => {
      const auditBaseline = await admin.auditEvent.count({ where: { tenantId } });
      const tourBaseline = await admin.tour.count({ where: { tenantId } });
      const outboxBaseline = await admin.outboxEvent.count({ where: { tenantId } });

      for (let i = 0; i < SUCCESS_MUTATION_COUNT; i += 1) {
        const marker = `success-${i}`;
        const auditBefore = await admin.auditEvent.count({ where: { tenantId } });

        if (i % 2 === 0) {
          const res = await postTour(listener, tenantId, validTourBody(marker));
          assert.equal(res.status, 201, `HTTP create ${marker} must succeed`);
          assert.ok(res.body.id, `HTTP create ${marker} must return tour id`);
          createdTourIds.push(res.body.id);
        } else {
          const created = await runWithTenantContext(
            tenantId,
            () =>
              toursService.createTour(
                {
                  userId: ACTOR_ID,
                  tenantId,
                  role: "admin",
                  status: "ACTIVE",
                  workspaceId: "ws-1",
                },
                validTourBody(marker)
              ),
            { actorId: ACTOR_ID, workspaceType: "starter" }
          );
          createdTourIds.push(created.id);
        }

        const auditAfter = await admin.auditEvent.count({ where: { tenantId } });
        assert.equal(
          auditAfter,
          auditBefore + 1,
          `successful mutation ${marker} must append exactly one audit row`
        );
      }

      for (let i = 0; i < FAILED_MUTATION_COUNT; i += 1) {
        const marker = `fail-${i}`;
        const auditBefore = await admin.auditEvent.count({ where: { tenantId } });
        const toursBefore = await admin.tour.count({ where: { tenantId } });
        const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });

        if (i % 2 === 0) {
          const res = await postTour(listener, tenantId, {
            ...INVALID_TOUR_BODY,
            data: {
              ...INVALID_TOUR_BODY.data,
              details: { summary: marker },
            },
          });
          assert.equal(res.status, 400, `HTTP failure ${marker} must be 400`);
          assert.equal(res.body.code, "VALIDATION_FAILURE");
        } else {
          await assert.rejects(
            () =>
              runWithTenantContext(
                tenantId,
                () =>
                  toursService.createTour(
                    {
                      userId: ACTOR_ID,
                      tenantId,
                      role: "admin",
                      status: "ACTIVE",
                      workspaceId: "ws-1",
                    },
                    {
                      ...INVALID_TOUR_BODY,
                      data: {
                        ...INVALID_TOUR_BODY.data,
                        details: { summary: marker },
                      },
                    }
                  ),
                { actorId: ACTOR_ID, workspaceType: "starter" }
              ),
            (error: unknown) => {
              assert.ok(error instanceof ValidationFailure);
              assert.match(error.message, /CANONICAL_VALIDATION_FAILED/);
              return true;
            }
          );
        }

        const auditAfter = await admin.auditEvent.count({ where: { tenantId } });
        const toursAfter = await admin.tour.count({ where: { tenantId } });
        const outboxAfter = await admin.outboxEvent.count({ where: { tenantId } });

        assert.equal(auditAfter, auditBefore, `failed mutation ${marker} must not append audit`);
        assert.equal(toursAfter, toursBefore, `failed mutation ${marker} must not insert tour`);
        assert.equal(
          outboxAfter,
          outboxBefore,
          `failed mutation ${marker} must not enqueue outbox`
        );
      }

      const auditFinal = await admin.auditEvent.count({ where: { tenantId } });
      const tourFinal = await admin.tour.count({ where: { tenantId } });
      const outboxFinal = await admin.outboxEvent.count({ where: { tenantId } });

      assert.equal(auditFinal, auditBaseline + SUCCESS_MUTATION_COUNT);
      assert.equal(tourFinal, tourBaseline + SUCCESS_MUTATION_COUNT);
      assert.equal(outboxFinal, outboxBaseline + SUCCESS_MUTATION_COUNT);
      assert.equal(createdTourIds.length, SUCCESS_MUTATION_COUNT);

      const auditRows = await admin.auditEvent.findMany({
        where: { tenantId, action: AUDIT_ACTION_TOUR_CREATED },
        orderBy: { createdAt: "asc" },
      });
      assert.equal(auditRows.length, SUCCESS_MUTATION_COUNT);

      for (const tourId of createdTourIds) {
        const auditForTour = auditRows.filter((row) => row.entityId === tourId);
        assert.equal(
          auditForTour.length,
          1,
          `tour ${tourId} must have exactly one TOUR_CREATED audit row`
        );
        const auditRow = auditForTour[0]!;
        assert.equal(auditRow.tenantId, tenantId);
        assert.equal(auditRow.action, AUDIT_ACTION_TOUR_CREATED);
        assert.equal(auditRow.entityType, "tour");
        assert.equal(auditRow.actorId, pseudonymizeAuditActorId(ACTOR_ID, tenantId));

        const outboxForTour = await admin.outboxEvent.findMany({
          where: { tenantId, aggregateId: tourId, eventType: "TourCreated" },
        });
        assert.equal(
          outboxForTour.length,
          1,
          `tour ${tourId} must have exactly one TourCreated outbox row`
        );
        assert.equal(outboxForTour[0]?.aggregateId, tourId);
      }

      for (let i = 1; i < auditRows.length; i += 1) {
        const prev = auditRows[i - 1]!.createdAt.getTime();
        const curr = auditRows[i]!.createdAt.getTime();
        assert.ok(curr >= prev, `audit created_at must be monotonic per tenant (index ${i})`);
      }

      const tours = await admin.tour.findMany({
        where: { tenantId, id: { in: createdTourIds } },
        orderBy: { createdAt: "asc" },
      });
      assert.equal(tours.length, SUCCESS_MUTATION_COUNT);

      for (const tour of tours) {
        const auditRow = auditRows.find((row) => row.entityId === tour.id);
        const outboxRow = await admin.outboxEvent.findFirst({
          where: { tenantId, aggregateId: tour.id },
        });
        assert.ok(auditRow, `forensic gap: tour ${tour.id} missing audit row`);
        assert.ok(outboxRow, `forensic gap: tour ${tour.id} missing outbox row`);
        assert.equal(auditRow.entityId, tour.id);
        assert.equal(outboxRow.aggregateId, tour.id);
      }
    });

    it("audit_events rejects UPDATE and DELETE (append-only trigger)", async () => {
      const row = await admin.auditEvent.findFirst({
        where: { tenantId, action: AUDIT_ACTION_TOUR_CREATED },
      });
      assert.ok(row, "fixture must have at least one audit row");

      await assert.rejects(
        () =>
          admin.auditEvent.update({
            where: { id: row.id },
            data: { action: "TAMPERED" },
          }),
        assertAppendOnlyError
      );

      await assert.rejects(
        () => admin.auditEvent.delete({ where: { id: row.id } }),
        assertAppendOnlyError
      );
    });
  }
);

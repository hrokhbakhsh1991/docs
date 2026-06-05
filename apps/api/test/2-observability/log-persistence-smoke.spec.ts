/**
 * 2-observability — durable audit persistence smoke (100 POST /tours).
 *
 * Proves every successful create persists exactly one TOUR_CREATED row in
 * audit_events (same transaction as domain write), not as a best-effort side effect.
 *
 * Run (requires DATABASE_URL — Postgres with Phase 5 migrations applied):
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
 *     pnpm --filter @apps/api exec node --import tsx --test test/2-observability/log-persistence-smoke.spec.ts
 *
 * @see apps/api/test/1-integration/full-service-stack.spec.ts — 100-request HTTP pattern
 * @see apps/api/src/canonical/atomic-canonical-tour-persist.ts — appendAuditEvent in TX
 */
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
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { disconnectPrisma } from "../../src/db/prisma";
import { withTenantRls } from "../../src/db/with-tenant-rls";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const SKIP_MESSAGE =
  "log-persistence-smoke requires DATABASE_URL (e.g. postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db)";

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

const REQUEST_COUNT = 100;

/** Audit created_at must land near HTTP response completion (DB clock vs Node clock slack). */
const AUDIT_TIMESTAMP_TOLERANCE_MS = 30_000;

const ACTOR_ID = "log-persistence-smoke-actor";

function withConnectionLimit(url: string, limit = 32): string {
  if (/connection_limit=/i.test(url)) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}connection_limit=${limit}`;
}

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

function tourBody(index: number) {
  return {
    data: {
      basics: { title: `log-persistence-smoke-${index}` },
      details: { summary: `request-${index}` },
    },
  };
}

type CreateTourResponse = {
  readonly id?: string;
  readonly tenantId?: string;
  readonly error?: string;
};

type SuccessfulCreate = {
  readonly tourId: string;
  readonly responseCompletedAtMs: number;
};

function assertAuditTimestampNearResponse(
  auditCreatedAt: Date,
  responseCompletedAtMs: number,
  requestIndex: number
): void {
  const auditMs = auditCreatedAt.getTime();
  const delta = Math.abs(auditMs - responseCompletedAtMs);
  assert.ok(
    delta <= AUDIT_TIMESTAMP_TOLERANCE_MS,
    `request ${requestIndex + 1}: audit created_at must be within ${AUDIT_TIMESTAMP_TOLERANCE_MS}ms of response time (delta=${delta}ms)`
  );
}

describe(
  "2-observability — log persistence smoke (100 POST /tours → durable audit_events)",
  { skip: hasDatabase ? false : SKIP_MESSAGE, concurrency: false },
  () => {
    const runId = randomUUID().slice(0, 8);
    const tenantId = integrationTenantId();
    const createdTourIds: string[] = [];
    const successfulCreates: SuccessfulCreate[] = [];

    let admin: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    let server: http.Server;
    let port = 0;
    const priorStorageDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.DATABASE_URL = withConnectionLimit(
        process.env.DATABASE_URL?.trim() ?? APP_TOUR_URL
      );
      await disconnectPrisma();

      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `lps-${runId}`,
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
      server = http.createServer(listener);
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        throw new Error("log-persistence-smoke: no listen address");
      }
      port = addr.port;
    });

    after(async () => {
      server.close();
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
      await admin.$disconnect();
      await disconnectPrisma();
    });

    async function requestJson(options: {
      readonly method: "POST";
      readonly path: string;
      readonly body: unknown;
    }): Promise<{
      readonly status: number;
      readonly body: unknown;
      readonly completedAtMs: number;
    }> {
      return new Promise((resolve, reject) => {
        const payload = JSON.stringify(options.body);
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: options.path,
            method: options.method,
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
              const raw = Buffer.concat(chunks).toString("utf8");
              resolve({
                status: res.statusCode ?? 0,
                body: raw.length > 0 ? JSON.parse(raw) : null,
                completedAtMs: Date.now(),
              });
            });
          }
        );
        req.on("error", reject);
        req.write(payload);
        req.end();
      });
    }

    async function assertExactlyOneTourCreatedAudit(
      tourId: string,
      responseCompletedAtMs: number,
      requestIndex: number
    ): Promise<void> {
      const auditRows = await withTenantRls(tenantId, (tx) =>
        tx.auditEvent.findMany({
          where: {
            tenantId,
            entityId: tourId,
            entityType: "tour",
            action: AUDIT_ACTION_TOUR_CREATED,
          },
        })
      );

      assert.equal(
        auditRows.length,
        1,
        `request ${requestIndex + 1}: tour ${tourId} must have exactly one TOUR_CREATED audit row (observability is durable, not side-effect)`
      );

      const auditRow = auditRows[0]!;
      assert.equal(
        auditRow.tenantId,
        tenantId,
        `request ${requestIndex + 1}: audit tenant_id must match auth tenant`
      );
      assert.equal(auditRow.entityId, tourId);
      assert.equal(
        auditRow.entityType,
        "tour",
        "entity_type must be tour (appendAuditEvent contract)"
      );
      assert.equal(auditRow.action, AUDIT_ACTION_TOUR_CREATED);
      assert.equal(auditRow.actorId, pseudonymizeAuditActorId(ACTOR_ID, tenantId));
      assertAuditTimestampNearResponse(auditRow.createdAt, responseCompletedAtMs, requestIndex);
    }

    it(`${REQUEST_COUNT} sequential POST /tours return 201 with 1:1 TOUR_CREATED audit rows`, async () => {
      for (let i = 0; i < REQUEST_COUNT; i += 1) {
        const res = await requestJson({
          method: "POST",
          path: "/tours",
          body: tourBody(i),
        });

        if (res.status !== 201) {
          const errBody = res.body as CreateTourResponse;
          assert.fail(
            `POST /tours request ${i + 1}/${REQUEST_COUNT} failed: status=${res.status} body=${JSON.stringify(errBody)}`
          );
        }

        const body = res.body as CreateTourResponse;
        assert.ok(body.id && body.id.length > 0, `request ${i + 1} must include tour id`);
        assert.equal(body.tenantId, tenantId, `request ${i + 1} tenantId must match auth`);
        createdTourIds.push(body.id);

        await assertExactlyOneTourCreatedAudit(body.id, res.completedAtMs, i);
        successfulCreates.push({ tourId: body.id, responseCompletedAtMs: res.completedAtMs });
      }

      assert.equal(createdTourIds.length, REQUEST_COUNT);
      assert.equal(
        new Set(createdTourIds).size,
        REQUEST_COUNT,
        "each created tour id must be unique"
      );

      const [tourRows, auditRows] = await Promise.all([
        withTenantRls(tenantId, (tx) => tx.tour.findMany({ where: { tenantId } })),
        withTenantRls(tenantId, (tx) =>
          tx.auditEvent.findMany({
            where: { tenantId, action: AUDIT_ACTION_TOUR_CREATED },
          })
        ),
      ]);

      assert.equal(
        tourRows.length,
        REQUEST_COUNT,
        "no orphaned tours: every created tour must persist under tenant RLS"
      );
      assert.equal(
        auditRows.length,
        REQUEST_COUNT,
        "audit_events must contain exactly one TOUR_CREATED row per successful create"
      );

      const tourIds = new Set(tourRows.map((row) => row.id));
      const auditEntityIds = auditRows.map((row) => row.entityId);
      const entityIds = new Set(auditEntityIds);
      assert.equal(
        entityIds.size,
        REQUEST_COUNT,
        "no duplicate audits: TOUR_CREATED rows must map 1:1 to distinct tour entity ids"
      );

      for (const tourId of createdTourIds) {
        assert.ok(tourIds.has(tourId), `orphaned tour missing from RLS-visible tours: ${tourId}`);
        assert.ok(entityIds.has(tourId), `missing TOUR_CREATED audit for tour ${tourId}`);
      }

      for (const auditEntityId of auditEntityIds) {
        assert.ok(
          tourIds.has(auditEntityId),
          `orphaned audit: TOUR_CREATED row references tour ${auditEntityId} with no matching tour row`
        );
      }

      for (let i = 0; i < successfulCreates.length; i += 1) {
        const { tourId, responseCompletedAtMs } = successfulCreates[i]!;
        const row = auditRows.find((r) => r.entityId === tourId);
        assert.ok(row, `batch verify: audit row for tour ${tourId}`);
        assert.equal(row.tenantId, tenantId);
        assertAuditTimestampNearResponse(row.createdAt, responseCompletedAtMs, i);
      }
    });
  }
);

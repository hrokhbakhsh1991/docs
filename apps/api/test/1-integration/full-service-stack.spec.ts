/**
 * Full-stack smoke — HTTP → ToursService → repository → event bus/outbox.
 *
 * Runs 100 sequential POST /tours through a real Node HTTP listener.
 * Fails fast on the first non-2xx response or thrown error.
 *
 * Requires DATABASE_URL (Postgres + STORAGE_DRIVER=prisma). Example:
 *   DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db' \
 *     pnpm --filter @apps/api exec node --import tsx --test test/1-integration/full-service-stack.spec.ts
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { disconnectPrisma } from "../../src/db/prisma";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const SKIP_MESSAGE =
  "full-service-stack smoke requires DATABASE_URL (e.g. postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db)";

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

const REQUEST_COUNT = 100;

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
    "x-user-id": "full-stack-smoke-user",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-1",
  };
}

function tourBody(index: number) {
  return {
    data: {
      basics: { title: `full-stack-smoke-${index}` },
      details: { summary: `request-${index}` },
    },
  };
}

type CreateTourResponse = {
  readonly id?: string;
  readonly tenantId?: string;
  readonly error?: string;
};

describe(
  "1-integration — full service stack smoke (HTTP → service → repository → outbox)",
  { skip: hasDatabase ? false : SKIP_MESSAGE, concurrency: false },
  () => {
    const runId = randomUUID().slice(0, 8);
    const tenantId = integrationTenantId();
    const createdTourIds: string[] = [];

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
          subdomain: `fss-${runId}`,
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
        throw new Error("full-service-stack: no listen address");
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
      readonly method: "GET" | "POST";
      readonly path: string;
      readonly body?: unknown;
    }): Promise<{ readonly status: number; readonly body: unknown }> {
      return new Promise((resolve, reject) => {
        const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: options.path,
            method: options.method,
            headers: {
              "Content-Type": "application/json",
              ...(payload ? { "Content-Length": String(Buffer.byteLength(payload)) } : {}),
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
              });
            });
          }
        );
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
      });
    }

    it(`GET /health then ${REQUEST_COUNT} POST /tours succeed end-to-end`, async () => {
      const health = await requestJson({ method: "GET", path: "/health" });
      assert.equal(health.status, 200, "GET /health must return 200");
      assert.deepEqual(health.body, { status: "ok", service: "@apps/api" });

      for (let i = 0; i < REQUEST_COUNT; i += 1) {
        const res = await requestJson({
          method: "POST",
          path: "/tours",
          body: tourBody(i),
        });

        if (res.status < 200 || res.status >= 300) {
          const errBody = res.body as CreateTourResponse;
          assert.fail(
            `POST /tours request ${i + 1}/${REQUEST_COUNT} failed: status=${res.status} body=${JSON.stringify(errBody)}`
          );
        }

        const body = res.body as CreateTourResponse;
        assert.equal(res.status, 201, `request ${i + 1} must return 201 Created`);
        assert.ok(body.id && body.id.length > 0, `request ${i + 1} must include tour id`);
        assert.equal(body.tenantId, tenantId, `request ${i + 1} tenantId must match auth`);
        createdTourIds.push(body.id);

        const outboxRow = await admin.outboxEvent.findFirst({
          where: { tenantId, aggregateId: body.id, eventType: "TourCreated" },
        });
        assert.ok(
          outboxRow,
          `request ${i + 1} must enqueue TourCreated outbox row (repository → bus path)`
        );
        assert.equal(outboxRow.status, "pending");
      }

      assert.equal(
        createdTourIds.length,
        REQUEST_COUNT,
        "must collect one tour id per successful request"
      );
      assert.equal(
        new Set(createdTourIds).size,
        REQUEST_COUNT,
        "each created tour id must be unique"
      );

      const tourCount = await admin.tour.count({ where: { tenantId } });
      const outboxCount = await admin.outboxEvent.count({
        where: { tenantId, eventType: "TourCreated" },
      });
      assert.equal(tourCount, REQUEST_COUNT, "repository must persist every tour");
      assert.equal(outboxCount, REQUEST_COUNT, "outbox must record every TourCreated event");
    });
  }
);

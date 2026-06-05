import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import { withCanonicalTransaction } from "../src/db/with-canonical-transaction";
import { ValidationFailure } from "../src/canonical/validation-failure";
import { isPreTransactionValidationGateOpenForTests } from "../src/canonical/pre-transaction-validation";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import { createTourStorageRepository } from "../src/storage/create-tour-storage";
import { integrationTenantId } from "./test-helpers";
import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { ToursService } from "../src/tours/tours.service";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

/** Invalid starter canonical — basics.title required by plugin rules. */
const INVALID_TOUR_BODY = {
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: {
    basics: {},
    details: { summary: "ok" },
  },
};

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "user-1",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-1",
  };
}

async function postTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  body: unknown
): Promise<{ status: number; body: { error?: string; code?: string } }> {
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

describe("5.2 plugin validation (unit)", () => {
  it("withCanonicalTransaction rejects when pre-transaction validation gate is not set", async () => {
    await assert.rejects(
      () =>
        withCanonicalTransaction("tenant-a", async () => {
          return null;
        }),
      /CANONICAL_TX_VALIDATION_GATE_REQUIRED/
    );
  });
});

describe(
  "5.2 plugin validation — Postgres integrity (integration)",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = integrationTenantId();
    let admin: PrismaClient;
    let listener: ReturnType<typeof createRequestListener>;
    const priorStorageDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `p52-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });

      const store = new TourStorageDbAdapter(createTourStorageRepository());
      const toursService = new ToursService(
        new CanonicalTourService(store, new LegacyCanonicalAdapter())
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
      await admin.$disconnect();
    });

    it("throws ValidationFailure and leaves validation gate closed after failure", async () => {
      const service = new ToursService(
        new CanonicalTourService(
          new TourStorageDbAdapter(createTourStorageRepository()),
          new LegacyCanonicalAdapter()
        )
      );

      await assert.rejects(
        () =>
          service.createTour(
            {
              userId: "user-1",
              tenantId,
              role: "admin",
              status: "ACTIVE",
              workspaceId: "ws-1",
            },
            INVALID_TOUR_BODY
          ),
        (error: unknown) => {
          assert.ok(error instanceof ValidationFailure);
          assert.match(error.message, /CANONICAL_VALIDATION_FAILED/);
          return true;
        }
      );

      assert.equal(
        isPreTransactionValidationGateOpenForTests(tenantId),
        false,
        "gate must not remain open after failed validation"
      );
    });

    it("invalid POST /tours writes 0 tours and 0 outbox_events rows", async () => {
      const toursBefore = await admin.tour.count({ where: { tenantId } });
      const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });

      const res = await postTour(listener, tenantId, INVALID_TOUR_BODY);

      assert.equal(res.status, 400);
      assert.equal(res.body.code, "VALIDATION_FAILURE");
      assert.match(res.body.error ?? "", /CANONICAL_VALIDATION_FAILED/);

      const toursAfter = await admin.tour.count({ where: { tenantId } });
      const outboxAfter = await admin.outboxEvent.count({ where: { tenantId } });

      assert.equal(toursAfter, toursBefore, "validation failure must not insert tours");
      assert.equal(outboxAfter, outboxBefore, "validation failure must not insert outbox_events");
    });

    it("valid POST /tours persists tour and outbox via atomic path (5.3+5.4-S1)", async () => {
      const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });

      const res = await postTour(listener, tenantId, {
        data: { basics: { title: "P5.2 valid" }, details: { summary: "ok" } },
      });

      assert.equal(res.status, 201);
      const toursAfter = await admin.tour.count({ where: { tenantId } });
      assert.equal(toursAfter, 1);

      const outboxAfter = await admin.outboxEvent.count({ where: { tenantId } });
      assert.equal(outboxAfter, outboxBefore + 1, "valid write enqueues one outbox row atomically");
    });
  }
);

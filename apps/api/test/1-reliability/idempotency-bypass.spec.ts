/**
 * Reliability / security research — idempotency bypass under parallel burst.
 *
 * Sends identical POST /tours payloads with the same `Idempotency-Key` concurrently
 * and checks whether the service layer deduplicates or allows duplicate writes.
 *
 * HTTP `Idempotency-Key` on POST /tours — DEC-006 / http-idempotency.md.
 * Service-layer burst still has no dedup (storage invoked per call).
 */
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { createRequestListener } from "../../src/app";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { InMemoryTourRepository } from "../../src/storage/in-memory-tour.repository";
import type { Tour } from "../../src/storage/tour-storage.interface";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const BURST = Number.parseInt(process.env.IDEMPOTENCY_BYPASS_BURST ?? "40", 10);

const VALID_TOUR_BODY = {
  schemaVersion: 1,
  roots: ["basics", "details"],
  data: { basics: { title: "idempotency-bypass" }, details: { summary: "same payload" } },
} as const;

type CreateTourResponse = {
  readonly id?: string;
  readonly tenantId?: string;
  readonly error?: string;
};

class CreateCountingRepository extends InMemoryTourRepository {
  createTourCalls = 0;

  override async createTour(input: {
    tenantId: string;
    canonical: Tour["canonical"];
  }): Promise<Tour> {
    this.createTourCalls += 1;
    return super.createTour(input);
  }
}

function authForTenant(tenantId: string): TenantAuthContext {
  return {
    userId: "idem-bypass-user",
    tenantId,
    role: "admin",
    status: "ACTIVE",
    workspaceId: "ws-idem-bypass",
  };
}

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

async function postTourWithIdempotencyKey(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string,
  idempotencyKey: string,
  body: unknown
): Promise<{ status: number; body: CreateTourResponse }> {
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
            "Idempotency-Key": idempotencyKey,
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
              body: raw.length > 0 ? (JSON.parse(raw) as CreateTourResponse) : {},
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

function uniqueTourIds(records: readonly CreateTourResponse[]): Set<string> {
  const ids = new Set<string>();
  for (const record of records) {
    if (typeof record.id === "string" && record.id.length > 0) {
      ids.add(record.id);
    }
  }
  return ids;
}

describe("1-reliability — idempotency bypass (security research)", () => {
  describe("service layer — memory driver", () => {
    const priorDatabaseUrl = process.env.DATABASE_URL;

    before(() => {
      process.env.STORAGE_DRIVER = "memory";
      delete process.env.DATABASE_URL;
    });

    after(() => {
      if (priorDatabaseUrl !== undefined) {
        process.env.DATABASE_URL = priorDatabaseUrl;
      }
    });

    it("AUDIT: parallel identical createTour burst writes once per request (no service dedup)", async () => {
      const tenantId = integrationTenantId();
      const store = new CreateCountingRepository();
      const service = new ToursService(
        new CanonicalTourService(new TourStorageDbAdapter(store), new LegacyCanonicalAdapter()),
        { resolveWorkspaceType: async () => "starter" }
      );
      const auth = authForTenant(tenantId);

      const results = await Promise.all(
        Array.from({ length: BURST }, () => service.createTour(auth, { ...VALID_TOUR_BODY }))
      );

      const tourIds = new Set(results.map((record) => record.id));
      assert.equal(results.length, BURST);
      assert.equal(store.createTourCalls, BURST, "storage createTour invoked once per burst slot");
      assert.equal(
        tourIds.size,
        BURST,
        "each parallel call minted a distinct tour id — idempotency not enforced at service layer"
      );
      assert.ok(
        results.every((record) => record.tenantId === tenantId),
        "all records belong to the burst tenant"
      );
    });
  });

  describe(
    "HTTP POST /tours — Postgres integration",
    { skip: !hasDatabase, concurrency: false },
    () => {
      const tenantId = integrationTenantId();
      const idempotencyKey = randomUUID();
      let admin: PrismaClient;
      let listener: ReturnType<typeof createRequestListener>;
      const priorStorageDriver = process.env.STORAGE_DRIVER;
      const priorMaxTourWrites = process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;

      before(async () => {
        process.env.STORAGE_DRIVER = "prisma";
        process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = String(BURST);
        admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
        await admin.tenant.create({
          data: {
            id: tenantId,
            subdomain: `idem-bypass-${tenantId.slice(0, 8)}`,
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
        if (priorMaxTourWrites === undefined) {
          delete process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES;
        } else {
          process.env.TENANT_MAX_CONCURRENT_TOUR_WRITES = priorMaxTourWrites;
        }
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
        );
        try {
          await admin.auditEvent.deleteMany({ where: { tenantId } });
          await admin.outboxEvent.deleteMany({ where: { tenantId } });
          await admin.httpIdempotencyRecord.deleteMany({ where: { tenantId } });
          await admin.tour.deleteMany({ where: { tenantId } });
          await admin.tenant.delete({ where: { id: tenantId } });
        } finally {
          await admin.$executeRawUnsafe(
            `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
          );
        }
        await admin.$disconnect();
      });

      it("parallel burst with same Idempotency-Key dedupes to one tour (HTTP DEC-006)", async () => {
        const toursBefore = await admin.tour.count({ where: { tenantId } });
        const outboxBefore = await admin.outboxEvent.count({ where: { tenantId } });

        const responses = await Promise.all(
          Array.from({ length: BURST }, () =>
            postTourWithIdempotencyKey(listener, tenantId, idempotencyKey, {
              ...VALID_TOUR_BODY,
            })
          )
        );

        const successes = responses.filter((res) => res.status === 201);
        const bodies = successes.map((res) => res.body);
        const ids = uniqueTourIds(bodies);

        assert.equal(
          successes.length,
          BURST,
          `expected all ${BURST} parallel requests to succeed; got statuses: ${responses.map((r) => r.status).join(",")}`
        );

        const toursAfter = await admin.tour.count({ where: { tenantId } });
        const outboxAfter = await admin.outboxEvent.count({ where: { tenantId } });

        assert.equal(
          toursAfter - toursBefore,
          1,
          "Idempotency-Key must persist exactly one tour row under parallel burst"
        );
        assert.equal(outboxAfter - outboxBefore, 1, "exactly one outbox row for idempotent create");
        assert.equal(ids.size, 1, "all responses must carry the same tour id");

        const firstId = bodies[0]?.id;
        assert.ok(firstId, "first response must include tour id");
        assert.ok(
          bodies.every((body) => body.id === firstId),
          "stable replay response for every parallel caller"
        );
      });
    }
  );
});

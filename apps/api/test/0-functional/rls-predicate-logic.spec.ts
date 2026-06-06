import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { disconnectPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { withTenantRls } from "../../src/db/with-tenant-rls";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { PrismaTourRepository } from "../../src/storage/prisma-tour.repository";
import { ToursService } from "../../src/tours/tours.service";
import { integrationTenantId } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const skipReason = hasDatabase
  ? false
  : "DATABASE_URL required for RLS predicate functional test (Postgres + app_tour role)";

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

const CANONICAL_A = {
  schemaVersion: 1,
  roots: ["basics"],
  data: { basics: { title: "tenant-a-marker" }, details: { summary: "rls-a" } },
} as const;

const CANONICAL_B = {
  schemaVersion: 1,
  roots: ["basics"],
  data: { basics: { title: "tenant-b-marker" }, details: { summary: "rls-b" } },
} as const;

function memberHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "rls-predicate-user",
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-rls-predicate",
  };
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  options: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  }
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path: options.path,
          method: options.method,
          headers: {
            "Content-Type": "application/json",
            ...(payload ? { "Content-Length": String(Buffer.byteLength(payload)) } : {}),
            ...options.headers,
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
              body: raw.length > 0 ? JSON.parse(raw) : null,
            });
          });
        }
      );
      req.on("error", (err) => {
        server.close();
        reject(err);
      });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

function canonicalTitle(canonical: unknown): string | undefined {
  if (
    typeof canonical === "object" &&
    canonical !== null &&
    "data" in canonical &&
    typeof (canonical as { data?: unknown }).data === "object" &&
    (canonical as { data: { basics?: { title?: string } } }).data?.basics?.title !== undefined
  ) {
    return (canonical as { data: { basics: { title: string } } }).data.basics.title;
  }
  return undefined;
}

/**
 * RLS predicate + application tenant mapping — functional verification.
 * Postgres session `app.current_tenant_id` filters rows; app layer rejects cross-tenant claims.
 *
 * Prerequisite: infra/sql/001_tenant_rls.sql + phase-5 migrations on DATABASE_URL host.
 */
describe("RLS predicate logic (0-functional)", { skip: skipReason, concurrency: false }, () => {
  const tenantA = integrationTenantId();
  const tenantB = integrationTenantId();
  const tourAId = randomUUID();
  const tourBId = randomUUID();

  let admin: PrismaClient;
  let repo: PrismaTourRepository;
  let listener: ReturnType<typeof createRequestListener>;
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  before(async () => {
    process.env.STORAGE_DRIVER = "prisma";
    process.env.DATABASE_URL = APP_TOUR_URL;
    await disconnectPrisma();

    admin = getPrismaAdmin();
    repo = new PrismaTourRepository();

    for (const [tenantId, label] of [
      [tenantA, "a"],
      [tenantB, "b"],
    ] as const) {
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `rls-pred-${label}-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });
    }

    await admin.tour.create({
      data: {
        id: tourAId,
        tenantId: tenantA,
        title: CANONICAL_A.data.basics.title,
        canonical: CANONICAL_A,
      },
    });
    await admin.tour.create({
      data: {
        id: tourBId,
        tenantId: tenantB,
        title: CANONICAL_B.data.basics.title,
        canonical: CANONICAL_B,
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
    await admin.tour.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    await disconnectPrisma();
  });

  it("RLS-PRED-01: session A count(*) sees only tenant A rows", async () => {
    const countA = await withTenantRls(tenantA, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*)::bigint AS count FROM tours
        `;
      return Number(rows[0]?.count ?? -1);
    });

    assert.equal(countA, 1, "tenant A session must see exactly one tour row");

    const countBFromA = await withTenantRls(tenantA, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
          SELECT count(*)::bigint AS count FROM tours WHERE tenant_id = ${tenantB}::uuid
        `;
      return Number(rows[0]?.count ?? -1);
    });

    assert.equal(countBFromA, 0, "tenant A session must not count tenant B rows");
  });

  it("RLS-PRED-02: Postgres WITH CHECK blocks tenant_id reassignment under session A", async () => {
    let rowsUpdated = -1;
    let policyRejected = false;

    try {
      rowsUpdated = await withTenantRls(tenantA, async (tx) => {
        const result = await tx.tour.updateMany({
          where: { id: tourAId },
          data: {
            tenantId: tenantB,
            canonical: CANONICAL_B,
            title: CANONICAL_B.data.basics.title,
          },
        });
        return result.count;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/42501|policy|row-level security|permission denied/i.test(message)) {
        policyRejected = true;
      } else {
        throw error;
      }
    }

    assert.ok(
      policyRejected || rowsUpdated === 0,
      `tenant_id hijack must fail closed (policy reject or 0 rows); got count=${rowsUpdated}`
    );

    const tourA = await admin.tour.findUnique({ where: { id: tourAId } });
    const tourB = await admin.tour.findUnique({ where: { id: tourBId } });

    assert.equal(tourA?.tenantId, tenantA, "tenant A row must retain tenant_id");
    assert.equal(canonicalTitle(tourA?.canonical), CANONICAL_A.data.basics.title);
    assert.equal(tourB?.tenantId, tenantB, "tenant B row must be unchanged");
    assert.equal(canonicalTitle(tourB?.canonical), CANONICAL_B.data.basics.title);
  });

  it("RLS-PRED-03: PrismaTourRepository rejects save with cross-tenant claim on existing id", async () => {
    const existing = await repo.getById(tourAId, tenantA);
    assert.ok(existing, "seed tour A must exist");

    await assert.rejects(
      () =>
        repo.save({
          ...existing,
          tenantId: tenantB,
          canonical: CANONICAL_B,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, "FORBIDDEN_TOUR_STORAGE_CROSS_TENANT");
        return true;
      }
    );

    const tourA = await admin.tour.findUnique({ where: { id: tourAId } });
    const tourB = await admin.tour.findUnique({ where: { id: tourBId } });

    assert.equal(tourA?.tenantId, tenantA);
    assert.equal(canonicalTitle(tourA?.canonical), CANONICAL_A.data.basics.title);
    assert.equal(tourB?.tenantId, tenantB);
    assert.equal(canonicalTitle(tourB?.canonical), CANONICAL_B.data.basics.title);
  });

  it("RLS-PRED-04: HTTP create with body tenantId B under session A → 403 claim mismatch", async () => {
    const res = await requestJson(listener, {
      method: "POST",
      path: "/tours",
      headers: memberHeaders(tenantA),
      body: {
        tenantId: tenantB,
        data: CANONICAL_B.data,
      },
    });

    assert.equal(res.status, 403);
    assert.match((res.body as { error?: string }).error ?? "", /FORBIDDEN_TENANT_CLAIM_MISMATCH/);

    const tourA = await admin.tour.findUnique({ where: { id: tourAId } });
    const tourB = await admin.tour.findUnique({ where: { id: tourBId } });

    assert.equal(tourA?.tenantId, tenantA);
    assert.equal(tourB?.tenantId, tenantB);
  });
});

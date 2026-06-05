import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { Prisma, PrismaClient } from "@prisma/client";

import { createRequestListener } from "../src/app";
import { AUDIT_ACTION_TOUR_CREATED } from "../src/audit/audit-logger";
import { pseudonymizeAuditActorId } from "../src/audit/audit-pseudonym";
import { CanonicalTourService } from "../src/canonical/canonical-tour.service";
import { LegacyCanonicalAdapter } from "../src/canonical/legacy-canonical-adapter";
import { TourStorageDbAdapter } from "../src/db/tour-storage.adapter";
import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { createTourStorageRepository } from "../src/storage/create-tour-storage";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";
import { ToursService } from "../src/tours/tours.service";
import { integrationTenantId } from "./test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL_APP_TOUR?.trim() ??
  process.env.DATABASE_URL?.trim() ??
  "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

const VALID_TOUR_BODY = {
  data: { basics: { title: "P5.5 audit trail" }, details: { summary: "ok" } },
};

function authHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "audit-user-1",
    "x-actor-role": "admin",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-1",
  };
}

async function postTour(
  listener: ReturnType<typeof createRequestListener>,
  tenantId: string
): Promise<{ status: number; body: { id?: string } }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = JSON.stringify(VALID_TOUR_BODY);
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

/**
 * P5-5 — audit_events append on tour create; tenant RLS isolation.
 */
describe("5.5 audit events (integration)", { skip: !hasDatabase, concurrency: false }, () => {
  const tenantA = integrationTenantId();
  const tenantB = integrationTenantId();
  let admin: PrismaClient;
  let appRole: PrismaClient;
  let listener: ReturnType<typeof createRequestListener>;
  const priorStorageDriver = process.env.STORAGE_DRIVER;

  before(async () => {
    process.env.STORAGE_DRIVER = "prisma";
    admin = getPrismaAdmin();
    appRole = new PrismaClient({ datasources: { db: { url: APP_TOUR_URL } } });

    for (const [tenantId, label] of [
      [tenantA, "a"],
      [tenantB, "b"],
    ] as const) {
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `p55-${label}-${tenantId.slice(0, 8)}`,
          workspaceType: "starter",
          theme: {},
        },
      });
    }

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
    await admin.$executeRawUnsafe(
      `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
    );
    try {
      for (const tenantId of [tenantA, tenantB]) {
        await admin.auditEvent.deleteMany({ where: { tenantId } });
        await admin.outboxEvent.deleteMany({ where: { tenantId } });
        await admin.tour.deleteMany({ where: { tenantId } });
        await admin.tenant.delete({ where: { id: tenantId } });
      }
    } finally {
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
      );
    }
    await disconnectPrisma();
    await appRole.$disconnect();
  });

  it("valid tour creation writes TOUR_CREATED audit row in same tenant", async () => {
    const auditBefore = await admin.auditEvent.count({ where: { tenantId: tenantA } });

    const res = await postTour(listener, tenantA);
    assert.equal(res.status, 201);
    assert.ok(res.body.id);

    const audits = await admin.auditEvent.findMany({
      where: { tenantId: tenantA },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(audits.length, auditBefore + 1);

    const row = audits[0];
    assert.equal(row?.action, AUDIT_ACTION_TOUR_CREATED);
    assert.equal(row?.entityType, "tour");
    assert.equal(row?.entityId, res.body.id);
    assert.equal(row?.actorId, pseudonymizeAuditActorId("audit-user-1", tenantA));
    const metadata = row?.metadata as { workspaceType?: string };
    assert.equal(metadata.workspaceType, "starter");
  });

  it("appendAuditEvent without ALS tenant context fails closed", async () => {
    const { appendAuditEvent } = await import("../src/audit/audit-logger");
    const { getPrisma } = await import("../src/db/prisma");

    await assert.rejects(
      () =>
        getPrisma().$transaction((tx) =>
          appendAuditEvent(tx, {
            action: AUDIT_ACTION_TOUR_CREATED,
            entityType: "tour",
            entityId: randomUUID(),
          })
        ),
      /TENANT_CONTEXT_NOT_BOUND/
    );
  });

  it("tenant B cannot read tenant A audit_events (RLS)", async () => {
    const seeded = await admin.auditEvent.findMany({ where: { tenantId: tenantA } });
    assert.ok(seeded.length > 0, "tenant A must have audit rows from prior test");

    const foreignRows = await appRole.$transaction(async (tx) => {
      await tx.$executeRaw`
          SELECT set_config('app.current_tenant_id', ${tenantB}::text, true)
        `;
      return tx.auditEvent.findMany({ where: { tenantId: tenantA } });
    });
    assert.equal(foreignRows.length, 0, "tenant B session must not see tenant A audit logs");

    const ownRows = await appRole.$transaction(async (tx) => {
      await tx.$executeRaw`
          SELECT set_config('app.current_tenant_id', ${tenantB}::text, true)
        `;
      return tx.auditEvent.findMany();
    });
    assert.equal(ownRows.length, 0, "tenant B has no audit rows in this fixture");
  });

  it("audit_events rows are immutable at database level", async () => {
    const row = await admin.auditEvent.findFirst({ where: { tenantId: tenantA } });
    assert.ok(row);

    await assert.rejects(
      () =>
        admin.auditEvent.update({
          where: { id: row.id },
          data: { action: "TAMPERED" },
        }),
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        return /append-only/i.test(message);
      }
    );
  });

  it("atomic TX rollback omits audit when tour write aborts before audit", async () => {
    const priorAbort = process.env.P5_ATOMIC_TX_TEST_ABORT;
    process.env.P5_ATOMIC_TX_TEST_ABORT = "before_outbox";

    const auditBefore = await admin.auditEvent.count({ where: { tenantId: tenantB } });

    await assert.rejects(
      () =>
        runWithTenantContext(
          tenantB,
          async () => {
            const service = new ToursService(
              new CanonicalTourService(
                new TourStorageDbAdapter(createTourStorageRepository()),
                new LegacyCanonicalAdapter()
              )
            );
            return service.createTour(
              {
                userId: "audit-user-1",
                tenantId: tenantB,
                role: "admin",
                status: "ACTIVE",
                workspaceId: "ws-1",
              },
              VALID_TOUR_BODY
            );
          },
          { actorId: "audit-user-1", workspaceType: "starter" }
        ),
      /P5_ATOMIC_TX_TEST_ABORT/
    );

    const toursAfter = await admin.tour.count({ where: { tenantId: tenantB } });
    const auditAfter = await admin.auditEvent.count({ where: { tenantId: tenantB } });
    assert.equal(toursAfter, 0, "aborted TX must not commit tour");
    assert.equal(auditAfter, auditBefore, "aborted TX must not commit audit row");

    process.env.P5_ATOMIC_TX_TEST_ABORT = priorAbort;
  });
});

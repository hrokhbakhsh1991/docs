import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, describe, it } from "node:test";

import { PrismaClient } from "@prisma/client";

import { createRequestListener } from "../../src/app";
import { AUDIT_ACTION_TOUR_CREATED, appendAuditEvent } from "../../src/audit/audit-logger";
import { CanonicalTourService } from "../../src/canonical/canonical-tour.service";
import { persistNewTourAtomically } from "../../src/canonical/atomic-canonical-tour-persist";
import { LegacyCanonicalAdapter } from "../../src/canonical/legacy-canonical-adapter";
import { createApiAbility } from "../../src/casl/api-ability";
import { TourStorageDbAdapter } from "../../src/db/tour-storage.adapter";
import { disconnectPrisma, getPrisma, getPrismaAdmin } from "../../src/db/prisma";
import { withTenantRls } from "../../src/db/with-tenant-rls";
import { UNAUTHORIZED_MISSING_WORKSPACE_ID } from "../../src/tenant-kernel/auth-errors";
import { createTourStorageRepository } from "../../src/storage/create-tour-storage";
import { PrismaTourRepository } from "../../src/storage/prisma-tour.repository";
import { runWithTenantContext } from "../../src/tenant/tenant-request-context";
import { ToursService } from "../../src/tours/tours.service";
import { createTestToursService, integrationTenantId, preparePostgresHttpIntegration } from "../test-helpers";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

const ADMIN_URL =
  process.env.DATABASE_URL_ADMIN?.trim() ?? "postgresql://postgres:postgres@127.0.0.1:5434/tour_db";

const APP_TOUR_URL =
  process.env.DATABASE_URL?.trim() ?? "postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db";

const VALID_CANONICAL = {
  schemaVersion: 1,
  roots: ["basics"],
  data: { basics: { title: "Pentest tour" }, details: { summary: "" } },
} as const;

const VALID_TOUR_BODY = {
  data: { basics: { title: "Pentest HTTP" }, details: { summary: "" } },
};

type JsonResponse = {
  readonly status: number;
  readonly body: unknown;
};

function memberHeaders(input: {
  readonly tenantId?: string;
  readonly authenticatedTenantId?: string;
  readonly withWorkspace?: boolean;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "x-user-id": "pentest-user",
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
  };
  if (input.tenantId !== undefined) headers["x-tenant-id"] = input.tenantId;
  if (input.authenticatedTenantId !== undefined) {
    headers["x-authenticated-tenant-id"] = input.authenticatedTenantId;
  }
  if (input.withWorkspace !== false) {
    headers["x-workspace-id"] = "ws-pentest";
  }
  return headers;
}

async function requestJson(
  listener: ReturnType<typeof createRequestListener>,
  options: {
    readonly method: string;
    readonly path: string;
    readonly headers?: Record<string, string>;
    readonly body?: unknown;
  }
): Promise<JsonResponse> {
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

/**
 * Penetration scenarios — tenant header forgery, ALS/RLS bypass, pool pollution.
 * HTTP cases use in-memory storage; Postgres cases require DATABASE_URL (5434).
 */
describe("tenant injection pentest (0-security)", () => {
  describe("1 — HTTP header forgery (memory driver)", () => {
    let listener: ReturnType<typeof createRequestListener>;
    const priorStorageDriver = process.env.STORAGE_DRIVER;

    before(() => {
      process.env.STORAGE_DRIVER = "memory";
      listener = createRequestListener({
        toursService: createTestToursService(),
      });
    });

    afterEach(() => {
      process.env.STORAGE_DRIVER = priorStorageDriver ?? "memory";
    });

    it("PENTEST-1a PASS [LOW]: x-tenant-id ≠ x-authenticated-tenant-id → 403 FORBIDDEN_TENANT_CLAIM_MISMATCH", async () => {
      const res = await requestJson(listener, {
        method: "POST",
        path: "/tours",
        headers: memberHeaders({
          authenticatedTenantId: "tenant-a",
          tenantId: "tenant-b",
        }),
        body: VALID_TOUR_BODY,
      });
      assert.equal(res.status, 403);
      assert.match((res.body as { error?: string }).error ?? "", /FORBIDDEN_TENANT_CLAIM_MISMATCH/);
    });

    it("PENTEST-1b PASS [LOW]: body tenantId ≠ auth tenant → 403 FORBIDDEN_TENANT_CLAIM_MISMATCH", async () => {
      const res = await requestJson(listener, {
        method: "POST",
        path: "/tours",
        headers: memberHeaders({ authenticatedTenantId: "tenant-a", tenantId: "tenant-a" }),
        body: { tenantId: "tenant-b", ...VALID_TOUR_BODY },
      });
      assert.equal(res.status, 403);
      assert.match((res.body as { error?: string }).error ?? "", /FORBIDDEN_TENANT_CLAIM_MISMATCH/);
    });

    it("PENTEST-1c PASS [LOW]: missing x-authenticated-tenant-id → 401 UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT", async () => {
      const res = await requestJson(listener, {
        method: "POST",
        path: "/tours",
        headers: memberHeaders({ tenantId: "tenant-a" }),
        body: VALID_TOUR_BODY,
      });
      assert.equal(res.status, 401);
      assert.match(
        (res.body as { error?: string }).error ?? "",
        /UNAUTHORIZED_MISSING_AUTHENTICATED_TENANT/
      );
    });

    it("PENTEST-1d PASS [LOW]: missing x-workspace-id → 401 UNAUTHORIZED_MISSING_WORKSPACE_ID", async () => {
      const res = await requestJson(listener, {
        method: "POST",
        path: "/tours",
        headers: memberHeaders({
          authenticatedTenantId: "tenant-a",
          tenantId: "tenant-a",
          withWorkspace: false,
        }),
        body: VALID_TOUR_BODY,
      });
      assert.equal(res.status, 401);
      assert.equal((res.body as { error?: string }).error, UNAUTHORIZED_MISSING_WORKSPACE_ID);
    });
  });

  describe("2-5 — ALS / RLS / pool (Postgres integration)", () => {
    const tenantA = integrationTenantId();
    const tenantB = integrationTenantId();
    let admin: PrismaClient;
    let appRole: PrismaClient;
    let tourAId: string;
    let listener: ReturnType<typeof createRequestListener>;
    const priorStorageDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      if (!hasDatabase) return;
      await preparePostgresHttpIntegration();
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
            subdomain: `pentest-${label}-${tenantId.slice(0, 8)}`,
            workspaceType: "starter",
            theme: {},
          },
        });
      }

      const repo = new PrismaTourRepository();
      const seededA = await repo.createTour({ tenantId: tenantA, canonical: VALID_CANONICAL });
      tourAId = seededA.id;
      await repo.createTour({
        tenantId: tenantB,
        canonical: {
          ...VALID_CANONICAL,
          data: { basics: { title: "Tenant B seed" }, details: { summary: "" } },
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
      if (!hasDatabase) return;
      process.env.STORAGE_DRIVER = priorStorageDriver;
      await admin.$executeRawUnsafe(
        `ALTER TABLE audit_events DISABLE TRIGGER audit_events_append_only`
      );
      try {
        await admin.auditEvent.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.outboxEvent.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.tour.deleteMany({
          where: { tenantId: { in: [tenantA, tenantB] } },
        });
        await admin.tenant.deleteMany({
          where: { id: { in: [tenantA, tenantB] } },
        });
      } finally {
        await admin.$executeRawUnsafe(
          `ALTER TABLE audit_events ENABLE TRIGGER audit_events_append_only`
        );
      }
      await disconnectPrisma();
      await appRole.$disconnect();
    });

    it("PENTEST-2a PASS [MEDIUM]: appendAuditEvent without ALS → TENANT_CONTEXT_NOT_BOUND", async () => {
      if (!hasDatabase) return;
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

    it("PENTEST-2b PASS [MEDIUM]: persistNewTourAtomically without validation gate → CANONICAL_TX_VALIDATION_GATE_REQUIRED", async () => {
      if (!hasDatabase) return;
      await assert.rejects(
        () =>
          persistNewTourAtomically({
            tenantId: tenantA,
            canonical: VALID_CANONICAL,
          }),
        /CANONICAL_TX_VALIDATION_GATE_REQUIRED/
      );
    });

    it("PENTEST-2c PASS [INFO]: CanonicalTourService.writeTour self-binds ALS (not a bypass vector at HTTP boundary)", async () => {
      if (!hasDatabase) return;
      const canonical = new CanonicalTourService(
        new TourStorageDbAdapter(createTourStorageRepository()),
        new LegacyCanonicalAdapter()
      );
      const ability = createApiAbility({
        userId: "svc-user",
        tenantId: tenantA,
        role: "admin",
        status: "ACTIVE",
        workspaceId: "ws-1",
      });

      const record = await canonical.writeTour({
        ability,
        tenantId: tenantA,
        body: VALID_TOUR_BODY,
        workspaceType: "starter",
        actorId: "svc-user",
      });
      assert.equal(record.tenantId, tenantA);
    });

    it("PENTEST-3a PASS [HIGH]: ALS tenant A + withTenantRls(B) cannot read tenant A rows", async () => {
      if (!hasDatabase) return;
      await runWithTenantContext(tenantA, async () => {
        await assert.rejects(
          () =>
            withTenantRls(tenantB, async (tx) =>
              tx.tour.findMany({ where: { tenantId: tenantA } })
            ),
          /TENANT_RLS_ALS_TENANT_MISMATCH/,
          "forged RLS session must fail closed before query (DEC-028)"
        );

        await assert.rejects(
          () =>
            withTenantRls(tenantB, async (tx) =>
              tx.tour.findUnique({
                where: { tenantId_id: { tenantId: tenantA, id: tourAId } },
              })
            ),
          /TENANT_RLS_ALS_TENANT_MISMATCH/,
          "compound key lookup under mismatched ALS must not run"
        );
      });
    });

    it("PENTEST-3b PASS [HIGH]: persistNewTourAtomically ALS/RHS mismatch → ATOMIC_PERSIST_TENANT_CONTEXT_MISMATCH", async () => {
      if (!hasDatabase) return;
      await runWithTenantContext(tenantA, async () => {
        await assert.rejects(
          () =>
            persistNewTourAtomically({
              tenantId: tenantB,
              canonical: VALID_CANONICAL,
            }),
          /ATOMIC_PERSIST_TENANT_CONTEXT_MISMATCH/
        );
      });
    });

    it("PENTEST-3c PASS [HIGH]: HTTP prisma path cross-tenant GET → 404 (RLS-scoped)", async () => {
      if (!hasDatabase) return;
      const res = await requestJson(listener, {
        method: "GET",
        path: `/tours/${tourAId}`,
        headers: memberHeaders({ authenticatedTenantId: tenantB, tenantId: tenantB }),
      });
      assert.equal(res.status, 404);
      assert.match((res.body as { error?: string }).error ?? "", /not_found|TOUR_NOT_FOUND/);
    });

    it("PENTEST-4a PASS [MEDIUM]: withTenantRls('') → TENANT_RLS_TENANT_ID_REQUIRED", async () => {
      if (!hasDatabase) return;
      await assert.rejects(
        () => withTenantRls("", async () => null),
        /TENANT_RLS_TENANT_ID_REQUIRED/
      );
    });

    it("PENTEST-4b PASS [MEDIUM]: withTenantRls('   ') → TENANT_RLS_TENANT_ID_REQUIRED", async () => {
      if (!hasDatabase) return;
      await assert.rejects(
        () => withTenantRls("   ", async () => null),
        /TENANT_RLS_TENANT_ID_REQUIRED/
      );
    });

    it("PENTEST-4c PASS [MEDIUM]: runWithTenantContext('') → TENANT_CONTEXT_TENANT_ID_REQUIRED", async () => {
      if (!hasDatabase) return;
      assert.throws(() => {
        void runWithTenantContext("", async () => null);
      }, /TENANT_CONTEXT_TENANT_ID_REQUIRED/);
    });

    it("PENTEST-4d PASS [LOW]: malformed tenant string fails closed (Postgres 22P02 on query)", async () => {
      if (!hasDatabase) return;
      const malformed = "not-a-valid-uuid";
      await assert.rejects(
        () => withTenantRls(malformed, async (tx) => tx.tour.findMany()),
        (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          return /22P02|invalid input syntax for type uuid/i.test(message);
        }
      );
    });

    it("PENTEST-5a PASS [CRITICAL if fail]: sequential TX — app.current_tenant_id not leaked to next borrower", async () => {
      if (!hasDatabase) return;
      const prisma = getPrisma();

      await withTenantRls(tenantA, async (tx) => {
        const during = await tx.$queryRaw<Array<{ setting: string | null }>>`
          SELECT current_setting('app.current_tenant_id', true) AS setting
        `;
        assert.equal(during[0]?.setting, tenantA);
      });

      const afterFirst = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ setting: string | null }>>`
          SELECT current_setting('app.current_tenant_id', true) AS setting
        `;
        return rows[0]?.setting ?? null;
      });
      assert.ok(
        afterFirst === null || afterFirst === "",
        `pool must not retain tenant A setting (got ${afterFirst})`
      );

      await withTenantRls(tenantB, async (tx) => {
        const duringB = await tx.$queryRaw<Array<{ setting: string | null }>>`
          SELECT current_setting('app.current_tenant_id', true) AS setting
        `;
        assert.equal(duringB[0]?.setting, tenantB);

        const leakA = await tx.tour.findUnique({
          where: { tenantId_id: { tenantId: tenantA, id: tourAId } },
        });
        assert.equal(leakA, null, "tenant B session must not read tenant A tour after prior TX");
      });
    });

    it("PENTEST-5b PASS [CRITICAL if fail]: app_tour role without set_config sees 0 RLS rows", async () => {
      if (!hasDatabase) return;
      const [tours, audits] = await appRole.$transaction(async (tx) => {
        const t = await tx.tour.findMany({ where: { id: tourAId } });
        const a = await tx.auditEvent.findMany({ where: { tenantId: tenantA } });
        return [t, a] as const;
      });
      assert.equal(tours.length, 0);
      assert.equal(audits.length, 0);
    });
  });
});

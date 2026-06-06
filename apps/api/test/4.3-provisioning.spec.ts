import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { ProvisioningDevOnlyError } from "../src/internal/provisioning-guard";
import {
  PHASE_43_SEED_SUBDOMAINS,
  ProvisioningService,
  TENANT_STATUS_ACTIVE,
} from "../src/internal/provisioning.service";
import { runWithTenantContext } from "../src/tenant/tenant-request-context";
import { PrismaTourRepository } from "../src/storage/prisma-tour.repository";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/**
 * MAP 4.3 / P4-E-TENANT-01 — db:seed tenants; cross-tenant reads via
 * {@link withTenantRls} + ALS-bound {@link PrismaTourRepository#getByIdForActiveContext}.
 */
describe("4.3 provisioning (integration)", { skip: !hasDatabase, concurrency: false }, () => {
  const repo = new PrismaTourRepository();
  let tenantAId: string;
  let tenantBId: string;
  let tourAId: string;
  let tourBId: string;

  const envSnapshot = { NODE_ENV: process.env.NODE_ENV };

  before(async () => {
    process.env.NODE_ENV = "development";
    const seeded = await new ProvisioningService().seedDevTenants();
    const tenantA = seeded.find((t) => t.subdomain === "tenant-a")!;
    const tenantB = seeded.find((t) => t.subdomain === "tenant-b")!;
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;
    assert.equal(tenantA.status, TENANT_STATUS_ACTIVE);
    assert.equal(tenantB.status, TENANT_STATUS_ACTIVE);

    const tourA = await repo.createTour({
      tenantId: tenantAId,
      canonical: {
        schemaVersion: 1,
        roots: ["basics"],
        data: { basics: { title: "tenant-a-seed-tour" } },
      },
    });
    tourAId = tourA.id;

    const tourB = await repo.createTour({
      tenantId: tenantBId,
      canonical: {
        schemaVersion: 1,
        roots: ["basics"],
        data: { basics: { title: "tenant-b-seed-tour" } },
      },
    });
    tourBId = tourB.id;
  });

  after(async () => {
    process.env.NODE_ENV = envSnapshot.NODE_ENV;
    const admin = getPrismaAdmin();
    for (const tenantId of [tenantAId, tenantBId]) {
      await withTenantRls(tenantId, async (tx) => {
        await tx.tour.deleteMany({ where: { tenantId } });
      });
    }
    await admin.tenant.deleteMany({
      where: { subdomain: { in: [...PHASE_43_SEED_SUBDOMAINS] } },
    });
    await disconnectPrisma();
  });

  it("rejects seedDevTenants in production", async () => {
    const prior = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    await assert.rejects(
      () => new ProvisioningService().seedDevTenants(),
      (error: unknown) => error instanceof ProvisioningDevOnlyError
    );
    process.env.NODE_ENV = prior;
  });

  it("POST /internal/tenants/provision returns 403 in production", async () => {
    const prior = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const listener = createRequestListener({
      toursService: {} as never,
      provisioningService: new ProvisioningService(),
    });
    const status = await postProvision(listener, {
      tenantId: randomUUID(),
      subdomain: `provision-prod-${randomUUID().slice(0, 8)}`,
    });
    assert.equal(status, 403);
    process.env.NODE_ENV = prior;
  });

  it("POST /internal/tenants/provision returns 409 when tenant already exists", async () => {
    const status = await postProvision(
      createRequestListener({
        toursService: {} as never,
        provisioningService: new ProvisioningService(),
      }),
      { tenantId: tenantAId, subdomain: "tenant-a" }
    );
    assert.equal(status, 409);
  });

  it("P4-E-TENANT-01: tenant-a tour invisible when tenant-b is active in AsyncLocalStorage", async () => {
    await runWithTenantContext(tenantBId, async () => {
      const crossRead = await repo.getByIdForActiveContext(tourAId);
      assert.equal(
        crossRead,
        null,
        "tenant-a tour must not be visible under tenant-b ALS + RLS scope"
      );
    });
  });

  it("P4-E-TENANT-01: tenant-b scope cannot read tenant-a tour by id", async () => {
    const crossRead = await repo.getById(tourAId, tenantBId);
    assert.equal(
      crossRead,
      null,
      "RLS + repository must not return tenant-a tour when scoped to tenant-b"
    );
  });

  it("P4-E-TENANT-01: tenant-a scope cannot read tenant-b tour by id", async () => {
    const crossRead = await repo.getById(tourBId, tenantAId);
    assert.equal(
      crossRead,
      null,
      "RLS + repository must not return tenant-b tour when scoped to tenant-a"
    );
  });

  it("P4-E-TENANT-01: tenant-a listByTenant excludes tenant-b tour", async () => {
    const rows = await repo.listByTenant(tenantAId);
    assert.ok(
      !rows.some((row) => row.id === tourBId),
      "tenant-a listing must not include tenant-b tour rows"
    );
  });

  it("P4-E-TENANT-01: raw SELECT under tenant-a session returns 0 rows for tenant-b tour", async () => {
    const rows = await withTenantRls(
      tenantAId,
      async (tx) =>
        tx.$queryRaw<{ id: string }[]>`
        SELECT id::text AS id FROM tours WHERE id = ${tourBId}::uuid
      `
    );
    assert.equal(rows.length, 0, "withTenantRls(tenant-a) must not surface tenant-b tour via SQL");
  });
});

async function postProvision(
  listener: ReturnType<typeof createRequestListener>,
  body: { readonly tenantId: string; readonly subdomain: string }
): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("no bound port"));
        return;
      }
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: address.port,
          method: "POST",
          path: "/internal/tenants/provision",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          res.resume();
          res.on("end", () => {
            server.close();
            resolve(res.statusCode ?? 0);
          });
        }
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      req.end(payload);
    });
  });
}

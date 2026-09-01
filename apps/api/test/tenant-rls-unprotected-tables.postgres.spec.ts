/**
 * PREV-AUD-002 — adversarial RLS on previously unprotected tables.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";

import { getPrisma, disconnectPrisma } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { integrationTenantId } from "./test-helpers";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

const postgresSkip = hasDatabase
  ? false
  : "TENANT_RLS_UNPROTECTED_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN (PREV-AUD-002)";

describe("PREV-AUD-002 tenant RLS closure adversarial", { concurrency: false, skip: postgresSkip }, () => {
  const tenantA = integrationTenantId();
  const tenantB = integrationTenantId();
  const tourId = randomUUID();
  let admin: PrismaClient;

  before(async () => {
    assert.equal(process.env.STORAGE_DRIVER?.trim().toLowerCase(), "prisma");
    admin = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_ADMIN!.trim() } },
    });
    for (const [id, sub] of [
      [tenantA, `rls-a-${tenantA.slice(0, 8)}`],
      [tenantB, `rls-b-${tenantB.slice(0, 8)}`],
    ] as const) {
      await admin.tenant.create({
        data: { id, subdomain: sub, workspaceType: "denali", theme: {} },
      });
    }
    await admin.tour.create({
      data: {
        id: tourId,
        tenantId: tenantA,
        canonical: {},
        title: "RLS urban tour",
        publishStatus: "published",
      },
    });
    await admin.urbanRegistration.create({
      data: {
        tenantId: tenantA,
        tourId,
        email: `a-${tenantA.slice(0, 8)}@example.com`,
        fullName: "Tenant A Guest",
        status: "waitlist",
      },
    });
  });

  after(async () => {
    try {
      await admin.urbanRegistration.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await admin.tour.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await admin.tenantDomain.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    } finally {
      await admin.$disconnect();
      await disconnectPrisma();
    }
  });

  it("urban_registrations: tenant B GUC cannot read tenant A rows", async () => {
    const seen = await withTenantRls(tenantB, (tx) =>
      tx.urbanRegistration.findMany({ where: { tenantId: tenantA } })
    );
    assert.equal(seen.length, 0);
    const ownProbe = await withTenantRls(tenantA, (tx) =>
      tx.urbanRegistration.findMany({ where: { tenantId: tenantA } })
    );
    assert.equal(ownProbe.length, 1);
  });

  it("mobile_otp_challenges: app_cloud cannot insert without admin", async () => {
    const app = getPrisma();
    await assert.rejects(
      async () =>
        app.mobileOtpChallenge.create({
          data: {
            mobile: "+19995550100",
            purpose: "login",
            codeHash: "x",
            expiresAt: new Date(Date.now() + 60_000),
          },
        }),
      /./
    );
  });

  it("tenant_domains: app_cloud cannot read admin-seeded domain under wrong/no GUC", async () => {
    await admin.tenantDomain.create({
      data: {
        tenantId: tenantA,
        hostname: `apex-${tenantA.slice(0, 8)}.example.test`,
        surface: "marketing",
        status: "pending",
        cnameTarget: "cname.example.test",
      },
    });
    const app = getPrisma();
    const rows = await app.tenantDomain.findMany({
      where: { tenantId: tenantA },
    });
    assert.equal(rows.length, 0);
  });
});

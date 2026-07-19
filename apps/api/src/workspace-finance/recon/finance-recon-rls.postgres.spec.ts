/**
 * finance_recon_* RLS — app_tour tenant isolation (same standard as Booking).
 *
 * Admin (postgres) bypass is intentional for cross-tenant ops jobs.
 * This proof uses the app role via withTenantRls only.
 *
 * @see docs/phase-20/p7/appendices/FINANCE_RECON_RLS.md
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../../db/prisma.ts";
import { withTenantRls } from "../../db/with-tenant-rls.ts";
import { integrationTenantId } from "../../../test/test-helpers.ts";

function requireDatabaseEnv(): void {
  if (!process.env.DATABASE_URL?.trim() || !process.env.DATABASE_URL_ADMIN?.trim()) {
    throw new Error(
      "FINANCE_RECON_RLS_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN"
    );
  }
  if (process.env.STORAGE_DRIVER?.trim().toLowerCase() !== "prisma") {
    throw new Error("FINANCE_RECON_RLS_REQUIRES_STORAGE_DRIVER=prisma");
  }
}

describe("finance-recon-rls.postgres.spec.ts", { concurrency: false }, () => {
  requireDatabaseEnv();

  const tenantA = integrationTenantId();
  const tenantB = integrationTenantId();
  let findingAId = "";
  let actionAId = "";

  before(async () => {
    const admin = getPrismaAdmin();
    await admin.tenant.createMany({
      data: [
        {
          id: tenantA,
          subdomain: `recon-a-${tenantA.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
        {
          id: tenantB,
          subdomain: `recon-b-${tenantB.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      ],
    });

    const posture = await admin.$queryRaw<
      Array<{ relname: string; rls: boolean; force_rls: boolean }>
    >`
      SELECT c.relname::text AS relname,
             c.relrowsecurity AS rls,
             c.relforcerowsecurity AS force_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('finance_recon_findings', 'finance_recon_actions')
      ORDER BY 1
    `;
    assert.equal(posture.length, 2);
    for (const row of posture) {
      assert.equal(row.rls, true, `${row.relname} must ENABLE RLS`);
      assert.equal(row.force_rls, true, `${row.relname} must FORCE RLS`);
    }
  });

  after(async () => {
    const admin = getPrismaAdmin();
    try {
      await admin.financeReconAction.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await admin.financeReconFinding.deleteMany({
        where: { tenantId: { in: [tenantA, tenantB] } },
      });
      await admin.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    } finally {
      await disconnectPrisma();
    }
  });

  it("Tenant A can INSERT+SELECT own finding and action via app_tour RLS", async () => {
    findingAId = randomUUID();
    actionAId = randomUUID();

    await withTenantRls(tenantA, async (tx) => {
      await tx.financeReconFinding.create({
        data: {
          id: findingAId,
          tenantId: tenantA,
          code: "D-PAID-NO-LEDGER",
          severity: "critical",
          status: "open",
          fingerprint: `fp-a-${findingAId.slice(0, 8)}`,
          details: { proof: "tenant-a" },
        },
      });
      await tx.financeReconAction.create({
        data: {
          id: actionAId,
          findingId: findingAId,
          tenantId: tenantA,
          action: "preview",
          dryRun: true,
          result: "ok",
          payload: { proof: "tenant-a-action" },
        },
      });

      const finding = await tx.financeReconFinding.findUnique({ where: { id: findingAId } });
      assert.ok(finding !== null);
      assert.equal(finding?.tenantId, tenantA);

      const action = await tx.financeReconAction.findUnique({ where: { id: actionAId } });
      assert.ok(action !== null);
      assert.equal(action?.tenantId, tenantA);
    });
  });

  it("Tenant A can UPDATE own finding", async () => {
    await withTenantRls(tenantA, async (tx) => {
      const updated = await tx.financeReconFinding.updateMany({
        where: { id: findingAId, tenantId: tenantA },
        data: { status: "ignored", resolvedBy: "rls-proof" },
      });
      assert.equal(updated.count, 1);
      const row = await tx.financeReconFinding.findUnique({ where: { id: findingAId } });
      assert.equal(row?.status, "ignored");
    });
  });

  it("Tenant B cannot SELECT Tenant A finding or action", async () => {
    await withTenantRls(tenantB, async (tx) => {
      const finding = await tx.financeReconFinding.findUnique({ where: { id: findingAId } });
      assert.equal(finding, null, "RLS must hide foreign finding");

      const action = await tx.financeReconAction.findUnique({ where: { id: actionAId } });
      assert.equal(action, null, "RLS must hide foreign action");

      const listed = await tx.financeReconFinding.findMany({
        where: { status: "ignored" },
      });
      assert.ok(!listed.some((row) => row.id === findingAId));
    });
  });

  it("Tenant B cannot UPDATE or DELETE Tenant A rows", async () => {
    await withTenantRls(tenantB, async (tx) => {
      const updated = await tx.financeReconFinding.updateMany({
        where: { id: findingAId },
        data: { status: "open", resolvedBy: "attacker" },
      });
      assert.equal(updated.count, 0);

      const deletedActions = await tx.financeReconAction.deleteMany({
        where: { id: actionAId },
      });
      assert.equal(deletedActions.count, 0);

      const deletedFindings = await tx.financeReconFinding.deleteMany({
        where: { id: findingAId },
      });
      assert.equal(deletedFindings.count, 0);
    });

    const admin = getPrismaAdmin();
    const row = await admin.financeReconFinding.findUnique({ where: { id: findingAId } });
    assert.equal(row?.status, "ignored");
    assert.equal(row?.resolvedBy, "rls-proof");
    const action = await admin.financeReconAction.findUnique({ where: { id: actionAId } });
    assert.ok(action !== null);
  });

  it("Tenant B WITH CHECK rejects INSERT of Tenant A tenant_id", async () => {
    let rejected = false;
    try {
      await withTenantRls(tenantB, async (tx) => {
        await tx.financeReconFinding.create({
          data: {
            id: randomUUID(),
            tenantId: tenantA,
            code: "D-PAID-NO-LEDGER",
            severity: "critical",
            status: "open",
            fingerprint: `fp-leak-${randomUUID().slice(0, 8)}`,
            details: {},
          },
        });
      });
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, "WITH CHECK must reject cross-tenant INSERT");
  });
});

/**
 * Owner-DB-1A — Postgres partial unique index + transfer/bootstrap safety.
 * Authority: docs/phase-9/appendices/owner-cardinality-db-hardening-1a.mdoc
 *
 * Honest skip without DATABASE_URL + DATABASE_URL_ADMIN.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { Prisma } from "@prisma/client";

import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { PrismaIdentityRepository } from "../src/identity/prisma-identity.repository";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

const SKIP_REASON =
  "OWNER_CARDINALITY_DB_REQUIRES_DATABASE: set DATABASE_URL + DATABASE_URL_ADMIN";

describe(
  "owner-cardinality-db-constraint.postgres.spec.ts — OWN-DB-1A",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = randomUUID();
    const ownerUserId = randomUUID();
    const peerUserId = randomUUID();
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();

      // Ensure migration index exists (idempotent).
      await admin.$executeRawUnsafe(`
        DO $$
        DECLARE multi_owner_tenants int;
        BEGIN
          SELECT COUNT(*)::int INTO multi_owner_tenants
          FROM (
            SELECT tenant_id FROM user_tenants
            WHERE role = 'owner' AND status = 'ACTIVE'
            GROUP BY tenant_id HAVING COUNT(*) > 1
          ) violators;
          IF multi_owner_tenants > 0 THEN
            RAISE EXCEPTION 'OWNER_CARDINALITY_AUDIT_FAILED: %', multi_owner_tenants;
          END IF;
        END $$;
      `);
      await admin.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_user_tenants_one_active_owner
          ON user_tenants (tenant_id)
          WHERE role = 'owner' AND status = 'ACTIVE';
      `);

      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `own-db-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
      await admin.user.createMany({
        data: [
          { id: ownerUserId, mobile: `+1555${ownerUserId.replace(/-/g, "").slice(0, 10)}` },
          { id: peerUserId, mobile: `+1555${peerUserId.replace(/-/g, "").slice(0, 10)}` },
        ],
      });
      await admin.userTenant.create({
        data: {
          userId: ownerUserId,
          tenantId,
          role: "owner",
          status: "ACTIVE",
          sessionVersion: 1,
          workspaceId: "ws-own-db",
        },
      });
      await admin.userTenant.create({
        data: {
          userId: peerUserId,
          tenantId,
          role: "admin",
          status: "ACTIVE",
          sessionVersion: 1,
          workspaceId: "ws-own-db",
        },
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      const admin = getPrismaAdmin();
      await admin.userTenant.deleteMany({ where: { tenantId } });
      await admin.user.deleteMany({ where: { id: { in: [ownerUserId, peerUserId] } } });
      await admin.tenant.deleteMany({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    it("OWN-DB-PG-01 second ACTIVE owner insert is rejected by unique index", async () => {
      const thirdUserId = randomUUID();
      const admin = getPrismaAdmin();
      await admin.user.create({
        data: { id: thirdUserId, mobile: `+1555${thirdUserId.replace(/-/g, "").slice(0, 10)}` },
      });

      let rejected = false;
      try {
        await admin.userTenant.create({
          data: {
            userId: thirdUserId,
            tenantId,
            role: "owner",
            status: "ACTIVE",
            sessionVersion: 1,
            workspaceId: "ws-own-db",
          },
        });
      } catch (error) {
        rejected = true;
        assert.ok(error instanceof Prisma.PrismaClientKnownRequestError);
        assert.equal(error.code, "P2002");
      } finally {
        await admin.userTenant.deleteMany({ where: { userId: thirdUserId, tenantId } });
        await admin.user.deleteMany({ where: { id: thirdUserId } });
      }
      assert.equal(rejected, true);
    });

    it("OWN-DB-PG-02 ownership transfer still works under unique index", async () => {
      const repo = new PrismaIdentityRepository();
      const result = await repo.transferWorkspaceOwnership(tenantId, ownerUserId, peerUserId);
      assert.equal(result.previousOwnerUserId, ownerUserId);
      assert.equal(result.newOwnerUserId, peerUserId);

      const rows = await withTenantRls(tenantId, (tx) =>
        tx.userTenant.findMany({ where: { tenantId, role: "owner", status: "ACTIVE" } })
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.userId, peerUserId);

      // Restore for remaining tests / cleanup clarity
      await repo.transferWorkspaceOwnership(tenantId, peerUserId, ownerUserId);
    });

    it("OWN-DB-PG-03 soft owner (non-ACTIVE) does not collide with ACTIVE owner", async () => {
      const softUserId = randomUUID();
      const admin = getPrismaAdmin();
      await admin.user.create({
        data: { id: softUserId, mobile: `+1555${softUserId.replace(/-/g, "").slice(0, 10)}` },
      });
      await admin.userTenant.create({
        data: {
          userId: softUserId,
          tenantId,
          role: "owner",
          status: "SUSPENDED",
          sessionVersion: 1,
          workspaceId: "ws-own-db",
        },
      });

      const active = await admin.userTenant.findMany({
        where: { tenantId, role: "owner", status: "ACTIVE" },
      });
      assert.equal(active.length, 1);

      await admin.userTenant.deleteMany({ where: { userId: softUserId, tenantId } });
      await admin.user.deleteMany({ where: { id: softUserId } });
    });
  }
);

describe("owner-cardinality-db-constraint.postgres.spec.ts — skip notice", () => {
  it(SKIP_REASON, { skip: hasDatabase }, () => {
    assert.ok(true);
  });
});

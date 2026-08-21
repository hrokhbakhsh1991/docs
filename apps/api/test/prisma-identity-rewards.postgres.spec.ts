/**
 * Prisma identity rewards persistence regression.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import type { Prisma } from "@prisma/client";

import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { PrismaIdentityRepository } from "../src/identity/prisma-identity.repository";
import { patchWorkspaceUserRewards } from "../src/identity/users.service";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

describe(
  "prisma-identity-rewards.postgres.spec.ts",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = randomUUID();
    const ownerUserId = randomUUID();
    const memberUserId = randomUUID();
    const otherTenantId = randomUUID();
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();
      await admin.tenant.createMany({
        data: [
          {
            id: tenantId,
            subdomain: `rewards-${tenantId.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
          {
            id: otherTenantId,
            subdomain: `rewards-other-${otherTenantId.slice(0, 8)}`,
            workspaceType: "denali",
            theme: {},
          },
        ],
      });
      await admin.user.createMany({
        data: [
          { id: ownerUserId, mobile: `+1555${Date.now().toString().slice(-6)}01` },
          { id: memberUserId, mobile: `+1555${Date.now().toString().slice(-6)}91` },
        ],
      });
      await admin.userTenant.createMany({
        data: [
          {
            userId: ownerUserId,
            tenantId,
            role: "owner",
            status: "ACTIVE",
            sessionVersion: 1,
            workspaceId: `ws-rewards-${tenantId.slice(0, 8)}`,
          },
          {
            userId: memberUserId,
            tenantId,
            role: "member",
            status: "ACTIVE",
            sessionVersion: 1,
            workspaceId: `ws-rewards-${tenantId.slice(0, 8)}`,
            membershipMetadata: {
              displayName: "Rewards Member",
              email: "rewards-member@example.test",
              portalPlanCode: "starter",
            },
          },
          {
            userId: memberUserId,
            tenantId: otherTenantId,
            role: "member",
            status: "ACTIVE",
            sessionVersion: 1,
            workspaceId: `ws-rewards-other-${otherTenantId.slice(0, 8)}`,
            membershipMetadata: {
              displayName: "Other Tenant Member",
            },
          },
        ],
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      const admin = getPrismaAdmin();
      await admin.operatorUserRoleAudit.deleteMany({
        where: { tenantId: { in: [tenantId, otherTenantId] } },
      });
      await admin.userTenant.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await admin.user.deleteMany({ where: { id: { in: [ownerUserId, memberUserId] } } });
      await admin.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
      await disconnectPrisma();
    });

    it("updates an active member discount while preserving tenant membership metadata", async () => {
      const repo = new PrismaIdentityRepository();
      const auth = {
        userId: ownerUserId,
        tenantId,
        role: "owner" as const,
        status: "ACTIVE" as const,
        workspaceId: `ws-rewards-${tenantId.slice(0, 8)}`,
      };

      const row20 = await patchWorkspaceUserRewards(
        auth,
        memberUserId,
        { permanentDiscountPercentage: 20 },
        repo
      );
      assert.equal(row20.tenantId, tenantId);
      assert.equal(row20.role, "member");
      assert.equal(row20.status, "ACTIVE");
      assert.equal(row20.permanentDiscountPercentage, 20);

      const row50 = await patchWorkspaceUserRewards(
        auth,
        memberUserId,
        { permanentDiscountPercentage: 50 },
        repo
      );
      assert.equal(row50.permanentDiscountPercentage, 50);

      const row0 = await patchWorkspaceUserRewards(
        auth,
        memberUserId,
        { permanentDiscountPercentage: 0 },
        repo
      );
      assert.equal(row0.permanentDiscountPercentage, 0);

      const cleared = await patchWorkspaceUserRewards(
        auth,
        memberUserId,
        { permanentDiscountPercentage: null },
        repo
      );
      assert.equal(cleared.permanentDiscountPercentage, null);

      const admin = getPrismaAdmin();
      const membership = await admin.userTenant.findUniqueOrThrow({
        where: { userId_tenantId: { userId: memberUserId, tenantId } },
      });
      const metadata = membership.membershipMetadata as Prisma.JsonObject;
      assert.equal(metadata.displayName, "Rewards Member");
      assert.equal(metadata.email, "rewards-member@example.test");
      assert.equal(metadata.portalPlanCode, "starter");
      assert.deepEqual(metadata.rewards, { permanentDiscountPercentage: null });
      assert.equal(membership.role, "member");
      assert.equal(membership.status, "ACTIVE");

      const otherMembership = await admin.userTenant.findUniqueOrThrow({
        where: { userId_tenantId: { userId: memberUserId, tenantId: otherTenantId } },
      });
      assert.deepEqual(otherMembership.membershipMetadata, {
        displayName: "Other Tenant Member",
      });

      const globalUser = await admin.user.findUniqueOrThrow({ where: { id: memberUserId } });
      assert.equal(globalUser.mobile.startsWith("+1555"), true);
      assert.equal("membershipMetadata" in globalUser, false);

      const auditRows = await admin.operatorUserRoleAudit.findMany({ where: { tenantId } });
      assert.equal(auditRows.length, 4);
      assert.ok(auditRows.every((row) => row.eventKind === "rewards_change"));
    });
  }
);

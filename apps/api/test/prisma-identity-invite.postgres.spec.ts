/**
 * Prisma identity invite persistence regression.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { disconnectPrisma, getPrismaAdmin } from "../src/db/prisma";
import { PrismaIdentityRepository } from "../src/identity/prisma-identity.repository";
import { InviteAlreadyPendingError } from "../src/identity/in-memory-identity.repository";
import { inviteWorkspaceUser } from "../src/identity/users.service";

const hasDatabase =
  Boolean(process.env.DATABASE_URL?.trim()) && Boolean(process.env.DATABASE_URL_ADMIN?.trim());

describe(
  "prisma-identity-invite.postgres.spec.ts",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = randomUUID();
    const ownerUserId = randomUUID();
    const cleanPhone = `+1555${Date.now().toString().slice(-6)}90`;
    const priorDriver = process.env.STORAGE_DRIVER;

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      const admin = getPrismaAdmin();
      await admin.tenant.create({
        data: {
          id: tenantId,
          subdomain: `invite-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
      await admin.user.create({
        data: {
          id: ownerUserId,
          mobile: `+1555${Date.now().toString().slice(-6)}01`,
        },
      });
      await admin.userTenant.create({
        data: {
          userId: ownerUserId,
          tenantId,
          role: "owner",
          status: "ACTIVE",
          sessionVersion: 1,
          workspaceId: `ws-invite-${tenantId.slice(0, 8)}`,
        },
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      const admin = getPrismaAdmin();
      await admin.operatorPendingInvite.deleteMany({ where: { tenantId } });
      await admin.userTenant.deleteMany({ where: { tenantId } });
      await admin.user.deleteMany({ where: { id: ownerUserId } });
      await admin.tenant.deleteMany({ where: { id: tenantId } });
      await disconnectPrisma();
    });

    it("creates exactly one active clean member invite with TTL fields", async () => {
      const repo = new PrismaIdentityRepository();
      const auth = {
        userId: ownerUserId,
        tenantId,
        role: "owner" as const,
        status: "ACTIVE" as const,
        workspaceId: `ws-invite-${tenantId.slice(0, 8)}`,
      };

      const created = await inviteWorkspaceUser(
        auth,
        { phone: cleanPhone, role: "member", nameNote: "Discount QA Member" },
        repo
      );

      assert.equal(created.phone, cleanPhone);
      assert.equal(created.role, "member");
      assert.equal(created.status, "INVITED");
      assert.ok(created.inviteId.length > 0);
      assert.ok(created.inviteToken.length > 0);

      const pending = await repo.listPendingInvitesByTenant(tenantId);
      const matching = pending.filter((row) => row.phone === cleanPhone);
      assert.equal(matching.length, 1);
      assert.equal(matching[0]?.tenantId, tenantId);
      assert.equal(matching[0]?.role, "member");
      assert.equal(matching[0]?.status, "INVITED");
      assert.ok(matching[0]?.expiresAt instanceof Date);
      assert.ok(matching[0]!.expiresAt.getTime() > Date.now());

      await assert.rejects(
        () => inviteWorkspaceUser(auth, { phone: cleanPhone, role: "member" }, repo),
        InviteAlreadyPendingError
      );
      const afterDuplicate = (await repo.listPendingInvitesByTenant(tenantId)).filter(
        (row) => row.phone === cleanPhone
      );
      assert.equal(afterDuplicate.length, 1);
    });
  }
);

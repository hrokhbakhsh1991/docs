import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { UsersWriteService } from "../../../src/modules/identity/users-write.service";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_ID = "33333333-3333-4333-8333-333333333333";

function buildService(opts?: { actorRole?: string }) {
  const manager = {
    findOne: async (_entity: unknown, query: { where: { userId: string } }) => {
      if (query.where.userId === ACTOR_ID) {
        return {
          id: "m-actor",
          tenantId: TENANT_ID,
          userId: ACTOR_ID,
          role: opts?.actorRole ?? "owner",
          deletedAt: null
        };
      }
      if (query.where.userId === TARGET_ID) {
        return {
          id: "m-target",
          tenantId: TENANT_ID,
          userId: TARGET_ID,
          role: "admin",
          deletedAt: null
        };
      }
      return null;
    },
    query: async () => undefined,
    createQueryBuilder: () => ({
      insert: () => ({
        into: () => ({
          values: () => ({
            execute: async () => undefined
          })
        })
      })
    })
  };

  const dataSource = {
    transaction: async <T>(fn: (_m: typeof manager) => Promise<T>) => fn(manager)
  };
  const access = {
    users: { findOne: async () => ({ email: "actor@test.invalid" }) }
  };
  const requestContextService = {
    resolveEffectiveTenantId: () => TENANT_ID,
    getUserId: () => ACTOR_ID,
    tryGetClientIp: () => undefined,
    tryGetRequestId: () => undefined
  };
  const tenantAuditEventsService = {
    append: async () => undefined
  };

  return new UsersWriteService(
    dataSource as never,
    requestContextService as never,
    tenantAuditEventsService as never,
    access as never
  );
}

test("transferWorkspaceOwnership: only current owner can transfer", async () => {
  const service = buildService({ actorRole: "admin" });
  await assert.rejects(
    async () => {
      await service.transferWorkspaceOwnership(TENANT_ID, { newOwnerUserId: TARGET_ID });
    },
    (error: unknown) => {
      assert.ok(error instanceof ForbiddenException);
      const response = error.getResponse() as { error?: { code?: string } };
      assert.equal(response.error?.code, "OWNER_ONLY_TRANSFER");
      return true;
    }
  );
});

test("transferWorkspaceOwnership: swaps owner role atomically", async () => {
  const service = buildService();
  const result = await service.transferWorkspaceOwnership(TENANT_ID, {
    newOwnerUserId: TARGET_ID
  });
  assert.deepEqual(result, {
    tenant_id: TENANT_ID,
    previous_owner_user_id: ACTOR_ID,
    new_owner_user_id: TARGET_ID
  });
});

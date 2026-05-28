import assert from "node:assert/strict";
import test from "node:test";
import { UsersInviteService } from "../../../src/modules/identity/services/users-invite.service";

function buildService(mocks: {
  getRole: () => string | undefined;
  saveImpl?: (_entity: unknown) => Promise<unknown>;
}) {
  const access = {
    resolveTenantIdOrThrow: () => "11111111-1111-4111-8111-111111111111",
    resolveActorContextOrThrow: () => ({ actorUserId: "user-1", actorRole: mocks.getRole() }),
    ensureActorMembershipOrThrow: async () => undefined
  };
  const requestContextService = {
    tryGetClientIp: () => null,
    tryGetRequestId: () => null
  };
  const tenantAuditEventsService = {
    append: async () => undefined
  };
  const workspaceInviteRepository = {
    create: (e: unknown) => e,
    save: mocks.saveImpl ?? (async (e: unknown) => e)
  };
  const userRepository = {
    createQueryBuilder: () => ({
      where: () => ({
        andWhere: () => ({
          getOne: async () => null
        })
      })
    }),
    findOne: async () => ({ email: "owner@example.com" })
  };
  const membershipRepository = {
    findOne: async () => null,
    manager: {
      transaction: async (fn: (_manager: any) => Promise<unknown>) =>
        fn({
          create: (_entity: unknown, e: unknown) => e,
          save: mocks.saveImpl ?? (async (e: unknown) => e),
          getRepository: () => ({ 
            findOne: async () => ({ email: "owner@example.com" }),
            create: (e: unknown) => e,
            save: mocks.saveImpl ?? (async (e: unknown) => e)
          })
        })
    }
  };

  return new UsersInviteService(
    access as never,
    requestContextService as never,
    tenantAuditEventsService as never,
    workspaceInviteRepository as never,
    userRepository as never,
    membershipRepository as never
  );
}

test("createInvite: owner role is blocked for all invite creators", async () => {
  const service = buildService({ getRole: () => "admin" });

  await assert.rejects(
    async () => {
      await service.inviteUser("+989121234567", "owner");
    },
    (err: unknown) => {
      assert.ok(err instanceof Error);
      const body = (err as any).getResponse?.() as {
        error?: { code?: string };
      };
      assert.ok(body?.error?.code);
      return true;
    }
  );
});

test("createInvite: owner can invite admin", async () => {
  let saved: unknown;
  const service = buildService({
    getRole: () => "owner",
    saveImpl: async (entity: unknown) => {
      saved = entity;
      return entity;
    }
  });

  const result = await service.inviteUser("+989121234567", "admin");
  assert.equal(result.role, "admin");
  assert.equal(result.phone, "+989121234567");
  assert.equal(typeof result.inviteToken, "string");
  assert.ok(saved);
});

test("createInvite: owner can invite member", async () => {
  const service = buildService({ getRole: () => "owner" });

  const result = await service.inviteUser("+989121234567", "member");
  assert.equal(result.role, "member");
});

test("createInvite: admin can invite member", async () => {
  const service = buildService({ getRole: () => "admin" });

  const result = await service.inviteUser("+989121234567", "member");
  assert.equal(result.role, "member");
});

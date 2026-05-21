import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { UserRole } from "../auth/user-role.enum";
import { verifyActiveMembershipAndHydrateContext } from "./auth-membership-verification";

function mockQueryRunner(membershipRow: Record<string, unknown> | null) {
  return {
    manager: {
      getRepository() {
        return {
          createQueryBuilder() {
            const chain = {
              innerJoin() {
                return chain;
              },
              select() {
                return chain;
              },
              addSelect() {
                return chain;
              },
              where() {
                return chain;
              },
              andWhere() {
                return chain;
              },
              async getRawOne() {
                return membershipRow;
              }
            };
            return chain;
          }
        };
      }
    }
  };
}

function mockRequestContext() {
  const state: Record<string, unknown> = {};
  return {
    setUserId(id: string) {
      state.userId = id;
    },
    setTenantId(id: string) {
      state.tenantId = id;
    },
    setRole(role: string) {
      state.role = role;
    },
    setJwtCapabilitySnapshot() {},
    setWorkspaceAbilityContext() {},
    get state() {
      return state;
    }
  };
}

const logger = {
  warn() {},
  debug() {}
};

test("verifyActiveMembershipAndHydrateContext rejects JWT role mismatch with AUTH_TOKEN_STALE", async () => {
  const ctx = mockRequestContext();
  const result = await verifyActiveMembershipAndHydrateContext({
    userId: "u1",
    tenantId: "t1",
    jwtRole: UserRole.Leader,
    jwtSessionVersion: 1,
    queryRunner: mockQueryRunner({
      session_version: 1,
      role: "member",
      labels: [],
      membership_metadata: {},
      enabled_modules: []
    }) as never,
    requestContextService: ctx as never,
    loggerService: logger as never
  });

  assert.equal(result.ok, false);
  if (result.ok || result.silent) {
    assert.fail("expected failure");
  }
  assert.ok(result.error instanceof UnauthorizedException);
  const body = (result.error as UnauthorizedException).getResponse() as { error: { code: string } };
  assert.equal(body.error.code, "AUTH_TOKEN_STALE");
  assert.equal(ctx.state.userId, undefined);
});

test("verifyActiveMembershipAndHydrateContext hydrates ALS when JWT role matches DB", async () => {
  const ctx = mockRequestContext();
  const result = await verifyActiveMembershipAndHydrateContext({
    userId: "u1",
    tenantId: "t1",
    jwtRole: UserRole.Owner,
    jwtSessionVersion: 2,
    queryRunner: mockQueryRunner({
      session_version: 2,
      role: "owner",
      labels: [],
      membership_metadata: {},
      enabled_modules: []
    }) as never,
    requestContextService: ctx as never,
    loggerService: logger as never
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("expected success");
  }
  assert.equal(result.dbRole, UserRole.Owner);
  assert.equal(ctx.state.userId, "u1");
  assert.equal(ctx.state.tenantId, "t1");
  assert.equal(ctx.state.role, UserRole.Owner);
});

test("verifyActiveMembershipAndHydrateContext rejects unknown stored role", async () => {
  const result = await verifyActiveMembershipAndHydrateContext({
    userId: "u1",
    tenantId: "t1",
    jwtRole: UserRole.Member,
    jwtSessionVersion: 1,
    queryRunner: mockQueryRunner({
      session_version: 1,
      role: "not_a_role",
      labels: [],
      membership_metadata: {},
      enabled_modules: []
    }) as never,
    requestContextService: mockRequestContext() as never,
    loggerService: logger as never
  });

  assert.equal(result.ok, false);
  if (result.ok || result.silent) {
    assert.fail("expected failure");
  }
  assert.ok(result.error instanceof ForbiddenException);
});

test("verifyActiveMembershipAndHydrateContext silentOnFailure skips ALS on mismatch", async () => {
  const ctx = mockRequestContext();
  const result = await verifyActiveMembershipAndHydrateContext({
    userId: "u1",
    tenantId: "t1",
    jwtRole: UserRole.Leader,
    jwtSessionVersion: 1,
    queryRunner: mockQueryRunner({
      session_version: 1,
      role: "member",
      labels: [],
      membership_metadata: {},
      enabled_modules: []
    }) as never,
    requestContextService: ctx as never,
    loggerService: logger as never,
    silentOnFailure: true
  });

  assert.equal(result.ok, false);
  assert.equal(result.silent, true);
  assert.equal(ctx.state.userId, undefined);
});

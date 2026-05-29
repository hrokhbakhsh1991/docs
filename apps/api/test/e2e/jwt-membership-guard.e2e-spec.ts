import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { assertApiErrorEnvelope, assertNoSessionOrJwtInBody } from "@repo/testing-infra";

import { UserRole } from "../../src/common/auth/user-role.enum";
import { LoggerService } from "../../src/common/logger/logger.service";
import { seedAuthPersona, seedTwoTenantPersonas } from "../helpers/auth-test-personas";
import {
  createAuthE2eHarness,
  teardownAuthE2eHarness,
  type AuthE2eHarnessContext,
} from "./auth/auth-e2e-harness";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI,
} from "./jwt-test-keys";

const TENANT_A = "e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1";
const TENANT_B = "f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2";
const SUBDOMAIN_A = "jwt-ta";
const SUBDOMAIN_B = "jwt-tb";

const USER_X_EMAIL = "userx@jwt-membership-guard.test";
const USER_X_PHONE = "+15557300001";
const MEMBER_EMAIL = "memberx@jwt-membership-guard.test";
const MEMBER_PHONE = "+15557300002";

const INTERNAL_API_KEY = "test-internal-key-jwt-membership";

const WORKSPACE_DENIED_WARN =
  "workspace session denied: user has no membership for tenant";

let ctx: AuthE2eHarnessContext;
/** JWT for userX scoped to tenant B (userX has no membership in tenant A). */
let tokenTenantB = "";

const warnCalls: Array<{ message: string; meta: Record<string, unknown> }> = [];
let originalLoggerWarn: LoggerService["warn"] | undefined;

function skip(): boolean {
  return Boolean(ctx.unavailableReason) || !ctx.app || !ctx.auth || !ctx.db;
}

function errorBody(body: Record<string, unknown>): { code?: string } {
  const error = body.error;
  if (error && typeof error === "object" && "code" in error) {
    return error as { code?: string };
  }
  return {};
}

before(async () => {
  ctx = await createAuthE2eHarness({
    jwtKeys: {
      privatePem: E2E_JWT_PRIVATE_KEY_PKCS8,
      publicPem: E2E_JWT_PUBLIC_KEY_SPKI,
    },
    internalApiKey: INTERNAL_API_KEY,
    seed: async (ds) => {
      await seedTwoTenantPersonas(ds, {
        tenantA: {
          id: TENANT_A,
          subdomain: SUBDOMAIN_A,
          name: "Tenant A (no userX)",
          description: "jwt-membership-guard",
        },
        tenantB: {
          id: TENANT_B,
          subdomain: SUBDOMAIN_B,
          name: "Tenant B (userX only)",
          description: "jwt-membership-guard",
        },
        userInBOnly: {
          phone: USER_X_PHONE,
          email: USER_X_EMAIL,
          subdomain: SUBDOMAIN_B,
          role: UserRole.Owner,
          fullName: "User X",
        },
      });
      await seedAuthPersona(ds, {
        phone: MEMBER_PHONE,
        email: MEMBER_EMAIL,
        subdomain: SUBDOMAIN_B,
        tenantId: TENANT_B,
        role: UserRole.Member,
        fullName: "Member X",
      });
    },
  });

  if (skip()) {
    return;
  }

  const logger = ctx.app!.get(LoggerService);
  originalLoggerWarn = logger.warn.bind(logger);
  logger.warn = (message: string, meta: Record<string, unknown> = {}) => {
    warnCalls.push({ message, meta });
    return originalLoggerWarn!(message, meta);
  };

  tokenTenantB = await ctx.auth!.loginOtp({
    phone: USER_X_PHONE,
    tenantSubdomain: SUBDOMAIN_B,
  });
});

after(async () => {
  if (!ctx.unavailableReason && ctx.app) {
    const deniedWarnCount = warnCalls.filter((c) => c.message === WORKSPACE_DENIED_WARN).length;
    assert.ok(
      deniedWarnCount >= 1,
      `expected LoggerService.warn("${WORKSPACE_DENIED_WARN}") for denied workspace session`,
    );
  }
  if (ctx.app && originalLoggerWarn) {
    ctx.app.get(LoggerService).warn = originalLoggerWarn;
  }
  await teardownAuthE2eHarness(ctx);
});

test("POST /api/v2/auth/workspace/session for tenantA -> 403 TENANT_SCOPE_FORBIDDEN", async () => {
  if (skip()) {
    return;
  }
  const beforeWarn = warnCalls.length;
  const response = await ctx.auth!.postWorkspaceSessionRaw({
    bearer: tokenTenantB,
    targetTenantId: TENANT_A,
    hostSubdomain: SUBDOMAIN_A,
  });

  assert.equal(response.status, 403);
  assert.equal(errorBody(response.body).code, "TENANT_SCOPE_FORBIDDEN");
  assertApiErrorEnvelope(response.body);
  assertNoSessionOrJwtInBody(response.body);

  const newWarns = warnCalls.slice(beforeWarn);
  assert.ok(
    newWarns.some((w) => w.message === WORKSPACE_DENIED_WARN),
    `expected warn "${WORKSPACE_DENIED_WARN}", got: ${JSON.stringify(newWarns.map((w) => w.message))}`,
  );
});

test("after web login to tenantB, workspace switch to tenantA -> 403 and no token", async () => {
  if (skip()) {
    return;
  }
  const beforeWarn = warnCalls.length;
  const freshToken = await ctx.auth!.loginOtp({
    phone: USER_X_PHONE,
    tenantSubdomain: SUBDOMAIN_B,
  });
  assert.equal(typeof freshToken, "string");
  assert.equal(freshToken.split(".").length, 3);

  const response = await ctx.auth!.postWorkspaceSessionRaw({
    bearer: freshToken,
    targetTenantId: TENANT_A,
    hostSubdomain: SUBDOMAIN_A,
  });

  assert.equal(response.status, 403);
  assert.equal(errorBody(response.body).code, "TENANT_SCOPE_FORBIDDEN");
  assertApiErrorEnvelope(response.body);
  assertNoSessionOrJwtInBody(response.body);

  const newWarns = warnCalls.slice(beforeWarn);
  assert.ok(
    newWarns.some((w) => w.message === WORKSPACE_DENIED_WARN),
    `expected warn "${WORKSPACE_DENIED_WARN}", got: ${JSON.stringify(newWarns.map((w) => w.message))}`,
  );
});

test("POST workspace/session rejects tenant_id that does not match HTTP Host (TENANT_HOST_MISMATCH)", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.postWorkspaceSessionRaw({
    bearer: tokenTenantB,
    targetTenantId: TENANT_B,
    hostSubdomain: SUBDOMAIN_A,
  });

  assert.equal(response.status, 403);
  assert.equal(errorBody(response.body).code, "TENANT_HOST_MISMATCH");
  assertApiErrorEnvelope(response.body);
});

test("403 workspace denial responses never include session_token / JWT material", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.postWorkspaceSessionRaw({
    bearer: tokenTenantB,
    targetTenantId: TENANT_A,
    hostSubdomain: SUBDOMAIN_A,
  });

  assert.equal(response.status, 403);
  assertNoSessionOrJwtInBody(response.body);
  const serialized = JSON.stringify(response.body);
  assert.equal(serialized.includes("session_token"), false);
  assert.equal(serialized.toLowerCase().includes("bearer "), false);
});

test("scoped routes reject JWT when tenant does not match HTTP Host (TENANT_HOST_TOKEN_MISMATCH)", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.getToursRaw({
    bearer: tokenTenantB,
    tenantSubdomain: SUBDOMAIN_A,
  });

  assert.equal(response.status, 403);
  assert.equal(errorBody(response.body).code, "TENANT_HOST_TOKEN_MISMATCH");
  assertApiErrorEnvelope(response.body);
});

test("JWT rejected with AUTH_TOKEN_STALE when membership role changes without session_version bump", async () => {
  if (skip()) {
    return;
  }
  const memberToken = await ctx.auth!.loginOtp({
    phone: MEMBER_PHONE,
    tenantSubdomain: SUBDOMAIN_B,
  });
  await ctx.db!.updateMembershipRoleByEmail({
    email: MEMBER_EMAIL,
    tenantId: TENANT_B,
    role: UserRole.Admin,
  });

  const response = await ctx.auth!.getToursRaw({
    bearer: memberToken,
    tenantSubdomain: SUBDOMAIN_B,
  });

  assert.equal(response.status, 401);
  assert.equal(errorBody(response.body).code, "AUTH_TOKEN_STALE");
  assertApiErrorEnvelope(response.body);

  await ctx.db!.updateMembershipRoleByEmail({
    email: MEMBER_EMAIL,
    tenantId: TENANT_B,
    role: UserRole.Member,
  });
});

test("JWT rejected with AUTH_TOKEN_REVOKED after session_version bump on membership row", async () => {
  if (skip()) {
    return;
  }
  await ctx.db!.bumpMembershipSessionVersionByEmail({
    email: USER_X_EMAIL,
    tenantId: TENANT_B,
  });

  const response = await ctx.auth!.getToursRaw({
    bearer: tokenTenantB,
    tenantSubdomain: SUBDOMAIN_B,
  });

  assert.equal(response.status, 401);
  assert.equal(errorBody(response.body).code, "AUTH_TOKEN_REVOKED");
  assertApiErrorEnvelope(response.body);
});

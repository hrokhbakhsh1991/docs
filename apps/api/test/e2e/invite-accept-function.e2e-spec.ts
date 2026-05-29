import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import request from "supertest";
import { DataSource } from "typeorm";
import { assertApiErrorEnvelope } from "@repo/testing-infra";

import { UserRole } from "../../src/common/auth/user-role.enum";
import {
  findUserIdByEmail,
  insertPendingWorkspaceInvite,
  seedAuthPersona,
  seedTwoTenantPersonas,
} from "../helpers/auth-test-personas";
import {
  createAuthE2eHarness,
  teardownAuthE2eHarness,
  type AuthE2eHarnessContext,
} from "./auth/auth-e2e-harness";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI,
} from "./jwt-test-keys";

const TENANT_A = "b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4";
const TENANT_B = "b5b5b5b5-b5b5-45b5-85b5-b5b5b5b5b5b5";
const SUBDOMAIN_A = "invacc-a";
const SUBDOMAIN_B = "invacc-b";

const OWNER_EMAIL = "owner@invite-accept-fn.test";
const INVITEE_EMAIL = "invitee@invite-accept-fn.test";
const OTHER_EMAIL = "other@invite-accept-fn.test";
const OWNER_PHONE = "+15557800001";
const INVITEE_PHONE = "+15557800002";
const OTHER_PHONE = "+15557800003";

/** 48-char hex token (24 bytes) matching WorkspaceInvitesService format. */
const TOKEN_ACCEPT_OK = "0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a";
const TOKEN_REUSE_FLOW = "1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b";
const TOKEN_MISMATCH = "2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c";

const LIMITED_DB_ROLE = "invite_accept_fn_e2e_limited";
const LIMITED_DB_PASSWORD = "LtdPw0_invite_accept_fn_e2e";

const INTERNAL_API_KEY = "test-internal-key-invite-accept-fn";

let ctx: AuthE2eHarnessContext;
let tokenInviteeHome = "";
let tokenOtherUser = "";
let ownerUserId = "";
let inviteeUserId = "";

function skip(): boolean {
  return Boolean(ctx.unavailableReason) || !ctx.app || !ctx.auth || !ctx.db;
}

async function ensureLimitedDbRole(ds: DataSource, dbName: string): Promise<void> {
  const safeDb = dbName.replace(/"/g, '""');
  const appDbUser = (process.env.DATABASE_USER ?? "test").replace(/"/g, '""');
  await ds.query(`DROP ROLE IF EXISTS ${LIMITED_DB_ROLE}`);
  await ds.query(
    `CREATE ROLE ${LIMITED_DB_ROLE} LOGIN PASSWORD '${LIMITED_DB_PASSWORD.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOINHERIT`,
  );
  await ds.query(`GRANT CONNECT ON DATABASE "${safeDb}" TO ${LIMITED_DB_ROLE}`);
  await ds.query(`GRANT USAGE ON SCHEMA public TO ${LIMITED_DB_ROLE}`);
  // Canonical model migration recreates the function; re-apply hardened EXECUTE grants for e2e.
  await ds.query(
    `REVOKE EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) FROM PUBLIC`,
  );
  await ds.query(
    `GRANT EXECUTE ON FUNCTION public.accept_workspace_invite_by_token(text, uuid, text) TO "${appDbUser}"`,
  );
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
          name: "Tenant A (invite accept)",
          description: "invite-accept-function e2e",
        },
        tenantB: {
          id: TENANT_B,
          subdomain: SUBDOMAIN_B,
          name: "Tenant B (invitee home)",
          description: "invite-accept-function e2e",
        },
        dualMember: {
          phone: OWNER_PHONE,
          email: OWNER_EMAIL,
          role: UserRole.Owner,
          fullName: "Owner",
        },
      });

      await seedAuthPersona(ds, {
        phone: INVITEE_PHONE,
        email: INVITEE_EMAIL,
        tenantId: TENANT_B,
        subdomain: SUBDOMAIN_B,
        role: UserRole.Member,
        fullName: "Invitee",
      });

      await seedAuthPersona(ds, {
        phone: OTHER_PHONE,
        email: OTHER_EMAIL,
        tenantId: TENANT_B,
        subdomain: SUBDOMAIN_B,
        role: UserRole.Member,
        fullName: "Other",
      });

      ownerUserId = await findUserIdByEmail(ds, OWNER_EMAIL);
      inviteeUserId = await findUserIdByEmail(ds, INVITEE_EMAIL);

      await insertPendingWorkspaceInvite(ds, {
        tenantId: TENANT_A,
        email: INVITEE_EMAIL,
        role: UserRole.Member,
        inviteToken: TOKEN_ACCEPT_OK,
        invitedByUserId: ownerUserId,
      });
    },
  });

  if (skip()) {
    return;
  }

  if (ctx.container) {
    await ensureLimitedDbRole(ctx.app!.get(DataSource), ctx.container.getDatabase());
  }

  tokenInviteeHome = await ctx.auth!.loginOtp({
    phone: INVITEE_PHONE,
    tenantSubdomain: SUBDOMAIN_B,
  });
  tokenOtherUser = await ctx.auth!.loginOtp({
    phone: OTHER_PHONE,
    tenantSubdomain: SUBDOMAIN_B,
  });
});

after(async () => {
  if (ctx.app) {
    const ds = ctx.app.get(DataSource);
    try {
      await ds.query(`DROP ROLE IF EXISTS ${LIMITED_DB_ROLE}`);
    } catch {
      /* ignore */
    }
  }
  await teardownAuthE2eHarness(ctx);
});

test("POST /api/v2/invites/:token/accept with valid token -> 200, invite row removed", async () => {
  if (skip()) {
    return;
  }

  assert.equal(await ctx.db!.countWorkspaceInvitesByToken(TOKEN_ACCEPT_OK), 1);

  const response = await request(ctx.app!.getHttpServer())
    .post(`/api/v2/invites/${TOKEN_ACCEPT_OK}/accept`)
    .set("Authorization", `Bearer ${tokenInviteeHome}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.tenant_id, TENANT_A);
  assert.equal(response.body.role, UserRole.Member);
  assert.equal(await ctx.db!.countWorkspaceInvitesByToken(TOKEN_ACCEPT_OK), 0);
  assert.equal(
    await ctx.db!.hasActiveMembership({ userId: inviteeUserId, tenantId: TENANT_A }),
    true,
  );
});

test("direct SELECT accept_workspace_invite_by_token as non-app DB role -> permission denied", async () => {
  if (skip() || !ctx.container) {
    return;
  }

  const limitedDs = new DataSource({
    type: "postgres",
    host: ctx.container.getHost(),
    port: ctx.container.getPort(),
    username: LIMITED_DB_ROLE,
    password: LIMITED_DB_PASSWORD,
    database: ctx.container.getDatabase(),
    synchronize: false,
  });
  await limitedDs.initialize();
  try {
    let pgCode: string | undefined;
    try {
      await limitedDs.query(
        `SELECT ok, error_code FROM accept_workspace_invite_by_token($1::text, $2::uuid, $3::text)`,
        [TOKEN_REUSE_FLOW, randomUUID(), "noop@example.com"],
      );
    } catch (err: unknown) {
      assert.ok(err instanceof Error);
      const pgErr = err as { code?: string; driverError?: { code?: string }; message?: string };
      pgCode = pgErr.driverError?.code ?? pgErr.code;
    }
    assert.equal(pgCode, "42501", "non-app DB role must not EXECUTE accept_workspace_invite_by_token");
  } finally {
    await limitedDs.destroy();
  }
});

test("reuse invite token after successful accept -> 404 INVITE_NOT_FOUND", async () => {
  if (skip()) {
    return;
  }

  await ctx.db!.insertPendingWorkspaceInvite({
    tenantId: TENANT_A,
    email: INVITEE_EMAIL,
    role: UserRole.Member,
    inviteToken: TOKEN_REUSE_FLOW,
    invitedByUserId: ownerUserId,
  });
  assert.equal(await ctx.db!.countWorkspaceInvitesByToken(TOKEN_REUSE_FLOW), 1);

  const first = await request(ctx.app!.getHttpServer())
    .post(`/api/v2/invites/${TOKEN_REUSE_FLOW}/accept`)
    .set("Authorization", `Bearer ${tokenInviteeHome}`);
  assert.equal(first.status, 200);
  assert.equal(await ctx.db!.countWorkspaceInvitesByToken(TOKEN_REUSE_FLOW), 0);

  const second = await request(ctx.app!.getHttpServer())
    .post(`/api/v2/invites/${TOKEN_REUSE_FLOW}/accept`)
    .set("Authorization", `Bearer ${tokenInviteeHome}`);
  assert.equal(second.status, 404);
  assert.equal(second.body.error?.code, "INVITE_NOT_FOUND");
  assertApiErrorEnvelope(second.body);
});

test("accept with mismatched authenticated email -> 403 INVITE_EMAIL_MISMATCH; invite kept", async () => {
  if (skip()) {
    return;
  }

  await ctx.db!.insertPendingWorkspaceInvite({
    tenantId: TENANT_A,
    email: INVITEE_EMAIL,
    role: UserRole.Member,
    inviteToken: TOKEN_MISMATCH,
    invitedByUserId: ownerUserId,
  });
  assert.equal(await ctx.db!.countWorkspaceInvitesByToken(TOKEN_MISMATCH), 1);

  const response = await request(ctx.app!.getHttpServer())
    .post(`/api/v2/invites/${TOKEN_MISMATCH}/accept`)
    .set("Authorization", `Bearer ${tokenOtherUser}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.error?.code, "INVITE_EMAIL_MISMATCH");
  assertApiErrorEnvelope(response.body);
  assert.equal(await ctx.db!.countWorkspaceInvitesByToken(TOKEN_MISMATCH), 1);
});

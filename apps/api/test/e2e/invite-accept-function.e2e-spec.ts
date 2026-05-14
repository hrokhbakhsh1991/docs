import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import * as argon2 from "argon2";
import request, { type Response } from "supertest";
import { DataSource } from "typeorm";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer
} from "@testcontainers/postgresql";
import { assignTestApiPort } from "./assign-test-api-port";
import { createE2EApp } from "./bootstrap";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import { webSessionOtpToken } from "./web-session-otp.helper";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./jwt-test-keys";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";

const TENANT_A = "b4b4b4b4-b4b4-44b4-84b4-b4b4b4b4b4b4";
const TENANT_B = "b5b5b5b5-b5b5-45b5-85b5-b5b5b5b5b5b5";

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

const RETRYABILITY_VALUES = new Set([
  "NO_RETRY",
  "SAFE_RETRY",
  "RETRY_WITH_BACKOFF",
  "RETRY_AFTER_ACTION"
]);

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let tokenInviteeHome = "";
let tokenOtherUser = "";
let ownerUserId = "";

function applyEnvForContainer(db: StartedPostgreSqlContainer): void {
  process.env.NODE_ENV = "test";
  assignTestApiPort();
  process.env.LOG_LEVEL = "error";
  process.env.DATABASE_HOST = db.getHost();
  process.env.DATABASE_PORT = String(db.getPort());
  process.env.DATABASE_USER = db.getUsername();
  process.env.DATABASE_PASSWORD = db.getPassword();
  process.env.DATABASE_NAME = db.getDatabase();
  process.env.DATABASE_URL = db.getConnectionUri();
  process.env.JWT_PRIVATE_KEY = E2E_JWT_PRIVATE_KEY_PKCS8;
  process.env.JWT_PUBLIC_KEY = E2E_JWT_PUBLIC_KEY_SPKI;
  process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "test-issuer";
  process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "test-audience";
  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "test-token";
  process.env.REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
  process.env.REDIS_PORT = process.env.REDIS_PORT ?? "6379";
  process.env.OUTBOX_POLL_INTERVAL_MS = "5000";
  process.env.OUTBOX_MAX_RETRY = "5";
  process.env.OUTBOX_BATCH_SIZE = "50";
  process.env.OUTBOX_PROCESSOR_ENABLED = "false";
  process.env.RECONCILIATION_ENABLED = "false";
  process.env.RECONCILIATION_INTERVAL_MS = "600000";
  process.env.PAYMENTS_TIMEOUT_ENABLED = "false";
  process.env.PAYMENTS_TIMEOUT_INTERVAL_MS = "60000";
  process.env.INTERNAL_API_KEY = INTERNAL_API_KEY;
}

function assertErrorEnvelope(response: Response): void {
  assert.equal(typeof response.body, "object");
  assert.equal(typeof response.body.requestId, "string");
  assert.equal(typeof response.body.error, "object");
  assert.equal(typeof response.body.error.code, "string");
  assert.equal(typeof response.body.error.message, "string");
  assert.equal(typeof response.body.error.correlationId, "string");
  assert.equal(typeof response.body.error.details, "object");
  assert.equal(typeof response.body.error.retryability, "string");
  assert.equal(RETRYABILITY_VALUES.has(response.body.error.retryability), true);
}

async function inviteCountByToken(ds: DataSource, token: string): Promise<number> {
  const rows = await ds.query<{ c: string }[]>(
    `SELECT COUNT(*)::text AS c FROM workspace_invites WHERE token = $1`,
    [token]
  );
  return Number(rows[0]?.c ?? "0");
}

async function insertWorkspaceInvite(
  ds: DataSource,
  params: {
    token: string;
    tenantId: string;
    email: string;
    role: string;
    createdBy: string;
  }
): Promise<void> {
  await ds.query(
    `INSERT INTO workspace_invites (id, tenant_id, email, role, token, expires_at, created_by)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, now() + interval '7 days', $6::uuid)`,
    [randomUUID(), params.tenantId, params.email.trim().toLowerCase(), params.role, params.token, params.createdBy]
  );
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);

  await tenantRepo.insert([
    {
      id: TENANT_A,
      name: "Tenant A (invite accept)",
      description: "invite-accept-function e2e",
      subdomain: "invacc-a"
    },
    {
      id: TENANT_B,
      name: "Tenant B (invitee home)",
      description: "invite-accept-function e2e",
      subdomain: "invacc-b"
    }
  ]);

  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);
  const owner = await userRepo.save(
    userRepo.create({
      email: OWNER_EMAIL,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Owner",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  ownerUserId = owner.id;
  const invitee = await userRepo.save(
    userRepo.create({
      email: INVITEE_EMAIL,
      phone: INVITEE_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Invitee",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  const other = await userRepo.save(
    userRepo.create({
      email: OTHER_EMAIL,
      phone: OTHER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Other",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  await membershipRepo.save([
    membershipRepo.create({
      tenantId: TENANT_A,
      userId: owner.id,
      role: UserRole.Owner
    }),
    membershipRepo.create({
      tenantId: TENANT_B,
      userId: owner.id,
      role: UserRole.Owner
    }),
    membershipRepo.create({
      tenantId: TENANT_B,
      userId: invitee.id,
      role: UserRole.Member
    }),
    membershipRepo.create({
      tenantId: TENANT_B,
      userId: other.id,
      role: UserRole.Member
    })
  ]);

  await insertWorkspaceInvite(ds, {
    token: TOKEN_ACCEPT_OK,
    tenantId: TENANT_A,
    email: INVITEE_EMAIL,
    role: UserRole.Member,
    createdBy: owner.id
  });
}

async function ensureLimitedDbRole(ds: DataSource): Promise<void> {
  if (!container) {
    return;
  }
  const dbName = container.getDatabase();
  const safeDb = dbName.replace(/"/g, '""');
  await ds.query(`DROP ROLE IF EXISTS ${LIMITED_DB_ROLE}`);
  await ds.query(
    `CREATE ROLE ${LIMITED_DB_ROLE} LOGIN PASSWORD '${LIMITED_DB_PASSWORD.replace(/'/g, "''")}' NOSUPERUSER NOCREATEDB NOINHERIT`
  );
  await ds.query(`GRANT CONNECT ON DATABASE "${safeDb}" TO ${LIMITED_DB_ROLE}`);
  await ds.query(`GRANT USAGE ON SCHEMA public TO ${LIMITED_DB_ROLE}`);
}

before(async () => {
  try {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
  } catch (error: unknown) {
    e2eUnavailableReason = `testcontainers unavailable: ${String(error)}`;
    return;
  }
  applyEnvForContainer(container);
  await resetTestDatabaseWithMigrations();
  app = await createE2EApp();
  const ds = app.get(DataSource);
  await seed(ds);
  await ensureLimitedDbRole(ds);

  tokenInviteeHome = await webSessionOtpToken(app, { phone: INVITEE_PHONE, tenantSubdomain: "invacc-b" });
  tokenOtherUser = await webSessionOtpToken(app, { phone: OTHER_PHONE, tenantSubdomain: "invacc-b" });
});

after(async () => {
  if (app) {
    const ds = app.get(DataSource);
    try {
      await ds.query(`DROP ROLE IF EXISTS ${LIMITED_DB_ROLE}`);
    } catch {
      /* ignore */
    }
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("POST /api/v2/invites/:token/accept with valid token -> 200, invite row removed", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  assert.equal(await inviteCountByToken(ds, TOKEN_ACCEPT_OK), 1);

  const response = await request(app.getHttpServer())
    .post(`/api/v2/invites/${TOKEN_ACCEPT_OK}/accept`)
    .set("Authorization", `Bearer ${tokenInviteeHome}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.tenant_id, TENANT_A);
  assert.equal(response.body.role, UserRole.Member);
  assert.equal(await inviteCountByToken(ds, TOKEN_ACCEPT_OK), 0);

  const inviteeUser = await ds.getRepository(UserEntity).findOneOrFail({ where: { email: INVITEE_EMAIL } });
  const membership = await ds.getRepository(UserTenantEntity).findOne({
    where: { userId: inviteeUser.id, tenantId: TENANT_A }
  });
  assert.equal(Boolean(membership), true);
  assert.equal(membership?.deletedAt, null);
});

test("direct SELECT accept_workspace_invite_by_token as non-app DB role -> permission denied", async () => {
  if (e2eUnavailableReason || !container) {
    return;
  }
  const limitedDs = new DataSource({
    type: "postgres",
    host: container.getHost(),
    port: container.getPort(),
    username: LIMITED_DB_ROLE,
    password: LIMITED_DB_PASSWORD,
    database: container.getDatabase(),
    synchronize: false
  });
  await limitedDs.initialize();
  try {
    await limitedDs.query(
      `SELECT ok, error_code FROM accept_workspace_invite_by_token($1::text, $2::uuid, $3::text)`,
      [TOKEN_REUSE_FLOW, randomUUID(), "noop@example.com"]
    );
    assert.fail("expected insufficient_privilege for non-granted role");
  } catch (err: unknown) {
    assert.ok(err instanceof Error);
    const pgErr = err as { code?: string; driverError?: { code?: string }; message?: string };
    const code = pgErr.driverError?.code ?? pgErr.code;
    assert.equal(code, "42501", pgErr.message);
  } finally {
    await limitedDs.destroy();
  }
});

test("reuse invite token after successful accept -> 404 INVITE_NOT_FOUND", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  await insertWorkspaceInvite(ds, {
    token: TOKEN_REUSE_FLOW,
    tenantId: TENANT_A,
    email: INVITEE_EMAIL,
    role: UserRole.Member,
    createdBy: ownerUserId
  });
  assert.equal(await inviteCountByToken(ds, TOKEN_REUSE_FLOW), 1);

  const first = await request(app.getHttpServer())
    .post(`/api/v2/invites/${TOKEN_REUSE_FLOW}/accept`)
    .set("Authorization", `Bearer ${tokenInviteeHome}`);
  assert.equal(first.status, 200);
  assert.equal(await inviteCountByToken(ds, TOKEN_REUSE_FLOW), 0);

  const second = await request(app.getHttpServer())
    .post(`/api/v2/invites/${TOKEN_REUSE_FLOW}/accept`)
    .set("Authorization", `Bearer ${tokenInviteeHome}`);
  assert.equal(second.status, 404);
  assert.equal(second.body.error?.code, "INVITE_NOT_FOUND");
  assertErrorEnvelope(second);
});

test("accept with mismatched authenticated email -> 403 INVITE_EMAIL_MISMATCH; invite kept", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  await insertWorkspaceInvite(ds, {
    token: TOKEN_MISMATCH,
    tenantId: TENANT_A,
    email: INVITEE_EMAIL,
    role: UserRole.Member,
    createdBy: ownerUserId
  });
  assert.equal(await inviteCountByToken(ds, TOKEN_MISMATCH), 1);

  const response = await request(app.getHttpServer())
    .post(`/api/v2/invites/${TOKEN_MISMATCH}/accept`)
    .set("Authorization", `Bearer ${tokenOtherUser}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.error?.code, "INVITE_EMAIL_MISMATCH");
  assertErrorEnvelope(response);
  assert.equal(await inviteCountByToken(ds, TOKEN_MISMATCH), 1);
});

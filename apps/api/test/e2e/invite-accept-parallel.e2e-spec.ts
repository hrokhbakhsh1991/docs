import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import * as argon2 from "argon2";
import request from "supertest";
import { DataSource, IsNull } from "typeorm";
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
import { Role } from "../../src/modules/auth/roles.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";

const TENANT_A = "c6c6c6c6-c6c6-46c6-86c6-c6c6c6c6c6c6";
const TENANT_B = "c7c7c7c7-c7c7-47c7-87c7-c7c7c7c7c7c7";

const OWNER_EMAIL = "owner@invite-parallel.test";
const INVITEE_EMAIL = "invitee@invite-parallel.test";
const OWNER_PHONE = "+15557900001";
const INVITEE_PHONE = "+15557900002";

const TOKEN_PARALLEL = "3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let tokenInvitee = "";

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
  process.env.INTERNAL_API_KEY = "test-internal-key-invite-parallel";
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

async function inviteCountByToken(ds: DataSource, token: string): Promise<number> {
  const rows = await ds.query<{ c: string }[]>(
    `SELECT COUNT(*)::text AS c FROM workspace_invites WHERE token = $1`,
    [token]
  );
  return Number(rows[0]?.c ?? "0");
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);

  await tenantRepo.insert([
    {
      id: TENANT_A,
      name: "Tenant A (parallel invite)",
      description: "invite-parallel e2e",
      subdomain: "invpar-a"
    },
    {
      id: TENANT_B,
      name: "Tenant B (invitee home)",
      description: "invite-parallel e2e",
      subdomain: "invpar-b"
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

  await membershipRepo.save([
    membershipRepo.create({
      tenantId: TENANT_A,
      userId: owner.id,
      role: Role.OWNER
    }),
    membershipRepo.create({
      tenantId: TENANT_B,
      userId: owner.id,
      role: Role.OWNER
    }),
    membershipRepo.create({
      tenantId: TENANT_B,
      userId: invitee.id,
      role: Role.MEMBER
    })
  ]);

  await insertWorkspaceInvite(ds, {
    token: TOKEN_PARALLEL,
    tenantId: TENANT_A,
    email: INVITEE_EMAIL,
    role: Role.MEMBER,
    createdBy: owner.id
  });
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
  tokenInvitee = await webSessionOtpToken(app, { phone: INVITEE_PHONE, tenantSubdomain: "invpar-b" });
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("two parallel accept attempts for the same invite: one succeeds, invite removed once", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  assert.equal(await inviteCountByToken(ds, TOKEN_PARALLEL), 1);

  const url = `/api/v2/invites/${TOKEN_PARALLEL}/accept`;
  const [a, b] = await Promise.all([
    request(app.getHttpServer()).post(url).set("Authorization", `Bearer ${tokenInvitee}`),
    request(app.getHttpServer()).post(url).set("Authorization", `Bearer ${tokenInvitee}`)
  ]);

  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [200, 404]);

  assert.equal(await inviteCountByToken(ds, TOKEN_PARALLEL), 0);

  const invitee = await ds.getRepository(UserEntity).findOneOrFail({ where: { email: INVITEE_EMAIL } });
  const memberships = await ds.getRepository(UserTenantEntity).find({
    where: { userId: invitee.id, tenantId: TENANT_A, deletedAt: IsNull() }
  });
  assert.equal(memberships.length, 1);
  assert.equal(memberships[0]?.role, Role.MEMBER);
});

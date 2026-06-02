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
import { WorkspaceInviteEntity } from "../../src/modules/identity/entities/workspace-invite.entity";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";

const TENANT_A = "c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3";

const OWNER_EMAIL = "owner@invite-role-hierarchy.test";
const ADMIN_EMAIL = "admin@invite-role-hierarchy.test";
const MEMBER_EMAIL = "member@invite-role-hierarchy.test";
const OWNER_PHONE = "+15558000001";
const ADMIN_PHONE = "+15558000002";
const MEMBER_PHONE = "+15558000003";

const INTERNAL_API_KEY = "test-internal-key-invite-role-hierarchy";

const RETRYABILITY_VALUES = new Set([
  "NO_RETRY",
  "SAFE_RETRY",
  "RETRY_WITH_BACKOFF",
  "RETRY_AFTER_ACTION"
]);

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let tokenOwner = "";
let tokenAdmin = "";
let tokenMember = "";

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

async function inviteCountForEmail(
  ds: DataSource,
  tenantId: string,
  email: string
): Promise<number> {
  return ds.getRepository(WorkspaceInviteEntity).count({
    where: { tenantId, email: email.trim().toLowerCase() }
  });
}

async function seedTenantAndUsers(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);

  await tenantRepo.insert({
    id: TENANT_A,
    name: "Tenant A (invite hierarchy)",
    description: "invite-role-hierarchy e2e",
    subdomain: "invite-rh"
  });

  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);
  const owner = await userRepo.save(
    userRepo.create({
      email: OWNER_EMAIL,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Owner User",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  const admin = await userRepo.save(
    userRepo.create({
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Admin User",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  const member = await userRepo.save(
    userRepo.create({
      email: MEMBER_EMAIL,
      phone: MEMBER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Member User",
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
      tenantId: TENANT_A,
      userId: admin.id,
      role: UserRole.Admin
    }),
    membershipRepo.create({
      tenantId: TENANT_A,
      userId: member.id,
      role: UserRole.Member
    })
  ]);
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
  await seedTenantAndUsers(app.get(DataSource));

  tokenOwner = await webSessionOtpToken(app, { phone: OWNER_PHONE, tenantSubdomain: "invite-rh" });
  tokenAdmin = await webSessionOtpToken(app, { phone: ADMIN_PHONE, tenantSubdomain: "invite-rh" });
  tokenMember = await webSessionOtpToken(app, { phone: MEMBER_PHONE, tenantSubdomain: "invite-rh" });
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("role=owner invite is rejected by validation (400; no workspace_invites row)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const inviteeEmail = `hierarchy-block-owner-${randomUUID()}@example.com`;
  assert.equal(await inviteCountForEmail(ds, TENANT_A, inviteeEmail), 0);

  const response = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/${TENANT_A}/invites`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ email: inviteeEmail, role: "owner" });

  assert.equal(response.status, 400);
  assertErrorEnvelope(response);
  assert.equal(response.body.error?.code, "VALIDATION_FAILED");
  assert.equal(await inviteCountForEmail(ds, TENANT_A, inviteeEmail), 0);
});

test("admin can invite member (201; row persisted)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const inviteeEmail = `hierarchy-ok-member-${randomUUID()}@example.com`;
  assert.equal(await inviteCountForEmail(ds, TENANT_A, inviteeEmail), 0);

  const response = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/${TENANT_A}/invites`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ email: inviteeEmail, role: "member" });

  assert.equal(response.status, 201);
  assert.equal(typeof response.body.id, "string");
  assert.equal(response.body.role, "member");
  assert.equal(response.body.email, inviteeEmail.toLowerCase());
  assert.equal(await inviteCountForEmail(ds, TENANT_A, inviteeEmail), 1);
});

test("owner can invite admin (201; row persisted)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const inviteeEmail = `hierarchy-ok-admin-${randomUUID()}@example.com`;
  assert.equal(await inviteCountForEmail(ds, TENANT_A, inviteeEmail), 0);

  const response = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/${TENANT_A}/invites`)
    .set("Authorization", `Bearer ${tokenOwner}`)
    .send({ email: inviteeEmail, role: "admin" });

  assert.equal(response.status, 201);
  assert.equal(response.body.role, "admin");
  assert.equal(response.body.email, inviteeEmail.toLowerCase());
  assert.equal(await inviteCountForEmail(ds, TENANT_A, inviteeEmail), 1);
});

test("admin can invite viewer (201)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const inviteeEmail = `hierarchy-ok-viewer-${randomUUID()}@example.com`;
  assert.equal(await inviteCountForEmail(ds, TENANT_A, inviteeEmail), 0);

  const response = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/${TENANT_A}/invites`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ email: inviteeEmail, role: "viewer" });

  assert.equal(response.status, 201);
  assert.equal(response.body.role, "viewer");
  assert.equal(await inviteCountForEmail(ds, TENANT_A, inviteeEmail), 1);
});

test("member cannot invite anyone (403; no workspace_invites row)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const inviteeEmail = `hierarchy-block-member-${randomUUID()}@example.com`;
  assert.equal(await inviteCountForEmail(ds, TENANT_A, inviteeEmail), 0);

  const response = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/${TENANT_A}/invites`)
    .set("Authorization", `Bearer ${tokenMember}`)
    .send({ email: inviteeEmail, role: "member" });

  assert.equal(response.status, 403);
  assertErrorEnvelope(response);
  assert.equal(response.body.error?.code, "AUTH_FORBIDDEN_ROLE");
  assert.match(
    String(response.body.error?.message),
    /Insufficient role/i,
    "expected RolesGuard denial for member"
  );
  assert.equal(await inviteCountForEmail(ds, TENANT_A, inviteeEmail), 0);
});

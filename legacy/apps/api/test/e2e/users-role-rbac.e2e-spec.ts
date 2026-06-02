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
import {
  RBAC_INSUFFICIENT_ROLE_PRIVILEGE,
  RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN,
  RBAC_SELF_ROLE_CHANGE_FORBIDDEN
} from "../../src/common/rbac/workspace-membership-rbac.policy";

const TENANT_ID = "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4";
const OTHER_TENANT = "e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5";

const OWNER_EMAIL = "owner@users-role-rbac.test";
const ADMIN_EMAIL = "admin@users-role-rbac.test";
const MEMBER_EMAIL = "member@users-role-rbac.test";
const OTHER_MEMBER_EMAIL = "othermember@users-role-rbac.test";
const OWNER_PHONE = "+15557200001";
const ADMIN_PHONE = "+15557200002";
const MEMBER_PHONE = "+15557200003";
const OTHER_MEMBER_PHONE = "+15557200004";

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
let memberUserId = "";
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
  process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
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
  process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "test-internal-key-users-rbac";
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

async function otpSession(phone: string, tenantSlug: string): Promise<string> {
  if (!app) {
    throw new Error("app not initialized");
  }
  return webSessionOtpToken(app, { phone, tenantSubdomain: tenantSlug });
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);

  await tenantRepo.insert([
    {
      id: TENANT_ID,
      name: "Users RBAC tenant",
      description: "users-role-rbac e2e",
      subdomain: "rbac-main"
    },
    {
      id: OTHER_TENANT,
      name: "Other tenant",
      description: "cross-tenant isolation",
      subdomain: "rbac-other"
    }
  ]);

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
  const admin = await userRepo.save(
    userRepo.create({
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Admin",
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
      fullName: "Member",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  memberUserId = member.id;
  const otherMember = await userRepo.save(
    userRepo.create({
      email: OTHER_MEMBER_EMAIL,
      phone: OTHER_MEMBER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Other",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  await membershipRepo.save([
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: owner.id,
      role: UserRole.Owner
    }),
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: admin.id,
      role: UserRole.Admin
    }),
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: member.id,
      role: UserRole.Member
    }),
    membershipRepo.create({
      tenantId: OTHER_TENANT,
      userId: owner.id,
      role: UserRole.Owner
    }),
    membershipRepo.create({
      tenantId: OTHER_TENANT,
      userId: otherMember.id,
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
  await seed(app.get(DataSource));

  tokenOwner = await otpSession(OWNER_PHONE, "rbac-main");
  tokenAdmin = await otpSession(ADMIN_PHONE, "rbac-main");
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("PATCH users: admin cannot change own role (403 RBAC_SELF)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const admin = await ds.getRepository(UserEntity).findOneOrFail({
    where: { email: ADMIN_EMAIL }
  });
  const res = await request(app.getHttpServer())
    .patch(`/api/v2/users/${admin.id}`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ role: "member" });
  assert.equal(res.status, 403);
  assertErrorEnvelope(res);
  assert.equal(res.body.error.code, RBAC_SELF_ROLE_CHANGE_FORBIDDEN);
});

test("PATCH users: admin cannot modify owner membership (403 RBAC_PROTECTED)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .patch(`/api/v2/users/${ownerUserId}`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ role: "member" });
  assert.equal(res.status, 403);
  assertErrorEnvelope(res);
  assert.equal(res.body.error.code, RBAC_PROTECTED_ROLE_MODIFICATION_FORBIDDEN);
});

test("PATCH users: body role=owner rejected by validation (400)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .patch(`/api/v2/users/${memberUserId}`)
    .set("Authorization", `Bearer ${tokenOwner}`)
    .send({ role: "owner" });
  assert.equal(res.status, 400);
  assertErrorEnvelope(res);
  assert.equal(res.body.error.code, "VALIDATION_FAILED");
});

test("PATCH users: owner can change member to viewer (200); increments session_version", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const before = await ds.getRepository(UserTenantEntity).findOneOrFail({
    where: { tenantId: TENANT_ID, userId: memberUserId }
  });
  const svBefore = before.sessionVersion;

  const res = await request(app.getHttpServer())
    .patch(`/api/v2/users/${memberUserId}`)
    .set("Authorization", `Bearer ${tokenOwner}`)
    .send({ role: "viewer" });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.role, "viewer");

  const after = await ds.getRepository(UserTenantEntity).findOneOrFail({
    where: { tenantId: TENANT_ID, userId: memberUserId }
  });
  assert.equal(after.sessionVersion, svBefore + 1);
});

test("PATCH users: after role change old JWT is AUTH_TOKEN_REVOKED", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const member = await ds.getRepository(UserEntity).findOneOrFail({
    where: { email: MEMBER_EMAIL }
  });
  const ut = await ds.getRepository(UserTenantEntity).findOneOrFail({
    where: { tenantId: TENANT_ID, userId: member.id }
  });
  const oldToken = await otpSession(MEMBER_PHONE, "rbac-main");
  const newRole = ut.role === "viewer" ? "member" : "viewer";

  const patch = await request(app.getHttpServer())
    .patch(`/api/v2/users/${member.id}`)
    .set("Authorization", `Bearer ${tokenOwner}`)
    .send({ role: newRole });
  assert.equal(patch.status, 200);

  const tours = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .set("Authorization", `Bearer ${oldToken}`);
  assert.equal(tours.status, 401);
  assert.equal(tours.body?.error?.code, "AUTH_TOKEN_REVOKED");
  assertErrorEnvelope(tours);
});

test("PATCH users: unknown user id in tenant returns 404", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .patch(`/api/v2/users/${randomUUID()}`)
    .set("Authorization", `Bearer ${tokenOwner}`)
    .send({ role: "member" });
  assert.equal(res.status, 404);
  assertErrorEnvelope(res);
});

test("PATCH users: invalid path uuid is rejected by validation (400)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .patch("/api/v2/users/not-a-uuid")
    .set("Authorization", `Bearer ${tokenOwner}`)
    .send({ role: "member" });
  assert.equal(res.status, 400);
  assertErrorEnvelope(res);
  assert.equal(res.body.error.code, "VALIDATION_FAILED");
});

test("PATCH users: member token cannot call endpoint (403 RolesGuard)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const memberTokenFresh = await otpSession(MEMBER_PHONE, "rbac-main");
  const res = await request(app.getHttpServer())
    .patch(`/api/v2/users/${memberUserId}`)
    .set("Authorization", `Bearer ${memberTokenFresh}`)
    .send({ role: "member" });
  assert.equal(res.status, 403);
  assertErrorEnvelope(res);
  assert.equal(res.body.error.code, "AUTH_FORBIDDEN_ROLE");
});

test("POST workspace invite: role=owner is rejected by validation (400)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const email = `rbac-invite-owner-${randomUUID()}@example.com`;
  const res = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/${TENANT_ID}/invites`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ email, role: "owner" });
  assert.equal(res.status, 400);
  assertErrorEnvelope(res);
  assert.equal(res.body.error.code, "VALIDATION_FAILED");
});

test("POST workspace invite: admin can invite viewer (201)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const email = `rbac-invite-viewer-${randomUUID()}@example.com`;
  const res = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/${TENANT_ID}/invites`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ email, role: "viewer" });
  assert.equal(res.status, 201);
  assert.equal(res.body.role, "viewer");
});

test("PATCH users: admin cannot assign admin to peer (403 RBAC_INSUFFICIENT)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const extra = await ds.getRepository(UserEntity).save(
    ds.getRepository(UserEntity).create({
      email: `extra-admin-${randomUUID()}@users-role-rbac.test`,
      phone: `+15557299${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`,
      isPhoneVerified: true,
      hashedPassword: await argon2.hash(`fixture-${randomUUID()}`),
      fullName: "Extra Admin",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  await ds.getRepository(UserTenantEntity).save(
    ds.getRepository(UserTenantEntity).create({
      tenantId: TENANT_ID,
      userId: extra.id,
      role: UserRole.Admin
    })
  );

  const res = await request(app.getHttpServer())
    .patch(`/api/v2/users/${extra.id}`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ role: "member" });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, RBAC_INSUFFICIENT_ROLE_PRIVILEGE);
});

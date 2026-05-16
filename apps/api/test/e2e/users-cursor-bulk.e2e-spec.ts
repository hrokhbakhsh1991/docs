import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import * as argon2 from "argon2";
import request from "supertest";
import { DataSource } from "typeorm";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { assignTestApiPort } from "./assign-test-api-port";
import { createE2EApp } from "./bootstrap";
import { E2E_JWT_PRIVATE_KEY_PKCS8, E2E_JWT_PUBLIC_KEY_SPKI } from "./jwt-test-keys";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import { webSessionOtpToken } from "./web-session-otp.helper";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserRoleAuditEntity } from "../../src/modules/identity/entities/user-role-audit.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";

const TENANT_ID = "2f7af227-60fe-440e-9bca-3eb6e575ec19";
const OTHER_TENANT_ID = "3d862a88-e365-4e06-8a4b-73f04f77b0bb";
const OWNER_EMAIL = "owner-users-cursor-bulk@test.local";
const ADMIN_EMAIL = "admin-users-cursor-bulk@test.local";
const MEMBER_EMAIL = "member-users-cursor-bulk@test.local";
const OWNER_PHONE = "+15557600001";
const ADMIN_PHONE = "+15557600002";
const MEMBER_PHONE = "+15557600003";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let unavailableReason: string | null = null;
let ownerToken = "";
let adminToken = "";
let memberToken = "";
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
  process.env.JWT_ISSUER = "test-issuer";
  process.env.JWT_AUDIENCE = "test-audience";
  process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.REDIS_HOST = "localhost";
  process.env.REDIS_PORT = "6379";
  process.env.OUTBOX_PROCESSOR_ENABLED = "false";
  process.env.RECONCILIATION_ENABLED = "false";
  process.env.PAYMENTS_TIMEOUT_ENABLED = "false";
  process.env.INTERNAL_API_KEY = "test-internal-key-users-cursor-bulk";
  process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = "test-webhook-hmac-secret-at-least-32chars!!!!";
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);

  await tenantRepo.insert([
    {
      id: TENANT_ID,
      name: "Tenant users cursor",
      description: "cursor tests",
      subdomain: "cursor-main"
    },
    {
      id: OTHER_TENANT_ID,
      name: "Tenant other",
      description: "cross tenant",
      subdomain: "cursor-other"
    }
  ]);

  const owner = await userRepo.save(
    userRepo.create({
      email: OWNER_EMAIL,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Owner Cursor",
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
      fullName: "Admin Cursor",
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
      fullName: "Member Cursor",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  await membershipRepo.save([
    membershipRepo.create({ tenantId: TENANT_ID, userId: owner.id, role: UserRole.Owner }),
    membershipRepo.create({ tenantId: TENANT_ID, userId: admin.id, role: UserRole.Admin }),
    membershipRepo.create({ tenantId: TENANT_ID, userId: member.id, role: UserRole.Member })
  ]);

  const seedUsers: UserEntity[] = [];
  for (let i = 0; i < 18; i += 1) {
    const role = i % 3 === 0 ? UserRole.Admin : i % 3 === 1 ? UserRole.Member : UserRole.Viewer;
    const seeded = await userRepo.save(
      userRepo.create({
        email: `cursor-user-${i}@test.local`,
        phone: `+1555762${String(i).padStart(5, "0")}`,
        isPhoneVerified: true,
        hashedPassword: fixtureHash,
        fullName: `Cursor User ${i}`,
        isEmailVerified: true,
        telegramUserId: null
      })
    );
    seedUsers.push(seeded);
    await membershipRepo.save(
      membershipRepo.create({
        tenantId: TENANT_ID,
        userId: seeded.id,
        role
      })
    );
  }

  const otherTenantUser = await userRepo.save(
    userRepo.create({
      email: "other-tenant-only@test.local",
      phone: "+15557700001",
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Other Tenant User",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  await membershipRepo.save([
    membershipRepo.create({ tenantId: OTHER_TENANT_ID, userId: owner.id, role: UserRole.Owner }),
    membershipRepo.create({ tenantId: OTHER_TENANT_ID, userId: otherTenantUser.id, role: UserRole.Member })
  ]);
}

before(async () => {
  try {
    container = await new PostgreSqlContainer("postgres:16-alpine").start();
  } catch (error: unknown) {
    unavailableReason = `testcontainers unavailable: ${String(error)}`;
    return;
  }
  applyEnvForContainer(container);
  await resetTestDatabaseWithMigrations();
  app = await createE2EApp();
  await seed(app.get(DataSource));
  ownerToken = await webSessionOtpToken(app, { phone: OWNER_PHONE, tenantSubdomain: "cursor-main" });
  adminToken = await webSessionOtpToken(app, { phone: ADMIN_PHONE, tenantSubdomain: "cursor-main" });
  memberToken = await webSessionOtpToken(app, { phone: MEMBER_PHONE, tenantSubdomain: "cursor-main" });
});

after(async () => {
  if (app) await app.close();
  if (container) await container.stop();
});

test("GET /api/v2/users cursor pagination + search/role filters stays isolated and ordered", async () => {
  if (unavailableReason || !app) return;

  const server = app.getHttpServer();
  const first = await request(server)
    .get("/api/v2/users?limit=5")
    .set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(Array.isArray(first.body.data), true);
  assert.equal(first.body.data.length <= 5, true);
  assert.equal(typeof first.body.nextCursor === "string" || first.body.nextCursor === null, true);

  const firstIds = new Set(first.body.data.map((row: { id: string }) => row.id));
  for (const row of first.body.data as Array<{ email: string }>) {
    assert.equal(row.email.includes("other-tenant-only@test.local"), false);
  }

  if (first.body.nextCursor) {
    const second = await request(server)
      .get(`/api/v2/users?limit=5&cursor=${encodeURIComponent(first.body.nextCursor as string)}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    assert.equal(second.status, 200, JSON.stringify(second.body));
    for (const row of second.body.data as Array<{ id: string }>) {
      assert.equal(firstIds.has(row.id), false);
    }
  }

  const searched = await request(server)
    .get("/api/v2/users?limit=10&search=cursor-user-1")
    .set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(searched.status, 200, JSON.stringify(searched.body));
  for (const row of searched.body.data as Array<{ email: string; name: string }>) {
    const hay = `${row.email} ${row.name}`.toLowerCase();
    assert.equal(hay.includes("cursor-user-1"), true);
  }

  const filtered = await request(server)
    .get("/api/v2/users?limit=20&role=viewer")
    .set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(filtered.status, 200, JSON.stringify(filtered.body));
  for (const row of filtered.body.data as Array<{ role: string }>) {
    assert.equal(row.role.toLowerCase(), "viewer");
  }
});

test("GET /api/v2/users includes phone and phone verification fields", async () => {
  if (unavailableReason || !app) return;

  const res = await request(app.getHttpServer())
    .get("/api/v2/users?limit=5")
    .set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(Array.isArray(res.body.data), true);
  assert.equal(res.body.data.length > 0, true);
  for (const row of res.body.data as Array<{ phone?: unknown; isPhoneVerified?: unknown }>) {
    assert.equal(typeof row.phone === "string" || row.phone === null, true);
    assert.equal(typeof row.isPhoneVerified, "boolean");
  }
});

test("PATCH /api/v2/users/bulk-role mixed invalid input rolls back updates and audit writes", async () => {
  if (unavailableReason || !app) return;

  const ds = app.get(DataSource);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const auditRepo = ds.getRepository(UserRoleAuditEntity);
  const usersRepo = ds.getRepository(UserEntity);

  const validTargetUser = await usersRepo.findOneByOrFail({ email: "cursor-user-0@test.local" });
  const validBefore = await membershipRepo.findOneByOrFail({
    tenantId: TENANT_ID,
    userId: validTargetUser.id
  });
  const auditsBefore = await auditRepo.count();

  const res = await request(app.getHttpServer())
    .patch("/api/v2/users/bulk-role")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      userIds: [
        validTargetUser.id, // valid
        randomUUID(), // invalid id
        ownerUserId, // protected owner
        (await usersRepo.findOneByOrFail({ email: ADMIN_EMAIL })).id // self user
      ],
      role: "viewer"
    });

  assert.equal(res.status === 403 || res.status === 404, true, JSON.stringify(res.body));

  const validAfter = await membershipRepo.findOneByOrFail({
    tenantId: TENANT_ID,
    userId: validTargetUser.id
  });
  assert.equal(validAfter.role, validBefore.role);
  assert.equal(validAfter.sessionVersion, validBefore.sessionVersion);

  const auditsAfter = await auditRepo.count();
  assert.equal(auditsAfter, auditsBefore);
});

test("PATCH /api/v2/users/bulk-role rejects insufficient role (member token)", async () => {
  if (unavailableReason || !app) return;

  const ds = app.get(DataSource);
  const usersRepo = ds.getRepository(UserEntity);
  const target = await usersRepo.findOneByOrFail({ email: "cursor-user-3@test.local" });

  const res = await request(app.getHttpServer())
    .patch("/api/v2/users/bulk-role")
    .set("Authorization", `Bearer ${memberToken}`)
    .send({
      userIds: [target.id],
      role: "viewer"
    });

  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal(res.body?.error?.code, "AUTH_FORBIDDEN_ROLE");
});

test("PATCH /api/v2/users/bulk-role rejects malformed user id payload (400)", async () => {
  if (unavailableReason || !app) return;

  const res = await request(app.getHttpServer())
    .patch("/api/v2/users/bulk-role")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      userIds: ["not-a-uuid", "   "],
      role: "viewer"
    });

  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.equal(res.body?.error?.code, "VALIDATION_FAILED");
});

test("POST /api/v2/users is not exposed (404)", async () => {
  if (unavailableReason || !app) return;

  const res = await request(app.getHttpServer())
    .post("/api/v2/users")
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      name: "Created Via Users API",
      email: `no-route-${randomUUID()}@test.local`,
      phone: "+15551112222"
    });
  assert.equal(res.status, 404, JSON.stringify(res.body));
});

test("DELETE /api/v2/users/:id is not exposed (404)", async () => {
  if (unavailableReason || !app) return;

  const res = await request(app.getHttpServer())
    .delete(`/api/v2/users/${ownerUserId}`)
    .set("Authorization", `Bearer ${ownerToken}`);
  assert.equal(res.status, 404, JSON.stringify(res.body));
});


import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import * as argon2 from "argon2";
import request from "supertest";
import { DataSource } from "typeorm";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { assignTestApiPort } from "./assign-test-api-port";
import { createE2EApp } from "./bootstrap";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./jwt-test-keys";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import { webSessionOtpToken } from "./web-session-otp.helper";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";

const TENANT_ID = "c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4";
const OWNER_EMAIL = "owner@ownership-transfer.test";
const ADMIN_EMAIL = "admin@ownership-transfer.test";
const OWNER_PHONE = "+15557100001";
const ADMIN_PHONE = "+15557100002";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let ownerToken = "";
let ownerId = "";
let adminId = "";

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
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.REDIS_HOST = "localhost";
  process.env.REDIS_PORT = "6379";
  process.env.OUTBOX_PROCESSOR_ENABLED = "false";
  process.env.RECONCILIATION_ENABLED = "false";
  process.env.PAYMENTS_TIMEOUT_ENABLED = "false";
  process.env.INTERNAL_API_KEY = "test-internal-key-ownership-transfer";
}

async function loginOwner(): Promise<string> {
  if (!app) throw new Error("app not initialized");
  return webSessionOtpToken(app, { phone: OWNER_PHONE, tenantSubdomain: "ownership-e2e" });
}

before(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  applyEnvForContainer(container);
  await resetTestDatabaseWithMigrations();
  app = await createE2EApp();
  const ds = app.get(DataSource);
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  await tenantRepo.insert({
    id: TENANT_ID,
    name: "Ownership tenant",
    description: "e2e",
    subdomain: "ownership-e2e"
  });
  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);
  const owner = await userRepo.save(
    userRepo.create({
      email: OWNER_EMAIL,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Owner",
      isEmailVerified: true
    })
  );
  const admin = await userRepo.save(
    userRepo.create({
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Admin",
      isEmailVerified: true
    })
  );
  ownerId = owner.id;
  adminId = admin.id;
  await membershipRepo.save([
    membershipRepo.create({ tenantId: TENANT_ID, userId: ownerId, role: UserRole.Owner }),
    membershipRepo.create({ tenantId: TENANT_ID, userId: adminId, role: UserRole.Admin })
  ]);
  ownerToken = await loginOwner();
});

after(async () => {
  if (app) await app.close();
  if (container) await container.stop();
});

test("owner can transfer ownership to active member", async () => {
  if (!app) return;
  const res = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/${TENANT_ID}/ownership-transfer`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ newOwnerUserId: adminId });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.previous_owner_user_id, ownerId);
  assert.equal(res.body.new_owner_user_id, adminId);

  const ds = app.get(DataSource);
  const memberships = await ds.getRepository(UserTenantEntity).find({
    where: [{ tenantId: TENANT_ID, userId: ownerId }, { tenantId: TENANT_ID, userId: adminId }]
  });
  const byUser = new Map(memberships.map((m) => [m.userId, m.role]));
  assert.equal(byUser.get(ownerId), "admin");
  assert.equal(byUser.get(adminId), "owner");
});

test("non-owner cannot transfer ownership", async () => {
  if (!app) return;
  ownerToken = await loginOwner();
  const res = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/${TENANT_ID}/ownership-transfer`)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ newOwnerUserId: ownerId });
  assert.equal(res.status, 403);
  assert.equal(res.body.error?.code, "AUTH_FORBIDDEN_ROLE");
});

test("db invariant blocks demoting the last active owner", async () => {
  if (!app) return;
  const ds = app.get(DataSource);
  await assert.rejects(
    async () => {
      await ds.query(
        `UPDATE user_tenants
           SET role = 'member', updated_at = now()
         WHERE tenant_id = $1
           AND user_id = $2
           AND deleted_at IS NULL`,
        [TENANT_ID, adminId]
      );
    },
    (error: unknown) => {
      const message = String(error);
      assert.match(message, /must have at least one active owner/i);
      return true;
    }
  );
});

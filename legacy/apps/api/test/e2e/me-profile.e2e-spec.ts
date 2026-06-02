import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import * as argon2 from "argon2";
import request from "supertest";
import { DataSource } from "typeorm";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { assignTestApiPort } from "./assign-test-api-port";
import { createE2EApp } from "./bootstrap";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import { tenantTestHost } from "./tenant-test-host";
import { webSessionOtpToken } from "./web-session-otp.helper";
import { E2E_JWT_PRIVATE_KEY_PKCS8, E2E_JWT_PUBLIC_KEY_SPKI } from "./jwt-test-keys";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { MembershipStatus } from "../../src/modules/identity/membership-status.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";

const TENANT_ID = "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1";
const USER_EMAIL = "me-profile-e2e@example.test";
const USER_PHONE = "+15557300991";
const SUBDOMAIN = "meprof1";

const INTERNAL_API_KEY = "test-internal-key-me-profile-e2e";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let sessionToken = "";

function applyEnvForContainer(db: StartedPostgreSqlContainer): void {
  process.env.NODE_ENV = "test";
  process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
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
  process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET =
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET ?? "test-webhook-hmac-secret-at-least-32chars!!!!";
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);

  await tenantRepo.insert({
    id: TENANT_ID,
    name: "Me profile E2E tenant",
    description: "me-profile.e2e-spec",
    subdomain: SUBDOMAIN
  });

  const hashedPassword = await argon2.hash(`fixture-${USER_PHONE}`);
  await userRepo.save(
    userRepo.create({
      email: USER_EMAIL,
      phone: USER_PHONE,
      isPhoneVerified: true,
      hashedPassword,
      fullName: "E2E Me User",
      isEmailVerified: true,
      telegramUserId: null,
      notificationsEnabled: null
    })
  );

  const user = await userRepo.findOneOrFail({ where: { email: USER_EMAIL } });

  await membershipRepo.save(
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: user.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date()
    })
  );
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

  sessionToken = await webSessionOtpToken(app, { phone: USER_PHONE, tenantSubdomain: SUBDOMAIN });
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("GET /api/v2/me returns profile_row_version and weak ETag", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .get("/api/v2/me")
    .set("Host", tenantTestHost(SUBDOMAIN))
    .set("Authorization", `Bearer ${sessionToken}`);

  assert.equal(res.status, 200);
  assert.equal(typeof res.body.id, "string");
  assert.equal(res.body.email, USER_EMAIL);
  assert.equal(typeof res.body.profile_row_version, "number");
  assert.ok(res.body.profile_row_version >= 1);
  const etag = res.headers["etag"] as string | undefined;
  assert.ok(typeof etag === "string" && etag.includes(String(res.body.profile_row_version)));
});

test("PATCH /api/v2/me with If-Match bumps profile_row_version", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const get1 = await request(app.getHttpServer())
    .get("/api/v2/me")
    .set("Host", tenantTestHost(SUBDOMAIN))
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(get1.status, 200);
  const v1 = get1.body.profile_row_version as number;
  const etag1 = get1.headers["etag"] as string;

  const patch = await request(app.getHttpServer())
    .patch("/api/v2/me")
    .set("Host", tenantTestHost(SUBDOMAIN))
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("If-Match", etag1)
    .send({ notifications_enabled: true });

  assert.equal(patch.status, 200);
  assert.equal(patch.body.notifications_enabled, true);
  assert.equal(typeof patch.body.profile_row_version, "number");
  assert.ok((patch.body.profile_row_version as number) > v1);
});

test("PATCH /api/v2/me persists full_name across reload", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const get1 = await request(app.getHttpServer())
    .get("/api/v2/me")
    .set("Host", tenantTestHost(SUBDOMAIN))
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(get1.status, 200);
  const etag = get1.headers["etag"] as string;

  const patch = await request(app.getHttpServer())
    .patch("/api/v2/me")
    .set("Host", tenantTestHost(SUBDOMAIN))
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("If-Match", etag)
    .send({ full_name: "Renamed E2E Profile" });

  assert.equal(patch.status, 200);
  assert.equal(patch.body.full_name, "Renamed E2E Profile");

  const get2 = await request(app.getHttpServer())
    .get("/api/v2/me")
    .set("Host", tenantTestHost(SUBDOMAIN))
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(get2.status, 200);
  assert.equal(get2.body.full_name, "Renamed E2E Profile");
});

test("PATCH /api/v2/me with stale If-Match returns PROFILE_ROW_VERSION_CONFLICT", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const get = await request(app.getHttpServer())
    .get("/api/v2/me")
    .set("Host", tenantTestHost(SUBDOMAIN))
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(get.status, 200);
  const stale = `W/"1"`;

  const patch = await request(app.getHttpServer())
    .patch("/api/v2/me")
    .set("Host", tenantTestHost(SUBDOMAIN))
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("If-Match", stale)
    .send({ full_name: "Should not apply" });

  assert.equal(patch.status, 409);
  assert.equal(patch.body.success, false);
  assert.equal(patch.body.error?.code, "PROFILE_ROW_VERSION_CONFLICT");
});

test("PATCH /api/v2/me without concurrency token returns PROFILE_ROW_VERSION_REQUIRED", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const patch = await request(app.getHttpServer())
    .patch("/api/v2/me")
    .set("Host", tenantTestHost(SUBDOMAIN))
    .set("Authorization", `Bearer ${sessionToken}`)
    .send({ full_name: "No Token Name" });

  assert.equal(patch.status, 400);
  assert.equal(patch.body.success, false);
  assert.equal(patch.body.error?.code, "PROFILE_ROW_VERSION_REQUIRED");
});

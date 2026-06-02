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
import { tenantTestHost } from "./tenant-test-host";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import { E2E_DEV_OTP, webSessionOtpToken } from "./web-session-otp.helper";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./jwt-test-keys";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";

/** Deterministic tenant IDs + tours for subdomain routing checks. */
const TENANT_OWNER1 = "d1111111-1111-4111-8111-111111111111";
const TENANT_OWNER2 = "d2222222-2222-4222-8222-222222222222";
const TOUR_ONLY_IN_OWNER1 = "e1111111-1111-4111-8111-111111111111";
const TOUR_ONLY_IN_OWNER2 = "e2222222-2222-4222-8222-222222222222";

const USER_MEMBER_OWNER1_EMAIL = "member-owner1@subdomain-mt.test";
const USER_MEMBER_OWNER2_ONLY_EMAIL = "member-owner2-only@subdomain-mt.test";
const USER_MEMBER_OWNER1_PHONE = "+15557400001";
const USER_MEMBER_OWNER2_ONLY_PHONE = "+15557400002";

const INTERNAL_API_KEY = "test-internal-key-subdomain-mt";

const RETRYABILITY_VALUES = new Set([
  "NO_RETRY",
  "SAFE_RETRY",
  "RETRY_WITH_BACKOFF",
  "RETRY_AFTER_ACTION"
]);

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;

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
  process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET =
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET ?? "test-webhook-hmac-secret-at-least-32chars!!!!";
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

async function seedTwoTenantsUsersAndTours(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const tourRepo = ds.getRepository(TourEntity);

  await tenantRepo.insert([
    {
      id: TENANT_OWNER1,
      name: "Subdomain MT Owner1",
      description: "subdomain-multi-tenant e2e",
      subdomain: "owner1"
    },
    {
      id: TENANT_OWNER2,
      name: "Subdomain MT Owner2",
      description: "subdomain-multi-tenant e2e",
      subdomain: "owner2"
    }
  ]);

  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);

  await userRepo.save(
    userRepo.create({
      email: USER_MEMBER_OWNER1_EMAIL,
      phone: USER_MEMBER_OWNER1_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Member Owner1",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  await userRepo.save(
    userRepo.create({
      email: USER_MEMBER_OWNER2_ONLY_EMAIL,
      phone: USER_MEMBER_OWNER2_ONLY_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Member Owner2 Only",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  const u1 = await userRepo.findOneOrFail({ where: { email: USER_MEMBER_OWNER1_EMAIL } });
  const u2 = await userRepo.findOneOrFail({ where: { email: USER_MEMBER_OWNER2_ONLY_EMAIL } });

  await membershipRepo.save([
    membershipRepo.create({
      tenantId: TENANT_OWNER1,
      userId: u1.id,
      role: UserRole.Owner
    }),
    membershipRepo.create({
      tenantId: TENANT_OWNER2,
      userId: u2.id,
      role: UserRole.Owner
    })
  ]);

  await tourRepo.save(
    tourRepo.create({
      id: TOUR_ONLY_IN_OWNER1,
      tenantId: TENANT_OWNER1,
      title: "Tour visible only in owner1 workspace",
      totalCapacity: 10,
      acceptedCount: 0,
      lifecycleStatus: TourLifecycleStatus.DRAFT
    })
  );
  await tourRepo.save(
    tourRepo.create({
      id: TOUR_ONLY_IN_OWNER2,
      tenantId: TENANT_OWNER2,
      title: "Secret tour in owner2 workspace",
      totalCapacity: 5,
      acceptedCount: 0,
      lifecycleStatus: TourLifecycleStatus.DRAFT
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
  await seedTwoTenantsUsersAndTours(app.get(DataSource));
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("login via owner1.localhost — user in owner1 → 200", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost("owner1"))
    .send({ phone: USER_MEMBER_OWNER1_PHONE, otp: E2E_DEV_OTP });

  assert.equal(response.status, 200);
  assert.equal(response.body.entry_mode, "web");
  assert.equal(response.body.tenant_id?.trim().toLowerCase(), TENANT_OWNER1);
  assert.equal(typeof response.body.session_token, "string");
  assert.equal(response.body.session_token.split(".").length, 3);
});

test("login via owner1.localhost — user only in owner2 → 403 TENANT_SCOPE_FORBIDDEN", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost("owner1"))
    .send({
      phone: USER_MEMBER_OWNER2_ONLY_PHONE,
      otp: E2E_DEV_OTP
    });

  assert.equal(response.status, 403);
  assert.equal(response.body.error?.code, "TENANT_SCOPE_FORBIDDEN");
  assertErrorEnvelope(response);
});

test("protected route — list/get tours RLS isolates other tenant rows", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }

  const token = await webSessionOtpToken(app, {
    phone: USER_MEMBER_OWNER1_PHONE,
    tenantSubdomain: "owner1"
  });

  const list = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .set("Host", tenantTestHost("owner1"))
    .set("Authorization", `Bearer ${token}`);

  assert.equal(list.status, 200);
  assert.equal(list.body.total, 1);
  assert.equal(Array.isArray(list.body.items), true);
  assert.equal(list.body.items.length, 1);
  assert.equal(list.body.items[0].id, TOUR_ONLY_IN_OWNER1);
  assert.equal(
    list.body.items.some((row: { id?: string }) => row.id === TOUR_ONLY_IN_OWNER2),
    false
  );

  const leakById = await request(app.getHttpServer())
    .get(`/api/v2/tours/${TOUR_ONLY_IN_OWNER2}`)
    .set("Host", tenantTestHost("owner1"))
    .set("Authorization", `Bearer ${token}`);

  assert.equal(leakById.status, 404);
  assert.equal(leakById.body.error?.code, "RESOURCE_NOT_FOUND");
  assertErrorEnvelope(leakById);
});

test("unknown subdomain on login → 404 TENANT_HOST_UNKNOWN", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost(`missing-${randomUUID().slice(0, 8)}`))
    .send({
      phone: USER_MEMBER_OWNER1_PHONE,
      otp: E2E_DEV_OTP
    });

  assert.equal(response.status, 404);
  assert.equal(response.body.error?.code, "TENANT_HOST_UNKNOWN");
  assertErrorEnvelope(response);
});

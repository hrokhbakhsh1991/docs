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
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";

/** Fixed UUIDs (distinct from api.e2e-spec seed) for deterministic isolation checks. */
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TOUR_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const REGISTRATION_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const USER_A_EMAIL = "user-a@tenant-isolation.test";
const USER_B_EMAIL = "user-b@tenant-isolation.test";
const USER_A_PHONE = "+15558100001";
const USER_B_PHONE = "+15558100002";

const INTERNAL_API_KEY = "test-internal-key-tenant-isolation";

const RETRYABILITY_VALUES = new Set([
  "NO_RETRY",
  "SAFE_RETRY",
  "RETRY_WITH_BACKOFF",
  "RETRY_AFTER_ACTION"
]);

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let sessionTokenB = "";

/** Bodies from userB HTTP responses that could carry registration payloads. */
const userBRegistrationLikeBodies: unknown[] = [];

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

function recordUserBBodyIfRelevant(status: number, body: unknown): void {
  if (status < 200 || status >= 300) {
    return;
  }
  userBRegistrationLikeBodies.push(body);
}

function assertNoCrossTenantRowsReturned(): void {
  const forbiddenTenant = TENANT_A;
  const forbiddenRegistrationId = REGISTRATION_A;

  for (const body of userBRegistrationLikeBodies) {
    if (Array.isArray(body)) {
      for (const item of body) {
        if (item && typeof item === "object") {
          const row = item as Record<string, unknown>;
          assert.notEqual(row.tenantId, forbiddenTenant);
          assert.notEqual(row.id, forbiddenRegistrationId);
        }
      }
      continue;
    }
    if (body && typeof body === "object") {
      const row = body as Record<string, unknown>;
      if ("tenantId" in row || "tourId" in row) {
        assert.notEqual(row.tenantId, forbiddenTenant);
        assert.notEqual(row.id, forbiddenRegistrationId);
      }
    }
  }
}

async function seedTwoTenantsWithRegistration(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const tourRepo = ds.getRepository(TourEntity);
  const regRepo = ds.getRepository(RegistrationEntity);

  await tenantRepo.insert([
    {
      id: TENANT_A,
      name: "Tenant A (isolation)",
      description: "tenant-isolation e2e",
      subdomain: "iso-a"
    },
    {
      id: TENANT_B,
      name: "Tenant B (isolation)",
      description: "tenant-isolation e2e",
      subdomain: "iso-b"
    }
  ]);

  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);
  const userA = await userRepo.save(
    userRepo.create({
      email: USER_A_EMAIL,
      phone: USER_A_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "User A",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  const userB = await userRepo.save(
    userRepo.create({
      email: USER_B_EMAIL,
      phone: USER_B_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "User B",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  await membershipRepo.save([
    membershipRepo.create({
      tenantId: TENANT_A,
      userId: userA.id,
      role: UserRole.Owner
    }),
    membershipRepo.create({
      tenantId: TENANT_B,
      userId: userB.id,
      role: UserRole.Owner
    })
  ]);

  await tourRepo.save(
    tourRepo.create({
      id: TOUR_A,
      tenantId: TENANT_A,
      title: "Tour in tenant A",
      totalCapacity: 10,
      acceptedCount: 1,
      lifecycleStatus: TourLifecycleStatus.OPEN
    })
  );

  await regRepo.save(
    regRepo.create({
      id: REGISTRATION_A,
      tenantId: TENANT_A,
      tourId: TOUR_A,
      participantFullName: "Participant A",
      participantContactPhone: "+989000000001",
      transportMode: "group_vehicle",
      entryMode: "web",
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID
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
  await seedTwoTenantsWithRegistration(app.get(DataSource));
  sessionTokenB = await webSessionOtpToken(app, { phone: USER_B_PHONE, tenantSubdomain: "iso-b" });
});

after(async () => {
  assertNoCrossTenantRowsReturned();
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("userB cannot GET registration from tenantA (403 or 404)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .get(`/api/v2/registrations/${REGISTRATION_A}`)
    .set("Authorization", `Bearer ${sessionTokenB}`);

  assert.equal([403, 404].includes(response.status), true, `unexpected status ${response.status}`);
  if (response.status === 404) {
    assertErrorEnvelope(response);
  }
});

test("userB cannot PATCH registration status in tenantA (403 or 404)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .patch(`/api/v2/registrations/${REGISTRATION_A}/status`)
    .set("Authorization", `Bearer ${sessionTokenB}`)
    .set("idempotency-key", randomUUID())
    .send({ targetStatus: RegistrationStatus.CANCELLED, expected_row_version: 1 });

  assert.equal([403, 404].includes(response.status), true, `unexpected status ${response.status}`);
  assert.notEqual(response.status, 200);
  if (response.status === 404) {
    assertErrorEnvelope(response);
  }
});

test("userB cannot list tenantA registrations (bookings + tour list; no cross-tenant rows)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const bookings = await request(app.getHttpServer())
    .get("/api/v2/bookings")
    .query({ tenant_id: TENANT_A })
    .set("Authorization", `Bearer ${sessionTokenB}`);

  assert.equal(bookings.status, 200);
  assert.equal(Array.isArray(bookings.body), true);
  assert.equal((bookings.body as unknown[]).length, 0);
  recordUserBBodyIfRelevant(bookings.status, bookings.body);
  for (const item of bookings.body as Array<Record<string, unknown>>) {
    assert.notEqual(item.tenantId, TENANT_A);
    assert.notEqual(item.id, REGISTRATION_A);
  }

  const tourRegs = await request(app.getHttpServer())
    .get(`/api/v2/tours/${TOUR_A}/registrations`)
    .set("Authorization", `Bearer ${sessionTokenB}`);

  if (tourRegs.status === 200) {
    assert.equal(Array.isArray(tourRegs.body), true);
    recordUserBBodyIfRelevant(tourRegs.status, tourRegs.body);
    assert.equal((tourRegs.body as unknown[]).length, 0);
  } else {
    assert.equal([403, 404].includes(tourRegs.status), true, `unexpected status ${tourRegs.status}`);
    if (tourRegs.status === 404) {
      assertErrorEnvelope(tourRegs);
    }
  }
});

test("userB cannot GET tour owned by tenantA (403 or 404)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .get(`/api/v2/tours/${TOUR_A}`)
    .set("Authorization", `Bearer ${sessionTokenB}`);

  assert.equal([403, 404].includes(response.status), true, `unexpected status ${response.status}`);
  if (response.status === 404) {
    assertErrorEnvelope(response);
  }
});

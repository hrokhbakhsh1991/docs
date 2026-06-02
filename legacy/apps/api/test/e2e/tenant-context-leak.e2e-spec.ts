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
import { syntheticBookingContactPhone } from "../../src/common/security/ownership-scope";
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

const TENANT_A = "e4e4e4e4-e4e4-44e4-84e4-e4e4e4e4e4e4";
const TENANT_B = "e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5";

const USER_A_EMAIL = "usera@tenant-context-leak.test";
const USER_B_EMAIL = "userb@tenant-context-leak.test";
const USER_A_PHONE = "+15558200001";
const USER_B_PHONE = "+15558200002";

const INTERNAL_API_KEY = "test-internal-key-tenant-context-leak";

const PARALLEL_REQUESTS = 50;

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let tokenA = "";
let tokenB = "";

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

function assertBookingsOnlyTenant(
  response: Response,
  expectedTenantId: string,
  label: string
): void {
  assert.equal(response.status, 200, `${label}: ${JSON.stringify(response.body)}`);
  assert.equal(Array.isArray(response.body), true, `${label}: body must be array`);
  for (const row of response.body as Array<{ tenantId?: string; id?: string }>) {
    assert.equal(
      row.tenantId,
      expectedTenantId,
      `${label}: cross-tenant or missing tenantId on row ${JSON.stringify(row)}`
    );
  }
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const tourRepo = ds.getRepository(TourEntity);
  const regRepo = ds.getRepository(RegistrationEntity);

  await tenantRepo.insert([
    {
      id: TENANT_A,
      name: "Tenant A (context leak)",
      description: "tenant-context-leak e2e",
      subdomain: "ctx-leaka"
    },
    {
      id: TENANT_B,
      name: "Tenant B (context leak)",
      description: "tenant-context-leak e2e",
      subdomain: "ctx-leakb"
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

  const tourAId = randomUUID();
  const tourBId = randomUUID();
  await tourRepo.save([
    tourRepo.create({
      id: tourAId,
      tenantId: TENANT_A,
      title: "Tour A",
      totalCapacity: 10,
      acceptedCount: 1,
      lifecycleStatus: TourLifecycleStatus.OPEN
    }),
    tourRepo.create({
      id: tourBId,
      tenantId: TENANT_B,
      title: "Tour B",
      totalCapacity: 10,
      acceptedCount: 1,
      lifecycleStatus: TourLifecycleStatus.OPEN
    })
  ]);

  const phoneA = syntheticBookingContactPhone(userA.id);
  const phoneB = syntheticBookingContactPhone(userB.id);

  await regRepo.save([
    regRepo.create({
      id: randomUUID(),
      tenantId: TENANT_A,
      tourId: tourAId,
      participantFullName: "Booked A",
      participantContactPhone: phoneA,
      transportMode: "group_vehicle",
      entryMode: "web",
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID
    }),
    regRepo.create({
      id: randomUUID(),
      tenantId: TENANT_B,
      tourId: tourBId,
      participantFullName: "Booked B",
      participantContactPhone: phoneB,
      transportMode: "group_vehicle",
      entryMode: "web",
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID
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
  tokenA = await webSessionOtpToken(app, { phone: USER_A_PHONE, tenantSubdomain: "ctx-leaka" });
  tokenB = await webSessionOtpToken(app, { phone: USER_B_PHONE, tenantSubdomain: "ctx-leakb" });
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test(`${PARALLEL_REQUESTS} parallel GET /api/v2/bookings alternating tenants — no cross-tenant rows`, async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const httpServer = app.getHttpServer();

  await Promise.all(
    Array.from({ length: PARALLEL_REQUESTS }, (_, i) => {
      const forUserA = i % 2 === 0;
      const token = forUserA ? tokenA : tokenB;
      const expectedTenant = forUserA ? TENANT_A : TENANT_B;
      const label = `parallel#${i}(${forUserA ? "userA" : "userB"})`;
      return request(httpServer)
        .get("/api/v2/bookings")
        .set("Authorization", `Bearer ${token}`)
        .then((res) => {
          assertBookingsOnlyTenant(res, expectedTenant, label);
        });
    })
  );
});

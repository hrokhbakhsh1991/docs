import "reflect-metadata";
import assert from "node:assert/strict";
import * as argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import request from "supertest";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer
} from "@testcontainers/postgresql";
import { assignTestApiPort } from "./assign-test-api-port";
import { createE2EApp } from "./bootstrap";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./jwt-test-keys";
import { tenantTestHost } from "./tenant-test-host";
import { E2E_DEV_OTP } from "./web-session-otp.helper";
import { ReconciliationService } from "../../src/modules/reconciliation/reconciliation.service";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const INTERNAL_API_KEY = "test-internal-key";
const LEADER_PHONE = "+15558300001";

let container: StartedPostgreSqlContainer;
let app: INestApplication;
let dataSource: DataSource;
let reconciliationService: ReconciliationService;
let e2eUnavailableReason: string | null = null;
let leaderToken = "";

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

async function seedReleaseGateTenant(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  await tenantRepo.insert({
    id: TENANT_ID,
    name: "Release gate tenant",
    description: "release-gate-journeys e2e",
    subdomain: "release-gate"
  });
  const hashedPassword = await argon2.hash(`fixture-${randomUUID()}`);
  const user = await userRepo.save(
    userRepo.create({
      email: "leader@example.com",
      phone: LEADER_PHONE,
      isPhoneVerified: true,
      hashedPassword,
      fullName: "Release Gate Leader",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  await membershipRepo.save(
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: user.id,
      role: UserRole.Owner
    })
  );
}

async function truncateAllTables(ds: DataSource): Promise<void> {
  const rows = (await ds.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename != 'typeorm_migrations'
  `)) as Array<{ tablename: string }>;

  if (rows.length === 0) {
    return;
  }

  const tableList = rows.map((row) => `"${row.tablename}"`).join(", ");
  await ds.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

async function createTour(totalCapacity: number): Promise<string> {
  const repo = dataSource.getRepository(TourEntity);
  const tour = await repo.save(
    repo.create({
      tenantId: TENANT_ID,
      title: `release-gate-tour-${Date.now()}-${randomUUID().slice(0, 8)}`,
      totalCapacity,
      acceptedCount: 0,
      lifecycleStatus: TourLifecycleStatus.OPEN,
      costContext: { requiresPayment: false }
    })
  );
  return tour.id;
}

async function createLeaderSession(): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost("release-gate"))
    .send({
      phone: LEADER_PHONE,
      otp: E2E_DEV_OTP
    });
  assert.equal(response.status, 200);
  return response.body.session_token as string;
}

async function publicRegister(
  tourId: string,
  index: number,
  idempotencyKey?: string
): Promise<request.Response> {
  const req = request(app.getHttpServer())
    .post(`/api/v2/tours/${tourId}/register`)
    .set(
      "idempotency-key",
      idempotencyKey ?? `release-gate-${tourId}-u${index}-${randomUUID()}`
    )
    .send({
      tourId,
      participantFullName: `Release User ${index}`,
      participantContactPhone: `+989120001${index.toString().padStart(3, "0")}`,
      transportMode: "group_vehicle",
      entryMode: "web"
    });
  return req;
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
  dataSource = app.get(DataSource);
  reconciliationService = app.get(ReconciliationService);
});

beforeEach(async () => {
  if (e2eUnavailableReason) {
    return;
  }
  await truncateAllTables(dataSource);
  await seedReleaseGateTenant(dataSource);
  leaderToken = await createLeaderSession();
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("Gate-B: internal ops endpoints are fail-closed without internal API key", async () => {
  if (e2eUnavailableReason) {
    return;
  }
  const response = await request(app.getHttpServer()).get("/internal/ops/health");
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "OPS_UNAUTHORIZED");
});

test("Gate-D: waitlist convert/cancel journey remains deterministic over HTTP", async () => {
  if (e2eUnavailableReason) {
    return;
  }
  const tourId = await createTour(1);
  const first = await publicRegister(tourId, 1);
  assert.equal(first.status, 201);
  const second = await publicRegister(tourId, 2);
  assert.equal(second.status, 201);
  const waitlistItemId = second.body.waitlistItemId as string;
  assert.equal(typeof waitlistItemId, "string");

  const convert = await request(app.getHttpServer())
    .post(`/api/v2/waitlist-items/${waitlistItemId}/convert`)
    .set("Authorization", `Bearer ${leaderToken}`)
    .send({ conversionReason: "capacity_available" });
  assert.equal(convert.status, 409);
  assert.equal(convert.body.error.code, "CAPACITY_FULL");

  const cancel = await request(app.getHttpServer())
    .patch(`/api/v2/waitlist-items/${waitlistItemId}/cancel`)
    .set("Authorization", `Bearer ${leaderToken}`)
    .send({ cancelReason: "participant_requested" });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.status, "Cancelled");

  const convertAfterCancel = await request(app.getHttpServer())
    .post(`/api/v2/waitlist-items/${waitlistItemId}/convert`)
    .set("Authorization", `Bearer ${leaderToken}`)
    .send({ conversionReason: "manual_override" });
  assert.equal(convertAfterCancel.status, 409);
  assert.equal(convertAfterCancel.body.error.code, "STATE_TRANSITION_INVALID");
});

test("Gate-C: idempotency mismatch on public register is rejected deterministically", async () => {
  if (e2eUnavailableReason) {
    return;
  }
  const tourId = await createTour(3);
  const key = "release-gate-idempotency-key";

  const first = await publicRegister(tourId, 1, key);
  assert.equal(first.status, 201);

  const second = await request(app.getHttpServer())
    .post(`/api/v2/tours/${tourId}/register`)
    .set("idempotency-key", key)
    .send({
      tourId,
      participantFullName: "Different Payload User",
      participantContactPhone: "+989120009999",
      transportMode: "group_vehicle",
      entryMode: "web"
    });
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, "IDEMPOTENCY_KEY_REPLAY_MISMATCH");
});

test("Gate-D: reconciliation cycle fixes capacity drift and exposes health snapshot", async () => {
  if (e2eUnavailableReason) {
    return;
  }
  const tourId = await createTour(5);
  const r1 = await publicRegister(tourId, 1);
  const r2 = await publicRegister(tourId, 2);
  assert.equal(r1.status, 201);
  assert.equal(r2.status, 201);

  await dataSource.getRepository(TourEntity).update({ id: tourId }, { acceptedCount: 0 });
  await reconciliationService.runReconciliationCycle();

  const ops = await request(app.getHttpServer())
    .get("/internal/ops/health")
    .set("x-internal-api-key", INTERNAL_API_KEY);
  assert.equal(ops.status, 200);
  assert.equal(ops.body.capacity.driftDetected, true);
  assert.equal(typeof ops.body.capacity.lastReconciliationAt, "string");

  const refreshedTour = await dataSource.getRepository(TourEntity).findOneByOrFail({ id: tourId });
  assert.equal(refreshedTour.acceptedCount, 2);
});

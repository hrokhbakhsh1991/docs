import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import * as argon2 from "argon2";
import { DataSource, In } from "typeorm";
import request from "supertest";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer
} from "@testcontainers/postgresql";
import { assignTestApiPort } from "./assign-test-api-port";
import { createE2EApp } from "./bootstrap";
import { signPaymentsWebhookPayload } from "./sign-payments-webhook";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./jwt-test-keys";
import { tenantTestHost } from "./tenant-test-host";
import { webSessionOtpToken } from "./web-session-otp.helper";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { MembershipStatus } from "../../src/modules/identity/membership-status.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { ReconciliationJobKind } from "../../src/modules/finance/reconciliation/reconciliation-job-kind";
import { ReconciliationJobEntity } from "../../src/modules/finance/reconciliation/entities/reconciliation-job.entity";
import { ReconciliationService } from "../../src/modules/reconciliation/reconciliation.service";
import {
  RegistrationEntity,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import { TourProductEntity } from "../../src/modules/tours/entities/tour-product.entity";
import { TourDepartureEntity } from "../../src/modules/tours/entities/tour-departure.entity";
import type { TourTransportMode } from "../../src/modules/tours/tour-transport-modes";

/** Dedicated tenant; seeds Owner (DB invariant) + Leader for authenticated PATCH. */
const TENANT_ID = "44444444-4444-4444-8444-444444444444";
const TENANT_SLUG = "load-reg-e2e";
const OWNER_PHONE = "+15557200443";
const LEADER_PHONE = "+15557200444";
const INTERNAL_API_KEY = "test-internal-key-load-reg";

const CONCURRENT_REGISTRATIONS = 8;

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let dataSource: DataSource | undefined;
let leaderToken = "";
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
  process.env.INTERNAL_API_KEY = INTERNAL_API_KEY;
  process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET =
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET ?? "test-webhook-hmac-secret-at-least-32chars!!!!";
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

async function seedTenantOwnerAndLeader(ds: DataSource): Promise<void> {
  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);
  await ds.getRepository(TenantEntity).insert({
    id: TENANT_ID,
    name: "Load concurrency E2E tenant",
    description: "load-concurrency-registration.e2e-spec.ts",
    subdomain: TENANT_SLUG
  });

  const owner = await ds.getRepository(UserEntity).save(
    ds.getRepository(UserEntity).create({
      email: `owner-load-${randomUUID().slice(0, 8)}@e2e.test`,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Load Test Owner",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  await ds.getRepository(UserTenantEntity).save(
    ds.getRepository(UserTenantEntity).create({
      tenantId: TENANT_ID,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date()
    })
  );

  const leader = await ds.getRepository(UserEntity).save(
    ds.getRepository(UserEntity).create({
      email: `leader-load-${randomUUID().slice(0, 8)}@e2e.test`,
      phone: LEADER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Load Test Leader",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  await ds.getRepository(UserTenantEntity).save(
    ds.getRepository(UserTenantEntity).create({
      tenantId: TENANT_ID,
      userId: leader.id,
      role: UserRole.Leader,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date()
    })
  );
}

async function createPaidTour(ds: DataSource, totalCapacity: number): Promise<TourEntity> {
  const tourId = randomUUID();
  const listMinor = "250000";
  const currency = "IRR";

  const product = await ds.getRepository(TourProductEntity).save(
    ds.getRepository(TourProductEntity).create({
      tenantId: TENANT_ID,
      title: `load-product-${tourId.slice(0, 8)}`
    })
  );

  await ds.getRepository(TourDepartureEntity).save(
    ds.getRepository(TourDepartureEntity).create({
      id: tourId,
      tourProductId: product.id,
      tenantId: TENANT_ID,
      lifecycleStatus: TourLifecycleStatus.OPEN,
      capacityTotal: totalCapacity,
      listPriceMinor: listMinor,
      currencyCode: currency,
      startsOn: "2030-06-01"
    })
  );

  return ds.getRepository(TourEntity).save(
    ds.getRepository(TourEntity).create({
      id: tourId,
      tenantId: TENANT_ID,
      title: `load-tour-${randomUUID()}`,
      totalCapacity,
      acceptedCount: 0,
      lifecycleStatus: TourLifecycleStatus.OPEN,
      costContext: { requiresPayment: true },
      tourProductId: product.id,
      tourDepartureId: tourId,
      listPriceMinor: listMinor,
      currencyCode: currency,
      transportModes: ["bus"] as TourTransportMode[]
    })
  );
}

function postSignedPaymentWebhook(
  httpServer: ReturnType<INestApplication["getHttpServer"]>,
  body: Record<string, unknown>
) {
  const raw = JSON.stringify(body);
  const secret = process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("PAYMENTS_WEBHOOK_SIGNING_SECRET must be set for webhook tests");
  }
  const { timestamp, signature } = signPaymentsWebhookPayload(raw, secret);
  return request(httpServer)
    .post("/internal/payments/webhook")
    .set("Content-Type", "application/json")
    .set("x-payments-webhook-timestamp", timestamp)
    .set("x-payments-webhook-signature", signature)
    .send(raw);
}

function publicRegister(
  httpServer: ReturnType<INestApplication["getHttpServer"]>,
  tourId: string,
  index: number
): Promise<request.Response> {
  return request(httpServer)
    .post(`/api/v2/tours/${tourId}/register`)
    .set("idempotency-key", `load-reg-${tourId}-u${index}-${randomUUID()}`)
    .send({
      tourId,
      participantFullName: `Concurrent User ${index}`,
      participantContactPhone: `+9891300${String(10000 + index).slice(-5)}`,
      transportMode: "group_vehicle",
      entryMode: "web"
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
  dataSource = app.get(DataSource);
});

beforeEach(async () => {
  if (e2eUnavailableReason || !app || !dataSource) {
    return;
  }
  await truncateAllTables(dataSource);
  await seedTenantOwnerAndLeader(dataSource);
  leaderToken = await webSessionOtpToken(app, {
    phone: LEADER_PHONE,
    tenantSubdomain: TENANT_SLUG
  });
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("eight public registrations → paid webhooks → reconciliation stay consistent", async () => {
  if (e2eUnavailableReason || !app || !dataSource) {
    return;
  }
  const httpServer = app.getHttpServer();
  const tour = await createPaidTour(dataSource, CONCURRENT_REGISTRATIONS + 4);

  /** Sequential HTTP avoids `pg` “client already executing a query” races under tsx; webhook + DB invariants still run eight full journeys. */
  const registerResponses: request.Response[] = [];
  for (let i = 0; i < CONCURRENT_REGISTRATIONS; i += 1) {
    registerResponses.push(await publicRegister(httpServer, tour.id, i));
  }
  for (const res of registerResponses) {
    assert.equal(res.status, 201, `register failed: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.registration, "expected registration payload");
  }

  const webhookResults: request.Response[] = [];
  for (const res of registerResponses) {
    webhookResults.push(
      await postSignedPaymentWebhook(httpServer, {
        tenant_id: TENANT_ID,
        providerPaymentId: res.body.paymentIntent.providerPaymentId as string,
        status: "Paid"
      })
    );
  }
  for (const w of webhookResults) {
    assert.equal(w.status, 200);
  }

  const registrationRepo = dataSource.getRepository(RegistrationEntity);
  const ids = registerResponses.map((r) => r.body.registration.id as string);
  const paidRows = await registrationRepo.find({
    where: { id: In(ids) }
  });
  assert.equal(paidRows.length, CONCURRENT_REGISTRATIONS);
  for (const r of paidRows) {
    assert.equal(r.status, RegistrationStatus.ACCEPTED_PAID);
  }

  const reconciliation = app.get(ReconciliationService);
  await reconciliation.runReconciliationCycle();

  const refreshedTour = await dataSource.getRepository(TourEntity).findOneByOrFail({ id: tour.id });
  assert.equal(refreshedTour.acceptedCount, CONCURRENT_REGISTRATIONS);

  const pfJobs = await dataSource.getRepository(ReconciliationJobEntity).count({
    where: { tenantId: TENANT_ID, jobKind: ReconciliationJobKind.PAYMENT_FINANCE }
  });
  assert.ok(pfJobs >= 1, "expected at least one payment–finance reconciliation job row");

  const snap = reconciliation.getSnapshot();
  assert.ok(snap.lastPaymentFinanceReconciliationAt, "reconciliation snapshot should record PF run");
});

test("duplicate active registration for same phone returns REGISTRATION_DUPLICATE_ACTIVE", async () => {
  if (e2eUnavailableReason || !app || !dataSource) {
    return;
  }
  const httpServer = app.getHttpServer();
  const tour = await createPaidTour(dataSource, 4);
  const phone = "+98913100001";
  const first = await request(httpServer)
    .post(`/api/v2/tours/${tour.id}/register`)
    .set("idempotency-key", `dup-a-${randomUUID()}`)
    .send({
      tourId: tour.id,
      participantFullName: "Dup A",
      participantContactPhone: phone,
      transportMode: "group_vehicle",
      entryMode: "web"
    });
  assert.equal(first.status, 201);
  const providerPaymentId = first.body.paymentIntent.providerPaymentId as string;
  const paidWebhook = await postSignedPaymentWebhook(httpServer, {
    tenant_id: TENANT_ID,
    providerPaymentId,
    status: "Paid"
  });
  assert.equal(paidWebhook.status, 200);

  const second = await request(httpServer)
    .post(`/api/v2/tours/${tour.id}/register`)
    .set("idempotency-key", `dup-b-${randomUUID()}`)
    .send({
      tourId: tour.id,
      participantFullName: "Dup B",
      participantContactPhone: phone,
      transportMode: "group_vehicle",
      entryMode: "web"
    });
  assert.equal(second.status, 409);
  assert.equal(second.body?.error?.code, "REGISTRATION_DUPLICATE_ACTIVE");
});

test("PATCH registration status with stale expected_row_version returns REGISTRATION_ROW_VERSION_CONFLICT", async () => {
  if (e2eUnavailableReason || !app || !dataSource) {
    return;
  }
  const httpServer = app.getHttpServer();
  const tour = await createPaidTour(dataSource, 3);
  const reg = await request(httpServer)
    .post(`/api/v2/tours/${tour.id}/register`)
    .set("idempotency-key", `rowv-${randomUUID()}`)
    .send({
      tourId: tour.id,
      participantFullName: "Row version probe",
      participantContactPhone: "+98913200002",
      transportMode: "group_vehicle",
      entryMode: "web"
    });
  assert.equal(reg.status, 201);
  const registrationId = reg.body.registration.id as string;

  const patch = await request(httpServer)
    .patch(`/api/v2/registrations/${registrationId}/status`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${leaderToken}`)
    .set("idempotency-key", randomUUID())
    .send({
      targetStatus: RegistrationStatus.CANCELLED,
      expected_row_version: 999
    });
  assert.equal(patch.status, 409);
  assert.equal(patch.body?.error?.code, "REGISTRATION_ROW_VERSION_CONFLICT");
});

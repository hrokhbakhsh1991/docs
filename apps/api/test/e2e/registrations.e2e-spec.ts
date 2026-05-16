import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
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
import { signPaymentsWebhookPayload } from "./sign-payments-webhook";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./jwt-test-keys";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { requestContextStorage } from "../../src/common/request-context/request-context";
import { RegistrationsService } from "../../src/modules/registrations/registrations.service";
import {
  RegistrationEntity,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { WaitlistItemEntity, WaitlistItemStatus } from "../../src/modules/registrations/waitlist-item.entity";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import { TourProductEntity } from "../../src/modules/tours/entities/tour-product.entity";
import { TourDepartureEntity } from "../../src/modules/tours/entities/tour-departure.entity";
import type { TourTransportMode } from "../../src/modules/tours/tour-transport-modes";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const INTERNAL_API_KEY = "test-internal-key";

let container: StartedPostgreSqlContainer;
let app: INestApplication;
let dataSource: DataSource;
let registrationsService: RegistrationsService;
let e2eUnavailableReason: string | null = null;

function postSignedPaymentWebhook(body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  const secret = process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("PAYMENTS_WEBHOOK_SIGNING_SECRET must be set for webhook tests");
  }
  const { timestamp, signature } = signPaymentsWebhookPayload(raw, secret);
  return request(app.getHttpServer())
    .post("/internal/payments/webhook")
    .set("Content-Type", "application/json")
    .set("x-payments-webhook-timestamp", timestamp)
    .set("x-payments-webhook-signature", signature)
    .send(raw);
}

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

/** FK `fk_tours_tenant` requires a tenants row before inserting tours. */
async function seedE2eTenant(ds: DataSource): Promise<void> {
  await ds.getRepository(TenantEntity).insert({
    id: TENANT_ID,
    name: "Registrations E2E Tenant",
    description: "Seeded for registrations.e2e-spec.ts",
    subdomain: "reg-e2e"
  });
}

async function createTour(totalCapacity: number): Promise<TourEntity> {
  const tourId = randomUUID();
  const listMinor = "250000";
  const currency = "IRR";

  const product = await dataSource.getRepository(TourProductEntity).save(
    dataSource.getRepository(TourProductEntity).create({
      tenantId: TENANT_ID,
      title: `reg-e2e-product-${tourId.slice(0, 8)}`
    })
  );

  await dataSource.getRepository(TourDepartureEntity).save(
    dataSource.getRepository(TourDepartureEntity).create({
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

  const repo = dataSource.getRepository(TourEntity);
  return repo.save(
    repo.create({
      id: tourId,
      tenantId: TENANT_ID,
      title: `tour-${randomUUID()}`,
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

async function publicRegister(
  tourId: string,
  index: number
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post(`/api/v2/tours/${tourId}/register`)
    .set("idempotency-key", `e2e-reg-${tourId}-${index}-${randomUUID()}`)
    .send({
      tourId,
      participantFullName: `User ${index}`,
      participantContactPhone: `+9891200000${index}`,
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
  registrationsService = app.get(RegistrationsService);
});

beforeEach(async () => {
  if (e2eUnavailableReason) {
    return;
  }
  await truncateAllTables(dataSource);
  await seedE2eTenant(dataSource);
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("public register without Idempotency-Key is rejected", async () => {
  if (e2eUnavailableReason) {
    return;
  }
  const tour = await createTour(2);
  const res = await request(app.getHttpServer())
    .post(`/api/v2/tours/${tour.id}/register`)
    .send({
      tourId: tour.id,
      participantFullName: "No Key User",
      participantContactPhone: "+989120009001",
      transportMode: "group_vehicle",
      entryMode: "web"
    });
  assert.equal(res.status, 400);
  assert.equal(res.body?.error?.code, "VALIDATION_REQUIRED_FIELD_MISSING");
});

test("paid registration success updates status to AcceptedPaid", async () => {
  if (e2eUnavailableReason) {
    return;
  }
  const tour = await createTour(2);

  const registerResponse = await publicRegister(tour.id, 1);
  assert.equal(registerResponse.status, 201);
  const registrationId = registerResponse.body.registration.id as string;
  const providerPaymentId = registerResponse.body.paymentIntent.providerPaymentId as string;

  const webhookResponse = await postSignedPaymentWebhook({
    tenant_id: TENANT_ID,
    providerPaymentId,
    status: "Paid"
  });
  assert.equal(webhookResponse.status, 200);

  const registration = await dataSource.getRepository(RegistrationEntity).findOneByOrFail({
    id: registrationId
  });
  const refreshedTour = await dataSource.getRepository(TourEntity).findOneByOrFail({ id: tour.id });

  assert.equal(registration.status, RegistrationStatus.ACCEPTED_PAID);
  assert.equal(refreshedTour.acceptedCount, 1);
});

test("capacity full sends next user to waitlist", async () => {
  if (e2eUnavailableReason) {
    return;
  }
  const tour = await createTour(1);

  const first = await publicRegister(tour.id, 1);
  assert.equal(first.status, 201);
  assert.equal(first.body.registration !== null, true);

  const second = await publicRegister(tour.id, 2);
  assert.equal(second.status, 201);
  assert.equal(second.body.registration, null);
  assert.equal(typeof second.body.waitlistItemId, "string");
});

test("cancelling accepted registration promotes waitlist user", async () => {
  if (e2eUnavailableReason) {
    return;
  }
  const tour = await createTour(1);

  const first = await publicRegister(tour.id, 1);
  const second = await publicRegister(tour.id, 2);
  const firstRegistrationId = first.body.registration.id as string;
  const waitlistItemId = second.body.waitlistItemId as string;

  await requestContextStorage.run(
    {
      requestId: randomUUID(),
      tenantId: TENANT_ID,
      userId: randomUUID(),
      role: UserRole.Owner
    },
    async () => {
      const reg = await dataSource.getRepository(RegistrationEntity).findOneByOrFail({
        id: firstRegistrationId
      });
      await registrationsService.updateRegistrationStatus(firstRegistrationId, {
        targetStatus: RegistrationStatus.CANCELLED,
        expected_row_version: reg.rowVersion
      });
    }
  );

  const waitlistRow = await dataSource.getRepository(WaitlistItemEntity).findOneByOrFail({
    id: waitlistItemId
  });
  assert.equal(waitlistRow.status, WaitlistItemStatus.CONVERTED);

  const promoted = await dataSource.getRepository(RegistrationEntity).findOneBy({
    id: waitlistRow.promotedRegistrationId
  });
  assert.equal(promoted?.status, RegistrationStatus.ACCEPTED);
});

test("payment failure restores capacity and promotes waitlist user", async () => {
  if (e2eUnavailableReason) {
    return;
  }
  const tour = await createTour(1);

  const first = await publicRegister(tour.id, 1);
  const second = await publicRegister(tour.id, 2);
  const firstRegistrationId = first.body.registration.id as string;
  const providerPaymentId = first.body.paymentIntent.providerPaymentId as string;
  const waitlistItemId = second.body.waitlistItemId as string;

  const webhookResponse = await postSignedPaymentWebhook({
    tenant_id: TENANT_ID,
    providerPaymentId,
    status: "Failed",
    reason: "gateway_failure"
  });
  assert.equal(webhookResponse.status, 200);

  const firstRegistration = await dataSource.getRepository(RegistrationEntity).findOneByOrFail({
    id: firstRegistrationId
  });
  assert.equal(firstRegistration.status, RegistrationStatus.REJECTED);

  const waitlistRow = await dataSource.getRepository(WaitlistItemEntity).findOneByOrFail({
    id: waitlistItemId
  });
  assert.equal(waitlistRow.status, WaitlistItemStatus.CONVERTED);

  const refreshedTour = await dataSource.getRepository(TourEntity).findOneByOrFail({ id: tour.id });
  assert.equal(refreshedTour.acceptedCount, 1);
});

test("webhook returns 200 even when transition is invalid", async () => {
  if (e2eUnavailableReason) {
    return;
  }
  const tour = await createTour(1);
  const registerResponse = await publicRegister(tour.id, 1);
  assert.equal(registerResponse.status, 201);
  const providerPaymentId = registerResponse.body.paymentIntent.providerPaymentId as string;

  const webhookResponse = await postSignedPaymentWebhook({
    tenant_id: TENANT_ID,
    providerPaymentId,
    providerEventId: "evt-invalid-transition-1",
    status: "Cancelled"
  });
  assert.equal(webhookResponse.status, 200);
});

test("duplicate webhook event is deduplicated and remains 200", async () => {
  if (e2eUnavailableReason) {
    return;
  }
  const tour = await createTour(1);
  const registerResponse = await publicRegister(tour.id, 1);
  assert.equal(registerResponse.status, 201);
  const providerPaymentId = registerResponse.body.paymentIntent.providerPaymentId as string;

  const first = await postSignedPaymentWebhook({
    tenant_id: TENANT_ID,
    providerPaymentId,
    providerEventId: "evt-dedup-1",
    status: "Paid"
  });
  assert.equal(first.status, 200);

  // Replay guard keys on (timestamp, signature); identical body in the same Unix second yields the same HMAC.
  await sleep(1100);

  const second = await postSignedPaymentWebhook({
    tenant_id: TENANT_ID,
    providerPaymentId,
    providerEventId: "evt-dedup-1",
    status: "Paid"
  });
  assert.equal(second.status, 200);

  const ops = await request(app.getHttpServer())
    .get("/internal/ops/health")
    .set("x-internal-api-key", INTERNAL_API_KEY);
  assert.equal(ops.status, 200);
  assert.equal(ops.body.payments.webhookDedupedTotal >= 1, true);
});

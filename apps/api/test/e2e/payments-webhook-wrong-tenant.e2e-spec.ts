import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DataSource } from "typeorm";
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
import { signPaymentsWebhookPayload } from "./sign-payments-webhook";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import { RegistrationEntity, RegistrationPaymentStatus, RegistrationStatus } from "../../src/modules/registrations/registration.entity";
import { PaymentEntity, PaymentStatus } from "../../src/modules/payments/entities/payment.entity";
import { Role } from "../../src/modules/auth/roles.enum";

const TENANT_A = "c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1";
const TENANT_B = "d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2";
const TOUR_ID = "e3e3e3e3-e3e3-43e3-83e3-e3e3e3e3e3e3";
const REG_ID = "f4f4f4f4-f4f4-44f4-84f4-f4f4f4f4f4f4";
const PAYMENT_ID = "a5a5a5a5-a5a5-45a5-85a5-a5a5a5a5a5a5";
const PROVIDER_PAYMENT_ID = "wrong-tenant-webhook-e2e-ppid";

const WEBHOOK_SECRET = "test-webhook-hmac-secret-at-least-32chars!!!!";

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
  process.env.INTERNAL_API_KEY = "test-internal-key-wrong-tenant-webhook";
  process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET = WEBHOOK_SECRET;
}

async function seedPaymentInTenantA(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const tourRepo = ds.getRepository(TourEntity);
  const regRepo = ds.getRepository(RegistrationEntity);
  const payRepo = ds.getRepository(PaymentEntity);

  await tenantRepo.insert([
    { id: TENANT_A, name: "Tenant A (payment webhook)", description: "wrong-tenant e2e" },
    { id: TENANT_B, name: "Tenant B (decoy)", description: "wrong-tenant e2e" }
  ]);

  const user = await userRepo.save(
    userRepo.create({
      email: "payer-wrong-tenant-webhook@test.local",
      hashedPassword: "x".repeat(60),
      fullName: "Payer",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  await membershipRepo.save(
    membershipRepo.create({
      tenantId: TENANT_A,
      userId: user.id,
      role: Role.OWNER
    })
  );

  await tourRepo.save(
    tourRepo.create({
      id: TOUR_ID,
      tenantId: TENANT_A,
      title: "Wrong-tenant webhook tour",
      description: "e2e",
      totalCapacity: 10,
      acceptedCount: 0,
      lifecycleStatus: TourLifecycleStatus.OPEN,
      costContext: { base: 100, requiresPayment: true }
    })
  );

  await regRepo.save(
    regRepo.create({
      id: REG_ID,
      tenantId: TENANT_A,
      tourId: TOUR_ID,
      participantFullName: "Participant",
      participantContactPhone: "+10000000001",
      transportMode: "bus",
      entryMode: "web",
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID
    })
  );

  await payRepo.save(
    payRepo.create({
      id: PAYMENT_ID,
      tenantId: TENANT_A,
      registrationId: REG_ID,
      amount: "100",
      currency: "USD",
      provider: "internal_provider",
      providerPaymentId: PROVIDER_PAYMENT_ID,
      status: PaymentStatus.PENDING,
      paidAt: null,
      failedAt: null,
      refundedAt: null
    })
  );
}

function postSignedWebhook(
  body: Record<string, unknown>
): { raw: string; timestamp: string; signature: string } {
  const raw = JSON.stringify(body);
  const { timestamp, signature } = signPaymentsWebhookPayload(raw, WEBHOOK_SECRET);
  return { raw, timestamp, signature };
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
  await seedPaymentInTenantA(app.get(DataSource));
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("signed webhook with tenant_id mismatching payment row does not mutate payment (200 ok, unprocessed)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const payRepo = ds.getRepository(PaymentEntity);

  const beforeRow = await payRepo.findOneOrFail({ where: { id: PAYMENT_ID } });
  assert.equal(beforeRow.status, PaymentStatus.PENDING);

  const body = {
    tenant_id: TENANT_B,
    providerEventId: "evt-wrong-tenant-webhook-1",
    providerPaymentId: PROVIDER_PAYMENT_ID,
    status: "Paid"
  };
  const { raw, timestamp, signature } = postSignedWebhook(body);

  const res = await request(app.getHttpServer())
    .post("/internal/payments/webhook")
    .set("Content-Type", "application/json")
    .set("x-payments-webhook-timestamp", timestamp)
    .set("x-payments-webhook-signature", signature)
    .send(raw);

  assert.equal(res.status, 200);
  assert.equal(res.body?.ok, true);

  const afterRow = await payRepo.findOneOrFail({ where: { id: PAYMENT_ID } });
  assert.equal(afterRow.status, PaymentStatus.PENDING);
  assert.equal(afterRow.tenantId, TENANT_A);
});

test("signed webhook with correct tenant_id processes Paid transition", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const payRepo = ds.getRepository(PaymentEntity);

  const body = {
    tenant_id: TENANT_A,
    providerEventId: "evt-wrong-tenant-webhook-2",
    providerPaymentId: PROVIDER_PAYMENT_ID,
    status: "Paid"
  };
  const { raw, timestamp, signature } = postSignedWebhook(body);

  const res = await request(app.getHttpServer())
    .post("/internal/payments/webhook")
    .set("Content-Type", "application/json")
    .set("x-payments-webhook-timestamp", timestamp)
    .set("x-payments-webhook-signature", signature)
    .send(raw);

  assert.equal(res.status, 200);
  assert.equal(res.body?.ok, true);

  const row = await payRepo.findOneOrFail({ where: { id: PAYMENT_ID } });
  assert.equal(row.status, PaymentStatus.PAID);
});

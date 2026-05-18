import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import * as argon2 from "argon2";
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
import { webSessionOtpToken } from "./web-session-otp.helper";
import { tenantTestHost } from "./tenant-test-host";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./jwt-test-keys";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { MembershipStatus } from "../../src/modules/identity/membership-status.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import { TourProductEntity } from "../../src/modules/tours/entities/tour-product.entity";
import { TourDepartureEntity } from "../../src/modules/tours/entities/tour-departure.entity";
import type { TourTransportMode } from "../../src/modules/tours/tour-transport-modes";
import {
  RegistrationEntity,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { PaymentEntity, PaymentStatus } from "../../src/modules/payments/entities/payment.entity";
import { TenantHostResolverService } from "../../src/modules/tenant/tenant-host-resolver.service";

/** map-phase 7.4.e2e — independent suite (not coupled to receipt-upload-ownership). */

const TENANT_ID = "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1";
const TENANT_SLUG = "coexist-e2e";
const OWNER_PHONE = "+15557400001";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let dataSource: DataSource | undefined;
let e2eUnavailableReason: string | null = null;
let ownerToken = "";

function postSignedPaymentWebhook(body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  const secret = process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("PAYMENTS_WEBHOOK_SIGNING_SECRET must be set for webhook tests");
  }
  const { timestamp, signature } = signPaymentsWebhookPayload(raw, secret);
  return request(app!.getHttpServer())
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
  process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "test-token";
  process.env.REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
  process.env.REDIS_PORT = process.env.REDIS_PORT ?? "6379";
  process.env.OUTBOX_POLL_INTERVAL_MS = "5000";
  process.env.OUTBOX_MAX_RETRY = "5";
  process.env.OUTBOX_BATCH_SIZE = "50";
  process.env.OUTBOX_PROCESSOR_ENABLED = "false";
  process.env.RECONCILIATION_ENABLED = "false";
  process.env.PAYMENTS_TIMEOUT_ENABLED = "false";
  process.env.INTERNAL_API_KEY = "test-internal-key-coexistence-e2e";
}

async function truncateAllTables(ds: DataSource): Promise<void> {
  const rows = (await ds.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename != 'typeorm_migrations'
  `)) as Array<{ tablename: string }>;
  if (rows.length === 0) return;
  const tableList = rows.map((r) => `"${r.tablename}"`).join(", ");
  await ds.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

async function seedTenantWithOwner(ds: DataSource): Promise<void> {
  const hash = await argon2.hash(`fixture-${randomUUID()}`);
  await ds.getRepository(TenantEntity).insert({
    id: TENANT_ID,
    name: "Coexistence E2E Tenant",
    description: "payments-coexistence.e2e-spec.ts",
    subdomain: TENANT_SLUG,
    enabledModules: ["finance"]
  });
  const owner = await ds.getRepository(UserEntity).save(
    ds.getRepository(UserEntity).create({
      email: "owner@coexist-e2e.test",
      hashedPassword: hash,
      fullName: "Coexist Owner",
      isEmailVerified: true,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      telegramUserId: null
    })
  );
  await ds.getRepository(UserTenantEntity).save(
    ds.getRepository(UserTenantEntity).create({
      tenantId: TENANT_ID,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
      sessionVersion: 1
    })
  );
}

async function createPaidTour(): Promise<TourEntity> {
  const tourId = randomUUID();
  const listMinor = "250000";
  const currency = "IRR";
  const product = await dataSource!.getRepository(TourProductEntity).save(
    dataSource!.getRepository(TourProductEntity).create({
      tenantId: TENANT_ID,
      title: `coexist-product-${tourId.slice(0, 8)}`
    })
  );
  await dataSource!.getRepository(TourDepartureEntity).save(
    dataSource!.getRepository(TourDepartureEntity).create({
      id: tourId,
      tourProductId: product.id,
      tenantId: TENANT_ID,
      lifecycleStatus: TourLifecycleStatus.OPEN,
      capacityTotal: 5,
      listPriceMinor: listMinor,
      currencyCode: currency,
      startsOn: "2030-07-01"
    })
  );
  return dataSource!.getRepository(TourEntity).save(
    dataSource!.getRepository(TourEntity).create({
      id: tourId,
      tenantId: TENANT_ID,
      title: `tour-${tourId.slice(0, 8)}`,
      totalCapacity: 5,
      acceptedCount: 0,
      lifecycleStatus: TourLifecycleStatus.OPEN,
      costContext: { requiresPayment: true, totalCost: 2500, currency: "IRR" },
      tourProductId: product.id,
      tourDepartureId: tourId,
      listPriceMinor: listMinor,
      currencyCode: currency,
      transportModes: ["bus"] as TourTransportMode[]
    })
  );
}

async function publicRegister(tourId: string): Promise<request.Response> {
  return request(app!.getHttpServer())
    .post(`/api/v2/tours/${tourId}/register`)
    .set("idempotency-key", `coexist-reg-${randomUUID()}`)
    .send({
      tourId,
      participantFullName: "Coexist User",
      participantContactPhone: "+989120001234",
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
  if (e2eUnavailableReason || !dataSource || !app) return;
  await truncateAllTables(dataSource);
  await seedTenantWithOwner(dataSource);
  await app.get(TenantHostResolverService).invalidateTenantHostCacheByLabel(TENANT_SLUG);
  ownerToken = await webSessionOtpToken(app, {
    phone: OWNER_PHONE,
    tenantSubdomain: TENANT_SLUG
  });
});

after(async () => {
  if (app) {
    try {
      await app.close();
    } catch {
      /* Redis teardown flake */
    }
  }
  if (container) await container.stop();
});

test("manual debt forbidden after online webhook Paid", async () => {
  if (e2eUnavailableReason || !app) return;

  const tour = await createPaidTour();
  const registerRes = await publicRegister(tour.id);
  assert.equal(registerRes.status, 201, JSON.stringify(registerRes.body));
  const registrationId = registerRes.body.registration.id as string;
  const providerPaymentId = registerRes.body.paymentIntent.providerPaymentId as string;

  const webhookRes = await postSignedPaymentWebhook({
    tenant_id: TENANT_ID,
    providerPaymentId,
    status: "Paid"
  });
  assert.equal(webhookRes.status, 200);

  const reg = await dataSource!.getRepository(RegistrationEntity).findOneByOrFail({
    id: registrationId
  });
  assert.equal(reg.status, RegistrationStatus.ACCEPTED_PAID);

  const manualRes = await request(app.getHttpServer())
    .post("/api/v2/finance/payments/manual")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      registrationId,
      amount: "250000",
      currency: "IRR"
    });

  assert.equal(manualRes.status, 409, JSON.stringify(manualRes.body));
  assert.equal(
    manualRes.body?.error?.code,
    "PAYMENT_DEBT_AFTER_SETTLEMENT_FORBIDDEN",
    JSON.stringify(manualRes.body)
  );
});

test("manual debt allowed after online webhook Failed (recovery)", async () => {
  if (e2eUnavailableReason || !app) return;

  const tour = await createPaidTour();
  const registerRes = await publicRegister(tour.id);
  assert.equal(registerRes.status, 201);
  const registrationId = registerRes.body.registration.id as string;
  const providerPaymentId = registerRes.body.paymentIntent.providerPaymentId as string;

  const webhookRes = await postSignedPaymentWebhook({
    tenant_id: TENANT_ID,
    providerPaymentId,
    status: "Failed",
    reason: "gateway_failure"
  });
  assert.equal(webhookRes.status, 200);

  const failedPayment = await dataSource!.getRepository(PaymentEntity).findOneByOrFail({
    providerPaymentId,
    tenantId: TENANT_ID
  });
  assert.equal(failedPayment.status, PaymentStatus.FAILED);

  const manualRes = await request(app.getHttpServer())
    .post("/api/v2/finance/payments/manual")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      registrationId,
      amount: "250000",
      currency: "IRR"
    });

  assert.equal(manualRes.status, 201, JSON.stringify(manualRes.body));
  assert.equal(manualRes.body.status, PaymentStatus.PENDING);
});

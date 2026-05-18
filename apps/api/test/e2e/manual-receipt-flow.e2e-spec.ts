import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import * as argon2 from "argon2";
import request from "supertest";
import { DataSource } from "typeorm";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer
} from "@testcontainers/postgresql";
import { assignTestApiPort } from "./assign-test-api-port";
import { createE2EApp } from "./bootstrap";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import { webSessionOtpToken } from "./web-session-otp.helper";
import { tenantTestHost } from "./tenant-test-host";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./jwt-test-keys";
import { InMemoryFileStorageAdapter } from "../helpers/in-memory-file-storage.adapter";
import { MinioStorageAdapter } from "../../src/infra/storage/minio-storage.adapter";
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
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import {
  PaymentEntity,
  PaymentMethod,
  PaymentStatus
} from "../../src/modules/payments/entities/payment.entity";
import { PaymentReceiptEntity, ReceiptStatus } from "../../src/modules/payments/entities/payment-receipt.entity";
import { BookingPriceSnapshotEntity } from "../../src/modules/pricing/entities/booking-price-snapshot.entity";

const TENANT_ID = "f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1";
const TENANT_SLUG = "receipt-e2e";
const TOUR_ID = "f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2";
const DEPARTURE_ID = "f3f3f3f3-f3f3-43f3-83f3-f3f3f3f3f3f3";
const REG_ID = "f4f4f4f4-f4f4-44f4-84f4-f4f4f4f4f4f4";
const REG_ID_2 = "f6f6f6f6-f6f6-46f6-86f6-f6f6f6f6f6f6";
const PAYMENT_ID = "f5f5f5f5-f5f5-45f5-85f5-f5f5f5f5f5f5";

const OWNER_PHONE = "+15557300001";
const MEMBER_PHONE = "+15557300002";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let ownerToken = "";
let memberToken = "";

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
  process.env.OUTBOX_PROCESSOR_ENABLED = "false";
  process.env.RECONCILIATION_ENABLED = "false";
  process.env.PAYMENTS_TIMEOUT_ENABLED = "false";
  process.env.INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "test-internal-key-receipt-e2e";
}

async function seedFinanceFixture(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const tourRepo = ds.getRepository(TourEntity);
  const productRepo = ds.getRepository(TourProductEntity);
  const departureRepo = ds.getRepository(TourDepartureEntity);
  const regRepo = ds.getRepository(RegistrationEntity);
  const payRepo = ds.getRepository(PaymentEntity);
  const hash = await argon2.hash(`fixture-${randomUUID()}`);
  const listMinor = "1200000";
  const currency = "IRR";

  await tenantRepo.insert({
    id: TENANT_ID,
    name: "Receipt E2E Tenant",
    description: "manual receipt flow",
    subdomain: TENANT_SLUG,
    enabledModules: ["finance", "form_builder"]
  });

  const owner = await userRepo.save(
    userRepo.create({
      email: "owner@receipt-e2e.test",
      hashedPassword: hash,
      fullName: "Receipt Owner",
      isEmailVerified: true,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      telegramUserId: null
    })
  );
  const member = await userRepo.save(
    userRepo.create({
      email: "member@receipt-e2e.test",
      hashedPassword: hash,
      fullName: "Receipt Member",
      isEmailVerified: true,
      phone: MEMBER_PHONE,
      isPhoneVerified: true,
      telegramUserId: null
    })
  );

  await membershipRepo.save([
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
      sessionVersion: 1
    }),
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: member.id,
      role: UserRole.Member,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
      sessionVersion: 1
    })
  ]);

  const product = await productRepo.save(
    productRepo.create({
      tenantId: TENANT_ID,
      title: "Receipt E2E Product"
    })
  );

  await departureRepo.save(
    departureRepo.create({
      id: DEPARTURE_ID,
      tourProductId: product.id,
      tenantId: TENANT_ID,
      lifecycleStatus: TourLifecycleStatus.OPEN,
      capacityTotal: 10,
      listPriceMinor: listMinor,
      currencyCode: currency,
      startsOn: "2030-09-01"
    })
  );

  await tourRepo.save(
    tourRepo.create({
      id: TOUR_ID,
      tenantId: TENANT_ID,
      title: "Receipt E2E Tour",
      lifecycleStatus: TourLifecycleStatus.OPEN,
      totalCapacity: 10,
      acceptedCount: 1,
      autoAcceptRegistrations: true,
      costContext: { currency, totalCost: 1_200_000, requiresPayment: true },
      tourProductId: product.id,
      tourDepartureId: DEPARTURE_ID,
      listPriceMinor: listMinor,
      currencyCode: currency,
      transportModes: ["bus"] as TourTransportMode[]
    })
  );

  await regRepo.save(
    regRepo.create({
      id: REG_ID,
      tenantId: TENANT_ID,
      tourId: TOUR_ID,
      tourDepartureId: DEPARTURE_ID,
      participantFullName: "Payer Participant",
      participantContactPhone: MEMBER_PHONE,
      transportMode: "group_vehicle",
      entryMode: "web",
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      quotedListPriceMinor: listMinor,
      quotedTotalMinor: listMinor,
      quotedCurrencyCode: currency,
      quotedPricingVersion: "e2e-receipt-v1"
    })
  );

  await ds.query(`SELECT set_config('app.tenant_id', $1, false)`, [TENANT_ID]);
  const snapshotRepo = ds.getRepository(BookingPriceSnapshotEntity);
  const snapshot = await snapshotRepo.save(
    snapshotRepo.create({
      tenantId: TENANT_ID,
      bookingId: REG_ID,
      listPriceMinor: listMinor,
      currency,
      pricingRuleVersion: "e2e-receipt-v1",
      computedTotalMinor: listMinor
    })
  );
  await regRepo.update({ id: REG_ID }, { snapshotId: snapshot.snapshotId });

  await regRepo.save(
    regRepo.create({
      id: REG_ID_2,
      tenantId: TENANT_ID,
      tourId: TOUR_ID,
      tourDepartureId: DEPARTURE_ID,
      participantFullName: "Manual Debt Participant",
      participantContactPhone: "+15557300003",
      transportMode: "group_vehicle",
      entryMode: "web",
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      quotedListPriceMinor: listMinor,
      quotedTotalMinor: listMinor,
      quotedCurrencyCode: currency,
      quotedPricingVersion: "e2e-receipt-v1"
    })
  );
  const snapshot2 = await snapshotRepo.save(
    snapshotRepo.create({
      tenantId: TENANT_ID,
      bookingId: REG_ID_2,
      listPriceMinor: listMinor,
      currency,
      pricingRuleVersion: "e2e-receipt-v1",
      computedTotalMinor: listMinor
    })
  );
  await regRepo.update({ id: REG_ID_2 }, { snapshotId: snapshot2.snapshotId });

  await payRepo.save(
    payRepo.create({
      id: PAYMENT_ID,
      tenantId: TENANT_ID,
      registrationId: REG_ID,
      amount: "1200000",
      currency: "IRR",
      method: PaymentMethod.MANUAL,
      status: PaymentStatus.PENDING,
      provider: "manual"
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
  app = await createE2EApp((builder) =>
    builder.overrideProvider(MinioStorageAdapter).useClass(InMemoryFileStorageAdapter)
  );
  await seedFinanceFixture(app.get(DataSource));
  ownerToken = await webSessionOtpToken(app, {
    phone: OWNER_PHONE,
    tenantSubdomain: TENANT_SLUG
  });
  memberToken = await webSessionOtpToken(app, {
    phone: MEMBER_PHONE,
    tenantSubdomain: TENANT_SLUG
  });
});

after(async () => {
  if (app) {
    try {
      await app.close();
    } catch {
      // Local e2e may not have Redis; avoid failing the hook after a passing test.
    }
  }
  if (container) {
    await container.stop();
  }
});

test("manual payment create persists (HTTP)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }

  const host = tenantTestHost(TENANT_SLUG);
  const ds = app.get(DataSource);

  const manualRes = await request(app.getHttpServer())
    .post("/api/v2/finance/payments/manual")
    .set("Host", host)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      registrationId: REG_ID_2,
      amount: "500000",
      currency: "IRR"
    });

  assert.equal(manualRes.status, 201, JSON.stringify(manualRes.body));
  assert.equal(manualRes.body.method, PaymentMethod.MANUAL);
  assert.equal(manualRes.body.status, PaymentStatus.PENDING);
  const createdPaymentId = manualRes.body.id as string;

  await ds.query(`SELECT set_config('app.tenant_id', $1, true)`, [TENANT_ID]);
  const persisted = (await ds.query(
    `SELECT id, method, status, amount::text AS amount FROM payments WHERE id = $1`,
    [createdPaymentId]
  )) as Array<{ id: string; method: string; status: string; amount: string }>;
  assert.equal(persisted.length, 1, "manual payment HTTP create did not commit");
  assert.equal(persisted[0]!.method, PaymentMethod.MANUAL);
  assert.equal(persisted[0]!.status, PaymentStatus.PENDING);
  assert.equal(persisted[0]!.amount, "500000");

  const listRes = await request(app.getHttpServer())
    .get("/api/v2/finance/payments")
    .set("Host", host)
    .set("Authorization", `Bearer ${ownerToken}`);

  assert.equal(listRes.status, 200, JSON.stringify(listRes.body));
  const listed = listRes.body as Array<{ id: string }>;
  assert.ok(
    listed.some((row) => row.id === createdPaymentId),
    "created manual payment missing from list endpoint"
  );
});

test("upload receipt → approve → registration paid", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }

  const host = tenantTestHost(TENANT_SLUG);
  const ds = app.get(DataSource);
  const paymentId = PAYMENT_ID;

  const receiptRes = await request(app.getHttpServer())
    .post(`/api/v2/finance/payments/${paymentId}/receipt`)
    .set("Host", host)
    .set("Authorization", `Bearer ${memberToken}`)
    .field("note", "bank transfer ref 12345")
    .attach("file", Buffer.from("fake-png-bytes"), {
      filename: "receipt.png",
      contentType: "image/png"
    });

  assert.equal(receiptRes.status, 201, JSON.stringify(receiptRes.body));
  assert.equal(receiptRes.body.status, ReceiptStatus.PENDING);
  const receiptId = receiptRes.body.id as string;

  const approveRes = await request(app.getHttpServer())
    .post(`/api/v2/admin/finance/receipts/${receiptId}/approve`)
    .set("Host", host)
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ reviewNote: "verified in e2e" });

  assert.equal(approveRes.status, 201, JSON.stringify(approveRes.body));
  assert.equal(approveRes.body.status, ReceiptStatus.APPROVED);

  const payment = await ds.getRepository(PaymentEntity).findOneByOrFail({ id: paymentId });
  assert.equal(payment.status, PaymentStatus.PAID);
  assert.ok(payment.paidAt);

  const registration = await ds.getRepository(RegistrationEntity).findOneByOrFail({ id: REG_ID });
  assert.equal(registration.status, RegistrationStatus.ACCEPTED_PAID);
  assert.equal(registration.paymentStatus, RegistrationPaymentStatus.PAID);

  const receipt = await ds.getRepository(PaymentReceiptEntity).findOneByOrFail({ id: receiptId });
  assert.equal(receipt.status, ReceiptStatus.APPROVED);
  assert.ok(receipt.fileKey.includes(TENANT_ID));

  const ledgerRes = await request(app.getHttpServer())
    .get("/api/v2/finance/reports/ledger-events")
    .set("Host", host)
    .set("Authorization", `Bearer ${ownerToken}`);

  assert.equal(ledgerRes.status, 200, JSON.stringify(ledgerRes.body));
  const events = ledgerRes.body as Array<{ eventType: string; registrationId?: string }>;
  assert.ok(
    events.some(
      (e) =>
        e.eventType === "finance.ledger.double_entry_applied" &&
        (e.registrationId === REG_ID || e.registrationId === undefined)
    ),
    `expected ledger event after approve: ${JSON.stringify(events)}`
  );
});

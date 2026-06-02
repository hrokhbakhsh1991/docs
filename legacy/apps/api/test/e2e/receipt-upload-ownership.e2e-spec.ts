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
import { TenantHostResolverService } from "../../src/modules/tenant/tenant-host-resolver.service";
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
import { BookingPriceSnapshotEntity } from "../../src/modules/pricing/entities/booking-price-snapshot.entity";

/** map-phase 8.3.e2e — independent suite from payments-coexistence. */

const TENANT_ID = "b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2";
const TENANT_SLUG = "receipt-owner-e2e";
const TOUR_ID = "c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3";
const DEPARTURE_ID = "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4";
const REG_ID = "e5e5e5e5-e5e5-45e5-85e5-e5e5e5e5e5e5";
const PAYMENT_ID = "f6f6f6f6-f6f6-46f6-86f6-f6f6f6f6f6f6";

const OWNER_PHONE = "+15557500000";
const PARTICIPANT_PHONE = "+15557500001";
const OTHER_MEMBER_PHONE = "+15557500002";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let participantToken = "";
let otherMemberToken = "";

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
  process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "test-token";
  process.env.REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
  process.env.REDIS_PORT = process.env.REDIS_PORT ?? "6379";
  process.env.OUTBOX_PROCESSOR_ENABLED = "false";
  process.env.INTERNAL_API_KEY = "test-internal-key-receipt-ownership-e2e";
}

async function seedFixture(ds: DataSource): Promise<void> {
  const hash = await argon2.hash(`fixture-${randomUUID()}`);
  const listMinor = "1200000";
  const currency = "IRR";

  await ds.getRepository(TenantEntity).insert({
    id: TENANT_ID,
    name: "Receipt ownership E2E",
    subdomain: TENANT_SLUG,
    enabledModules: ["finance"]
  });

  const owner = await ds.getRepository(UserEntity).save(
    ds.getRepository(UserEntity).create({
      email: "owner@receipt-owner-e2e.test",
      hashedPassword: hash,
      fullName: "Workspace Owner",
      isEmailVerified: true,
      phone: OWNER_PHONE,
      isPhoneVerified: true
    })
  );
  const participant = await ds.getRepository(UserEntity).save(
    ds.getRepository(UserEntity).create({
      email: "participant@receipt-owner-e2e.test",
      hashedPassword: hash,
      fullName: "Participant",
      isEmailVerified: true,
      phone: PARTICIPANT_PHONE,
      isPhoneVerified: true
    })
  );
  const other = await ds.getRepository(UserEntity).save(
    ds.getRepository(UserEntity).create({
      email: "other@receipt-owner-e2e.test",
      hashedPassword: hash,
      fullName: "Other Member",
      isEmailVerified: true,
      phone: OTHER_MEMBER_PHONE,
      isPhoneVerified: true
    })
  );

  const membershipRepo = ds.getRepository(UserTenantEntity);
  await membershipRepo.save(
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
      sessionVersion: 1
    })
  );
  for (const user of [participant, other]) {
    await membershipRepo.save(
      membershipRepo.create({
        tenantId: TENANT_ID,
        userId: user.id,
        role: UserRole.Member,
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date(),
        sessionVersion: 1
      })
    );
  }

  const product = await ds.getRepository(TourProductEntity).save(
    ds.getRepository(TourProductEntity).create({ tenantId: TENANT_ID, title: "Ownership tour" })
  );
  await ds.getRepository(TourDepartureEntity).save(
    ds.getRepository(TourDepartureEntity).create({
      id: DEPARTURE_ID,
      tourProductId: product.id,
      tenantId: TENANT_ID,
      lifecycleStatus: TourLifecycleStatus.OPEN,
      capacityTotal: 10,
      listPriceMinor: listMinor,
      currencyCode: currency,
      startsOn: "2030-10-01"
    })
  );
  await ds.getRepository(TourEntity).save(
    ds.getRepository(TourEntity).create({
      id: TOUR_ID,
      tenantId: TENANT_ID,
      title: "Ownership tour",
      totalCapacity: 10,
      acceptedCount: 1,
      lifecycleStatus: TourLifecycleStatus.OPEN,
      tourProductId: product.id,
      tourDepartureId: DEPARTURE_ID,
      listPriceMinor: listMinor,
      currencyCode: currency,
      transportModes: ["bus"] as TourTransportMode[]
    })
  );

  await ds.getRepository(RegistrationEntity).save(
    ds.getRepository(RegistrationEntity).create({
      id: REG_ID,
      tenantId: TENANT_ID,
      tourId: TOUR_ID,
      tourDepartureId: DEPARTURE_ID,
      participantFullName: "Debt owner",
      participantContactPhone: PARTICIPANT_PHONE,
      transportMode: "group_vehicle",
      entryMode: "web",
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID,
      quotedListPriceMinor: listMinor,
      quotedTotalMinor: listMinor,
      quotedCurrencyCode: currency,
      quotedPricingVersion: "e2e-ownership-v1"
    })
  );

  const snapshot = await ds.getRepository(BookingPriceSnapshotEntity).save(
    ds.getRepository(BookingPriceSnapshotEntity).create({
      tenantId: TENANT_ID,
      bookingId: REG_ID,
      listPriceMinor: listMinor,
      currency,
      pricingRuleVersion: "e2e-ownership-v1",
      computedTotalMinor: listMinor
    })
  );
  await ds.getRepository(RegistrationEntity).update({ id: REG_ID }, { snapshotId: snapshot.snapshotId });

  await ds.getRepository(PaymentEntity).save(
    ds.getRepository(PaymentEntity).create({
      id: PAYMENT_ID,
      tenantId: TENANT_ID,
      registrationId: REG_ID,
      amount: listMinor,
      currency,
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
  await seedFixture(app.get(DataSource));
  await app.get(TenantHostResolverService).invalidateTenantHostCacheByLabel(TENANT_SLUG);
  participantToken = await webSessionOtpToken(app, {
    phone: PARTICIPANT_PHONE,
    tenantSubdomain: TENANT_SLUG
  });
  otherMemberToken = await webSessionOtpToken(app, {
    phone: OTHER_MEMBER_PHONE,
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

test("unrelated member cannot upload receipt for another participant payment", async () => {
  if (e2eUnavailableReason || !app) return;

  const host = tenantTestHost(TENANT_SLUG);
  const res = await request(app.getHttpServer())
    .post(`/api/v2/finance/payments/${PAYMENT_ID}/receipt`)
    .set("Host", host)
    .set("Authorization", `Bearer ${otherMemberToken}`)
    .field("note", "wrong user")
    .attach("file", Buffer.from("fake"), { filename: "r.png", contentType: "image/png" });

  assert.equal(res.status, 403, JSON.stringify(res.body));
  assert.equal(res.body?.error?.code, "NOT_AUTHORIZED_TO_UPLOAD_RECEIPT_FOR_THIS_PAYMENT");
});

test("participant with matching phone can upload receipt", async () => {
  if (e2eUnavailableReason || !app) return;

  const host = tenantTestHost(TENANT_SLUG);
  const res = await request(app.getHttpServer())
    .post(`/api/v2/finance/payments/${PAYMENT_ID}/receipt`)
    .set("Host", host)
    .set("Authorization", `Bearer ${participantToken}`)
    .field("note", "my transfer")
    .attach("file", Buffer.from("ok"), { filename: "r.png", contentType: "image/png" });

  assert.equal(res.status, 201, JSON.stringify(res.body));
});

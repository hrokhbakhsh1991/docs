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
import { tenantTestHost } from "./tenant-test-host";
import { webSessionOtpToken } from "./web-session-otp.helper";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./jwt-test-keys";
import { syntheticBookingContactPhone } from "../../src/common/security/ownership-scope";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { MembershipStatus } from "../../src/modules/identity/membership-status.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../../src/modules/registrations/registration.entity";
import { TourDepartureEntity } from "../../src/modules/tours/entities/tour-departure.entity";
import { TourProductEntity } from "../../src/modules/tours/entities/tour-product.entity";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";
import type { TourTransportMode } from "../../src/modules/tours/tour-transport-modes";

const TENANT_ID = "f6f6f6f6-f6f6-46f6-86f6-f6f6f6f6f6f6";
const OTHER_TENANT = "a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7";

const OWNER_EMAIL = "owner@workspace-users-mutations.test";
const ADMIN_EMAIL = "admin@workspace-users-mutations.test";
const MEMBER_EMAIL = "member@workspace-users-mutations.test";
const OTHER_ONLY_EMAIL = "otheronly@workspace-users-mutations.test";
const OWNER_PHONE = "+15557300001";
const ADMIN_PHONE = "+15557300002";
const MEMBER_PHONE = "+15557300003";
const OTHER_ONLY_PHONE = "+15557300004";

const RETRYABILITY_VALUES = new Set([
  "NO_RETRY",
  "SAFE_RETRY",
  "RETRY_WITH_BACKOFF",
  "RETRY_AFTER_ACTION"
]);

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let tokenOwner = "";
let tokenAdmin = "";
let memberUserId = "";
let otherOnlyUserId = "";

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
  process.env.INTERNAL_API_KEY =
    process.env.INTERNAL_API_KEY ?? "test-internal-key-workspace-users-mutations";
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

async function otpSession(phone: string, tenantSlug: string): Promise<string> {
  if (!app) {
    throw new Error("app not initialized");
  }
  return webSessionOtpToken(app, { phone, tenantSubdomain: tenantSlug });
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);

  await tenantRepo.insert([
    {
      id: TENANT_ID,
      name: "Workspace users mutations tenant",
      description: "workspace-users-mutations e2e",
      subdomain: "wsum-main"
    },
    {
      id: OTHER_TENANT,
      name: "Workspace users mutations other",
      description: "cross-tenant isolation",
      subdomain: "wsum-other"
    }
  ]);

  const owner = await userRepo.save(
    userRepo.create({
      email: OWNER_EMAIL,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Owner",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  const admin = await userRepo.save(
    userRepo.create({
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Admin",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  const member = await userRepo.save(
    userRepo.create({
      email: MEMBER_EMAIL,
      phone: MEMBER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Member",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  memberUserId = member.id;
  const otherOnly = await userRepo.save(
    userRepo.create({
      email: OTHER_ONLY_EMAIL,
      phone: OTHER_ONLY_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Other only",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  otherOnlyUserId = otherOnly.id;

  await membershipRepo.save([
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE
    }),
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: admin.id,
      role: UserRole.Admin,
      status: MembershipStatus.ACTIVE
    }),
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: member.id,
      role: UserRole.Member,
      status: MembershipStatus.ACTIVE
    }),
    membershipRepo.create({
      tenantId: OTHER_TENANT,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE
    }),
    membershipRepo.create({
      tenantId: OTHER_TENANT,
      userId: otherOnly.id,
      role: UserRole.Member,
      status: MembershipStatus.ACTIVE
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

  tokenOwner = await otpSession(OWNER_PHONE, "wsum-main");
  tokenAdmin = await otpSession(ADMIN_PHONE, "wsum-main");
});

after(async () => {
  if (app) {
    try {
      await app.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/Connection is closed/i.test(message)) {
        throw error;
      }
    }
  }
  if (container) {
    await container.stop();
  }
});

test("PATCH workspaces/users/:id/role: owner changes member role (200); session_version increments", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const before = await ds.getRepository(UserTenantEntity).findOneOrFail({
    where: { tenantId: TENANT_ID, userId: memberUserId }
  });
  const svBefore = before.sessionVersion;
  const nextRole = before.role === UserRole.Viewer ? UserRole.Member : UserRole.Viewer;

  const res = await request(app.getHttpServer())
    .patch(`/api/v2/workspaces/users/${memberUserId}/role`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`)
    .set("Idempotency-Key", randomUUID())
    .send({ role: nextRole });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.role, nextRole);

  const after = await ds.getRepository(UserTenantEntity).findOneOrFail({
    where: { tenantId: TENANT_ID, userId: memberUserId }
  });
  assert.equal(after.sessionVersion, svBefore + 1);
});

test("PATCH workspaces/users/:id/role: admin forbidden (403)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .patch(`/api/v2/workspaces/users/${memberUserId}/role`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .set("Idempotency-Key", randomUUID())
    .send({ role: "viewer" });

  assert.equal(res.status, 403);
  assertErrorEnvelope(res);
});

test("PATCH workspaces/users/:id/role: stale JWT after role change is AUTH_TOKEN_REVOKED", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const memberToken = await otpSession(MEMBER_PHONE, "wsum-main");
  const ds = app.get(DataSource);
  const ut = await ds.getRepository(UserTenantEntity).findOneOrFail({
    where: { tenantId: TENANT_ID, userId: memberUserId }
  });
  const nextRole = ut.role === UserRole.Viewer ? UserRole.Member : UserRole.Viewer;

  const patch = await request(app.getHttpServer())
    .patch(`/api/v2/workspaces/users/${memberUserId}/role`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`)
    .set("Idempotency-Key", randomUUID())
    .send({ role: nextRole });
  assert.equal(patch.status, 200);

  const tours = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${memberToken}`);
  assert.equal(tours.status, 401);
  assert.equal(tours.body?.error?.code, "AUTH_TOKEN_REVOKED");
  assertErrorEnvelope(tours);
});

test("POST workspaces/users/:id/rewards: owner sets discount and badges (200)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/users/${memberUserId}/rewards`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      permanentDiscountPercentage: 10,
      badges: ["VIP_MEMBER", "LEADER_BUDDY"]
    });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.permanentDiscountPercentage, 10);
  assert.deepEqual(res.body.rewardBadges, ["VIP_MEMBER", "LEADER_BUDDY"]);
});

test("POST workspaces/users/:id/rewards: discount 101 rejected (400)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/users/${memberUserId}/rewards`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`)
    .set("Idempotency-Key", randomUUID())
    .send({ permanentDiscountPercentage: 101 });

  assert.equal(res.status, 400);
  assertErrorEnvelope(res);
});

test("GET /api/v2/users list includes wallet currency and booking summary scalars", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .get("/api/v2/users?limit=10")
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`);

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(Array.isArray(res.body.data), true);
  assert.equal(res.body.data.length > 0, true);

  const memberRow = res.body.data.find((row: { id: string }) => row.id === memberUserId);
  assert.ok(memberRow, "member row missing from directory list");

  for (const row of res.body.data as Array<{
    walletCurrency?: unknown;
    walletBalanceMinor?: unknown;
    totalTrips?: unknown;
    completedTrips?: unknown;
    cancelledTrips?: unknown;
  }>) {
    assert.equal(typeof row.walletCurrency, "string");
    if (typeof row.walletCurrency === "string") {
      assert.equal(row.walletCurrency.trim().length > 0, true);
    }
    assert.equal(typeof row.walletBalanceMinor, "string");
    assert.equal(typeof row.totalTrips, "number");
    assert.equal(typeof row.completedTrips, "number");
    assert.equal(typeof row.cancelledTrips, "number");
  }
});

test("GET workspaces/users/:id/booking-summary: owner returns trip counts (200)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const tourId = randomUUID();
  const listMinor = "100000";
  const currency = "IRR";
  const product = await ds.getRepository(TourProductEntity).save(
    ds.getRepository(TourProductEntity).create({
      tenantId: TENANT_ID,
      title: "Booking summary e2e"
    })
  );
  await ds.getRepository(TourDepartureEntity).save(
    ds.getRepository(TourDepartureEntity).create({
      id: tourId,
      tourProductId: product.id,
      tenantId: TENANT_ID,
      lifecycleStatus: TourLifecycleStatus.OPEN,
      capacityTotal: 5,
      listPriceMinor: listMinor,
      currencyCode: currency,
      startsOn: "2020-01-01"
    })
  );
  await ds.getRepository(TourEntity).save(
    ds.getRepository(TourEntity).create({
      id: tourId,
      tenantId: TENANT_ID,
      title: "Booking summary e2e",
      totalCapacity: 5,
      acceptedCount: 0,
      lifecycleStatus: TourLifecycleStatus.OPEN,
      tourProductId: product.id,
      tourDepartureId: tourId,
      listPriceMinor: listMinor,
      currencyCode: currency,
      startsOn: "2020-01-01",
      transportModes: ["bus"] as TourTransportMode[]
    })
  );
  const phone = syntheticBookingContactPhone(memberUserId);
  await ds.getRepository(RegistrationEntity).save(
    ds.getRepository(RegistrationEntity).create({
      tenantId: TENANT_ID,
      tourId,
      tourDepartureId: tourId,
      participantFullName: "Member",
      participantContactPhone: phone,
      transportMode: "bus",
      entryMode: "web",
      status: RegistrationStatus.ACCEPTED,
      paymentStatus: RegistrationPaymentStatus.PAID
    })
  );
  await ds.getRepository(RegistrationEntity).save(
    ds.getRepository(RegistrationEntity).create({
      tenantId: TENANT_ID,
      tourId,
      tourDepartureId: tourId,
      participantFullName: "Member",
      participantContactPhone: phone,
      transportMode: "bus",
      entryMode: "web",
      status: RegistrationStatus.CANCELLED,
      paymentStatus: RegistrationPaymentStatus.NOT_PAID
    })
  );

  const res = await request(app.getHttpServer())
    .get(`/api/v2/workspaces/users/${memberUserId}/booking-summary`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`);

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.totalTrips, 2);
  assert.equal(res.body.completedTrips, 1);
  assert.equal(res.body.cancelledTrips, 1);
  assert.equal(Array.isArray(res.body.trips), true);
  assert.equal(res.body.trips.length, 2);
  const titles = (res.body.trips as Array<{ tourTitle: string }>).map((t) => t.tourTitle);
  assert.ok(titles.includes("Booking summary e2e"));
  const paidRow = (res.body.trips as Array<{ registrationStatus: string; paymentStatus: string }>).find(
    (t) => t.registrationStatus === RegistrationStatus.ACCEPTED
  );
  assert.ok(paidRow);
  assert.equal(paidRow?.paymentStatus, RegistrationPaymentStatus.PAID);
});

test("GET /api/v2/users/invites: lists pending invite after POST invite; DELETE cancels", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const invitePhone = "+15557300999";
  const create = await request(app.getHttpServer())
    .post("/api/v2/users/invite")
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`)
    .set("Idempotency-Key", randomUUID())
    .send({ phone: invitePhone, role: "viewer" });

  assert.equal(create.status, 201, JSON.stringify(create.body));
  const inviteId = create.body.inviteId as string;
  assert.ok(inviteId);

  const list = await request(app.getHttpServer())
    .get("/api/v2/users/invites")
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`);

  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal(Array.isArray(list.body.data), true);
  const row = (list.body.data as Array<{ inviteId: string; phone: string }>).find(
    (r) => r.inviteId === inviteId
  );
  assert.ok(row, "pending invite row missing from list");
  assert.equal(row?.phone, invitePhone);

  const cancel = await request(app.getHttpServer())
    .delete(`/api/v2/users/invites/${inviteId}`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`);

  assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
  assert.equal(cancel.body.status, "EXPIRED");

  const listAfter = await request(app.getHttpServer())
    .get("/api/v2/users/invites")
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`);

  assert.equal(listAfter.status, 200);
  const stillPending = (listAfter.body.data as Array<{ inviteId: string }>).some(
    (r) => r.inviteId === inviteId
  );
  assert.equal(stillPending, false);
});

test("POST workspaces/users/:id/rewards: owner persists labels on membership (200)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const res = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/users/${memberUserId}/rewards`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`)
    .set("Idempotency-Key", randomUUID())
    .send({ labels: ["vip_client", "repeat_guest"] });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.labels, ["vip_client", "repeat_guest"]);

  const ut = await ds.getRepository(UserTenantEntity).findOneOrFail({
    where: { tenantId: TENANT_ID, userId: memberUserId }
  });
  assert.deepEqual(ut.labels, ["vip_client", "repeat_guest"]);
});

test("POST workspaces/users/:id/rewards: preserves unrelated membership_metadata keys (jsonb merge)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const regionId = randomUUID();
  const ut = await ds.getRepository(UserTenantEntity).findOneOrFail({
    where: { tenantId: TENANT_ID, userId: memberUserId }
  });
  await ds.getRepository(UserTenantEntity).update(
    { id: ut.id },
    {
      membershipMetadata: {
        allowedRegionIds: [regionId],
        permanentDiscountPercentage: 5,
        badges: ["VIP_MEMBER"],
        customRetentionFlag: true
      }
    }
  );

  const res = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/users/${memberUserId}/rewards`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`)
    .set("Idempotency-Key", randomUUID())
    .send({ permanentDiscountPercentage: 15 });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.permanentDiscountPercentage, 15);

  const after = await ds.getRepository(UserTenantEntity).findOneOrFail({
    where: { id: ut.id }
  });
  const meta = after.membershipMetadata as Record<string, unknown>;
  assert.deepEqual(meta.allowedRegionIds, [regionId]);
  assert.deepEqual(meta.badges, ["VIP_MEMBER"]);
  assert.equal(meta.customRetentionFlag, true);
});

test("POST workspaces/users/:id/selectable-leader: preserves custom capability tokens (raw jsonb)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const customToken = "custom.legacy.workspace.cap";
  const ut = await ds.getRepository(UserTenantEntity).findOneOrFail({
    where: { tenantId: TENANT_ID, userId: memberUserId }
  });
  await ds.getRepository(UserTenantEntity).update(
    { id: ut.id },
    {
      membershipMetadata: {
        capabilities: [customToken, "tour.regional.manage"]
      }
    }
  );

  const res = await request(app.getHttpServer())
    .post(`/api/v2/workspaces/users/${memberUserId}/selectable-leader`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`)
    .set("Idempotency-Key", randomUUID())
    .send({ enabled: true });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.isSelectableLeader, true);

  const after = await ds.getRepository(UserTenantEntity).findOneOrFail({
    where: { id: ut.id }
  });
  const meta = after.membershipMetadata as Record<string, unknown>;
  const caps = meta.capabilities as string[];
  assert.ok(Array.isArray(caps));
  assert.ok(caps.includes(customToken));
  assert.ok(caps.includes("tour.regional.manage"));
  assert.ok(caps.includes("capability.is_selectable_leader"));
});

test("GET workspaces/users/:id/booking-summary: member forbidden (403)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const memberToken = await otpSession(MEMBER_PHONE, "wsum-main");
  const res = await request(app.getHttpServer())
    .get(`/api/v2/workspaces/users/${memberUserId}/booking-summary`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${memberToken}`);

  assert.equal(res.status, 403);
  assertErrorEnvelope(res);
});

test("PATCH workspaces/users/:id/role: user outside tenant returns 404", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .patch(`/api/v2/workspaces/users/${otherOnlyUserId}/role`)
    .set("Host", tenantTestHost("wsum-main"))
    .set("Authorization", `Bearer ${tokenOwner}`)
    .set("Idempotency-Key", randomUUID())
    .send({ role: "viewer" });

  assert.equal(res.status, 404);
  assertErrorEnvelope(res);
});

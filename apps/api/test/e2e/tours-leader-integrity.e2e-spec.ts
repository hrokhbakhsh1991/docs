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
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { assignTestApiPort } from "./assign-test-api-port";
import { createE2EApp } from "./bootstrap";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import { tenantTestHost } from "./tenant-test-host";
import { webSessionOtpToken } from "./web-session-otp.helper";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI,
} from "./jwt-test-keys";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { MembershipStatus } from "../../src/modules/identity/membership-status.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { WorkspaceTourWizardTemplateEntity } from "../../src/modules/settings-locations/entities/workspace-tour-wizard-template.entity";

const TENANT_A = "f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1";
const TENANT_B = "f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2";
const TENANT_A_SLUG = "leader-int-a";
const OWNER_PHONE = "+15559100001";
const FOREIGN_PHONE = "+15559100002";
const MEMBER_PHONE = "+15559100003";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let ownerToken = "";
let ownerUserId = "";
let foreignUserId = "";
let ineligibleMemberId = "";

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
  process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET =
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET ??
    "test-webhook-hmac-secret-at-least-32chars!!!!";
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);

  await tenantRepo.insert([
    {
      id: TENANT_A,
      name: "Leader integrity A",
      description: "tours-leader-integrity e2e",
      subdomain: TENANT_A_SLUG,
    },
    {
      id: TENANT_B,
      name: "Leader integrity B",
      description: "tours-leader-integrity e2e",
      subdomain: "leader-int-b",
    },
  ]);

  const owner = await userRepo.save(
    userRepo.create({
      email: "owner@leader-integrity.test",
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Owner A",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );
  ownerUserId = owner.id;

  const foreignUser = await userRepo.save(
    userRepo.create({
      email: "foreign@leader-integrity.test",
      phone: FOREIGN_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Foreign B",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );
  foreignUserId = foreignUser.id;

  const member = await userRepo.save(
    userRepo.create({
      email: "member@leader-integrity.test",
      phone: MEMBER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Member A",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );
  ineligibleMemberId = member.id;

  await membershipRepo.save([
    membershipRepo.create({
      tenantId: TENANT_A,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    }),
    membershipRepo.create({
      tenantId: TENANT_A,
      userId: member.id,
      role: UserRole.Member,
      status: MembershipStatus.ACTIVE,
      membershipMetadata: {},
      joinedAt: new Date(),
    }),
    membershipRepo.create({
      tenantId: TENANT_B,
      userId: foreignUser.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    }),
  ]);

  const templateRepo = ds.getRepository(WorkspaceTourWizardTemplateEntity);
  await templateRepo.save(
    templateRepo.create({
      workspaceId: TENANT_A,
      baseProfile: "mountain_outdoor",
      stepOverrides: { skip: [], insert: [] },
      fieldRulesOverlay: {},
      presetId: null,
      wizardContractVersion: 1,
      formProfileVersion: 1,
    }),
  );
}

function createBodyWithLeaders(leaderUserIds: string[]) {
  return {
    title: "LeaderIntegrity E2E TenCharMinimum Tour",
    total_capacity: 10,
    lifecycle_status: "Draft",
    transportModes: [] as string[],
    tripDetails: {
      overview: { leaderUserIds },
    },
  };
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
  ownerToken = await webSessionOtpToken(app, {
    phone: OWNER_PHONE,
    tenantSubdomain: TENANT_A_SLUG,
  });
});

after(async () => {
  try {
    if (app) {
      await app.close();
    }
  } catch {
    /* ignore */
  } finally {
    app = undefined;
  }
  try {
    if (container) {
      await container.stop();
    }
  } catch {
    /* ignore */
  } finally {
    container = undefined;
  }
});

test("POST /api/v2/tours rejects cross-tenant leaderUserIds", async () => {
  if (e2eUnavailableReason || !app) return;

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_A_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(createBodyWithLeaders([foreignUserId]))
    .expect(400);

  assert.equal(res.body.error?.code, "INVALID_LEADER_USER_IDS_FOR_TENANT");
  const invalidIds = res.body.error?.details?.invalidIds as string[] | undefined;
  assert.ok(Array.isArray(invalidIds));
  assert.ok(invalidIds!.includes(foreignUserId));
});

test("POST /api/v2/tours rejects ineligible member leaderUserIds", async () => {
  if (e2eUnavailableReason || !app) return;

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_A_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(createBodyWithLeaders([ineligibleMemberId]))
    .expect(400);

  assert.equal(res.body.error?.code, "LEADER_USER_NOT_ELIGIBLE");
  const invalidIds = res.body.error?.details?.invalidIds as string[] | undefined;
  assert.ok(invalidIds?.includes(ineligibleMemberId));
});

test("POST /api/v2/tours accepts owner in leaderUserIds", async () => {
  if (e2eUnavailableReason || !app) return;

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_A_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(createBodyWithLeaders([ownerUserId]))
    .expect(201);

  assert.equal(typeof res.body.id, "string");
  const overview = res.body.details?.tripDetails?.overview as { leaderUserIds?: string[] } | undefined;
  assert.deepEqual(overview?.leaderUserIds, [ownerUserId]);
});

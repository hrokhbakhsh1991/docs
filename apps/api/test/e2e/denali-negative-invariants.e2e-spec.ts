import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import test, { after, before } from "node:test";

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import request from "supertest";
import { DataSource } from "typeorm";

import { INestApplication } from "@nestjs/common";

import { UserRole } from "../../src/common/auth/user-role.enum";
import { MembershipStatus } from "../../src/modules/identity/membership-status.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { WorkspaceTourWizardTemplateEntity } from "../../src/modules/settings-locations/entities/workspace-tour-wizard-template.entity";
import { assignTestApiPort } from "./assign-test-api-port";
import { createE2EApp } from "./bootstrap";
import { E2E_JWT_PRIVATE_KEY_PKCS8, E2E_JWT_PUBLIC_KEY_SPKI } from "./jwt-test-keys";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import { tenantTestHost } from "./tenant-test-host";
import { webSessionOtpToken } from "./web-session-otp.helper";

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
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET ?? "test-webhook-hmac-secret-at-least-32chars!!!!";
}

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const TENANT_SLUG = "denali-e2e-test";
const OWNER_PHONE = "09120000001";
const OWNER_EMAIL = "owner@denali.com";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let ownerToken: string | undefined;
let e2eUnavailableReason: string | undefined;

async function seed(ds: DataSource) {
  const tenantRepo = ds.getRepository(TenantEntity);
  await tenantRepo.save(
    tenantRepo.create({
      id: TENANT_ID,
      name: "Denali E2E Tenant",
      subdomain: TENANT_SLUG,
      enabledModules: ["tours"],
    }),
  );

  const userRepo = ds.getRepository(UserEntity);
  const owner = await userRepo.save(
    userRepo.create({
      email: OWNER_EMAIL,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: `fixture-${randomUUID()}`,
      fullName: "Tour Owner",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );

  const membershipRepo = ds.getRepository(UserTenantEntity);
  await membershipRepo.save(
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    }),
  );

  const templateRepo = ds.getRepository(WorkspaceTourWizardTemplateEntity);
  await templateRepo.save(
    templateRepo.create({
      workspaceId: TENANT_ID,
      baseProfile: "denali_pilot",
      stepOverrides: { skip: [], insert: [] },
      fieldRulesOverlay: {},
      presetId: null,
      wizardContractVersion: 1,
      formProfileVersion: 1,
    }),
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
  app = await createE2EApp();
  await seed(app!.get(DataSource));
  ownerToken = await webSessionOtpToken(app, {
    phone: OWNER_PHONE,
    tenantSubdomain: TENANT_SLUG
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

test("POST /api/v2/tours rejects denali_pilot without denaliTourKind", async () => {
  if (e2eUnavailableReason || !app) return;

  const body = {
    title: "NegativeTest Missing Kind",
    total_capacity: 10,
    lifecycle_status: "Draft",
    formProfile: "denali_pilot",
    tripDetails: {
      overview: { shortIntro: "Missing kind" }
    }
  };

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(body)
    .expect(400);

  assert.equal(res.body.error?.code, "WORKSPACE_RULE_DENALI_TOUR_KIND_REQUIRED");
});

test("POST /api/v2/tours rejects denali_pilot invalid denaliTourKind", async () => {
  if (e2eUnavailableReason || !app) return;

  const body = {
    title: "NegativeTest Invalid Kind",
    total_capacity: 10,
    lifecycle_status: "Draft",
    formProfile: "denali_pilot",
    tripDetails: {
      overview: { denaliTourKind: "invalid_kind" }
    }
  };

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(body)
    .expect(400);

  assert.equal(res.body.error?.code, "WORKSPACE_RULE_DENALI_TOUR_KIND_INVALID");
});

test("POST /api/v2/tours rejects denali_pilot mountain payload without participation", async () => {
  if (e2eUnavailableReason || !app) return;

  const body = {
    title: "NegativeTest Missing Participation",
    total_capacity: 10,
    lifecycle_status: "Draft",
    formProfile: "denali_pilot",
    tripDetails: {
      overview: { denaliTourKind: "mountain_day" },
      logistics: { groupSizeMax: 10 }
    }
  };

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(body)
    .expect(400);

  assert.equal(res.body.error?.code, "WORKSPACE_RULE_DENALI_PARTICIPATION_MINIMUM_AGE_REQUIRED");
});

test("POST /api/v2/tours rejects denali_pilot event payload with outdoor fields", async () => {
  if (e2eUnavailableReason || !app) return;

  const body = {
    title: "NegativeTest Event with Outdoor",
    total_capacity: 10,
    lifecycle_status: "Draft",
    formProfile: "denali_pilot",
    tripDetails: {
      overview: { denaliTourKind: "event_cinema", difficultyLevel: 5 },
      logistics: { groupSizeMax: 10 }
    }
  };

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(body)
    .expect(400);

  assert.equal(res.body.error?.code, "WORKSPACE_RULE_DENALI_EVENT_DIFFICULTY_FORBIDDEN");
});

test("POST /api/v2/tours rejects denali_pilot capacity 0", async () => {
  if (e2eUnavailableReason || !app) return;

  const body = {
    title: "NegativeTest Capacity Zero",
    total_capacity: 0,
    lifecycle_status: "Draft",
    formProfile: "denali_pilot",
    tripDetails: {
      overview: { denaliTourKind: "mountain_day" },
      logistics: { groupSizeMax: 10 },
      participation: {
        minimumAge: 18,
        fitnessLevel: "moderate",
        sportsInsuranceRequired: true
      }
    }
  };

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(body)
    .expect(400);

  assert.equal(res.body.error?.code, "WORKSPACE_RULE_DENALI_TOTAL_CAPACITY_INVALID");
});

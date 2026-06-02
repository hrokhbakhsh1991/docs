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
  StartedPostgreSqlContainer,
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
import { TourEntity } from "../../src/modules/tours/entities/tour.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { WorkspaceTourWizardTemplateEntity } from "../../src/modules/settings-locations/entities/workspace-tour-wizard-template.entity";

const TENANT_ID = "e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1";
const OWNER_EMAIL = "owner@profile-authority-e2e.test";
const OWNER_PHONE = "+15557100188";
const INTERNAL_API_KEY = "test-internal-key-profile-authority";
const TENANT_SLUG = "profile-authority-e2e";
const TEMPLATE_BASE_PROFILE = "mountain_outdoor";
const CLIENT_HINT_PROFILE = "urban_event";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let ownerToken = "";

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
  process.env.INTERNAL_API_KEY = INTERNAL_API_KEY;
  process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET =
    process.env.PAYMENTS_WEBHOOK_SIGNING_SECRET ?? "test-webhook-hmac-secret-at-least-32chars!!!!";
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);

  await tenantRepo.insert({
    id: TENANT_ID,
    name: "Profile authority E2E tenant",
    description: "profile-authority e2e",
    subdomain: TENANT_SLUG,
  });

  const owner = await userRepo.save(
    userRepo.create({
      email: OWNER_EMAIL,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Profile Authority Owner",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );

  await membershipRepo.save(
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    }),
  );

  await ds.getRepository(WorkspaceTourWizardTemplateEntity).save(
    ds.getRepository(WorkspaceTourWizardTemplateEntity).create({
      workspaceId: TENANT_ID,
      baseProfile: TEMPLATE_BASE_PROFILE,
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
  await seed(app.get(DataSource));
  ownerToken = await webSessionOtpToken(app, {
    phone: OWNER_PHONE,
    tenantSubdomain: TENANT_SLUG,
  });
});

after(async () => {
  try {
    if (app) {
      await app.close();
    }
  } catch {
    /* teardown races are non-fatal */
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

test("POST /api/v2/tours ignores client formProfile; snapshot follows workspace template", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }

  const body = {
    title: "ProfileAuthority E2E Mountain Tour",
    total_capacity: 10,
    lifecycle_status: "Draft",
    transportModes: [] as string[],
    formProfile: CLIENT_HINT_PROFILE,
  };

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(body)
    .expect(201);

  assert.equal(
    res.body.formProfileSnapshot,
    TEMPLATE_BASE_PROFILE,
    "formProfileSnapshot must come from workspace template, not client hint",
  );
  assert.notEqual(
    res.body.formProfileSnapshot,
    CLIENT_HINT_PROFILE,
    "client formProfile hint must not win over template base_profile",
  );

  const tourRow = await app.get(DataSource).getRepository(TourEntity).findOne({
    where: { id: res.body.id },
  });
  assert.ok(tourRow);
  assert.equal(tourRow.formProfileSnapshot, TEMPLATE_BASE_PROFILE);
});

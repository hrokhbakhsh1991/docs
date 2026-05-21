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
import { tenantTestHost } from "./tenant-test-host";
import { webSessionOtpToken } from "./web-session-otp.helper";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./jwt-test-keys";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { MembershipStatus } from "../../src/modules/identity/membership-status.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { TourEntity } from "../../src/modules/tours/entities/tour.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { WorkspaceDestinationEntity } from "../../src/modules/settings-locations/entities/workspace-destination.entity";
import { WorkspaceRegionEntity } from "../../src/modules/settings-locations/entities/workspace-region.entity";
import { WorkspaceTourWizardTemplateEntity } from "../../src/modules/settings-locations/entities/workspace-tour-wizard-template.entity";
import { TenantAuditEventEntity } from "../../src/common/audit/entities/tenant-audit-event.entity";

const TENANT_ID = "b3b3b3b3-b3b3-43b3-83b3-b3b3b3b3b3b3";
const OWNER_EMAIL = "owner@tours-create-e2e.test";
const OWNER_PHONE = "+15557100099";
const INTERNAL_API_KEY = "test-internal-key-tours-create";
const TENANT_SLUG = "tours-e2e";

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

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);

  await tenantRepo.insert({
    id: TENANT_ID,
    name: "Tours create E2E tenant",
    description: "tours-create e2e",
    subdomain: TENANT_SLUG
  });

  const owner = await userRepo.save(
    userRepo.create({
      email: OWNER_EMAIL,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Tour Owner",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  await membershipRepo.save(
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date()
    })
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
  await seed(app.get(DataSource));
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
    /* Redis / queue teardown may already be closed; tests already passed. */
  } finally {
    app = undefined;
  }
  try {
    if (container) {
      await container.stop();
    }
  } catch {
    /* Container stop races are non-fatal for CI signal. */
  } finally {
    container = undefined;
  }
});

test("POST /api/v2/tours creates tour with idempotency headers", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const idem = randomUUID();
  const body = {
    title: "E2ECreateFlow TenCharMinimumTourTitleHere",
    total_capacity: 12,
    lifecycle_status: "Draft",
    transportModes: [] as string[]
  };

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", idem)
    .send(body)
    .expect(201);

  assert.equal(typeof res.body.id, "string");
  assert.equal(res.body.title, body.title);

  const ds = app.get(DataSource);
  const ownerRow = await ds.getRepository(UserEntity).findOne({ where: { email: OWNER_EMAIL } });
  const tourRow = await ds.getRepository(TourEntity).findOne({ where: { id: res.body.id } });
  assert.ok(ownerRow);
  assert.ok(tourRow);
  assert.equal(tourRow.createdByUserId, ownerRow.id);

  const res2 = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", idem)
    .send(body)
    .expect(201);

  assert.equal(res2.body.id, res.body.id);
});

test("POST /api/v2/tours persists denali_pilot tripDetails snapshot", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  const regionRepo = ds.getRepository(WorkspaceRegionEntity);
  const destRepo = ds.getRepository(WorkspaceDestinationEntity);
  const region = await regionRepo.save(
    regionRepo.create({
      tenantId: TENANT_ID,
      name: "Denali E2E region",
      country: "IR",
      isActive: true,
    }),
  );
  const destination = await destRepo.save(
    destRepo.create({
      tenantId: TENANT_ID,
      regionId: region.id,
      name: "Denali E2E destination",
      isActive: true,
    }),
  );

  const body = {
    title: "DenaliPilot E2E Mountain Day Tour Title",
    total_capacity: 12,
    lifecycle_status: "Draft",
    tourType: "mountain",
    destinationId: destination.id,
    price: 100_000,
    requiresPayment: true,
    formProfile: "denali_pilot",
    transportModes: ["bus"],
    tripDetails: {
      overview: {
        denaliTourKind: "mountain_day",
        shortIntro: "Denali e2e probe tour",
      },
      logistics: {
        departureDate: "2026-09-01",
        departureMeetingTime: "08:00",
        primaryTransportMode: "bus",
        groupSizeMax: 12,
        privateCarMode: "no_private_car",
      },
      participation: {
        minimumAge: 18,
        fitnessLevel: "moderate",
        experienceLevel: "basic",
        sportsInsuranceRequired: true,
      },
      policies: {
        cancellationPolicy: "E2E cancellation policy text for Denali pilot.",
      },
    },
  };

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(body)
    .expect(201);

  assert.equal(res.body.formProfileSnapshot, "denali_pilot");
  const resOverview = res.body.details?.tripDetails?.overview as { denaliTourKind?: string } | undefined;
  assert.equal(resOverview?.denaliTourKind, "mountain_day");

  const tourRow = await ds.getRepository(TourEntity).findOne({
    where: { id: res.body.id },
    relations: ["details"],
  });
  assert.ok(tourRow);
  assert.equal(tourRow.formProfileSnapshot, "denali_pilot");
  const td = tourRow.details?.tripDetails as
    | {
        overview?: { denaliTourKind?: string };
        logistics?: { privateCarMode?: string };
      }
    | null
    | undefined;
  assert.equal(td?.overview?.denaliTourKind, "mountain_day");
  assert.equal(td?.logistics?.privateCarMode, "no_private_car");
});

async function latestAuditForTour(
  ds: DataSource,
  action: string,
  tourId: string,
): Promise<TenantAuditEventEntity | null> {
  return ds.getRepository(TenantAuditEventEntity).findOne({
    where: { tenantId: TENANT_ID, action, resourceId: tourId },
    order: { occurredAt: "DESC" },
  });
}

test("POST /api/v2/tours persists tenant_audit_events for blank create", async () => {
  if (e2eUnavailableReason || !app) return;

  const body = {
    title: "AuditBlankFlow TenCharMinimum Tour Title",
    total_capacity: 8,
    lifecycle_status: "Draft",
    transportModes: [] as string[],
  };

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(body)
    .expect(201);

  const ds = app.get(DataSource);
  const row = await latestAuditForTour(ds, "tour.create_blank", res.body.id);
  assert.ok(row);
  assert.equal(row!.tenantId, TENANT_ID);
  assert.equal(row!.resourceType, "tour");
  assert.ok(row!.actorUserId);
  const after = (row!.metadata as { after?: Record<string, unknown> } | null)?.after;
  assert.equal(after?.title, body.title);
});

test("POST /api/v2/tours persists tenant_audit_events for preset create", async () => {
  if (e2eUnavailableReason || !app) return;

  const presetId = randomUUID();
  const body = {
    title: "AuditPresetFlow TenCharMinimum Tour Title",
    total_capacity: 8,
    lifecycle_status: "Draft",
    transportModes: [] as string[],
    sourcePresetId: presetId,
  };

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(body)
    .expect(201);

  const row = await latestAuditForTour(app.get(DataSource), "tour.create_from_preset", res.body.id);
  assert.ok(row);
  const after = (row!.metadata as { after?: Record<string, unknown> } | null)?.after;
  assert.equal(after?.preset_id, presetId);
});

test("POST /api/v2/tours persists tenant_audit_events for clone create", async () => {
  if (e2eUnavailableReason || !app) return;

  const sourceBody = {
    title: "AuditCloneSource TenCharMinimum Tour Title",
    total_capacity: 8,
    lifecycle_status: "Draft",
    transportModes: [] as string[],
  };

  const source = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(sourceBody)
    .expect(201);

  const cloneBody = {
    title: "AuditCloneChild TenCharMinimum Tour Title",
    total_capacity: 8,
    lifecycle_status: "Draft",
    transportModes: [] as string[],
    sourceTourId: source.body.id,
  };

  const res = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(cloneBody)
    .expect(201);

  const row = await latestAuditForTour(app.get(DataSource), "tour.clone", res.body.id);
  assert.ok(row);
  const after = (row!.metadata as { after?: Record<string, unknown> } | null)?.after;
  assert.equal(after?.source_tour_id, source.body.id);
});

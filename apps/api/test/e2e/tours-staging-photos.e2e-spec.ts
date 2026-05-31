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
import { MinioStorageAdapter } from "../../src/infra/storage/minio-storage.adapter";
import { InMemoryFileStorageAdapter } from "../helpers/in-memory-file-storage.adapter";
import { tourPhotoStorageKey } from "../../src/modules/tours/utils/tour-photo-storage.util";

const TENANT_ID = "c4c4c4c4-c4c4-44c4-84c4-c4c4c4c4c4c4";
const OWNER_EMAIL = "owner@tours-staging-photos-e2e.test";
const OWNER_PHONE = "+15557100188";
const INTERNAL_API_KEY = "test-internal-key-tours-staging-photos";
const TENANT_SLUG = "tours-staging-e2e";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let ownerToken = "";
let storage: InMemoryFileStorageAdapter | undefined;

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
    name: "Tours staging photos E2E tenant",
    description: "tours-staging-photos e2e",
    subdomain: TENANT_SLUG,
  });

  const owner = await userRepo.save(
    userRepo.create({
      email: OWNER_EMAIL,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Tour Owner",
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
  app = await createE2EApp((builder) =>
    builder.overrideProvider(MinioStorageAdapter).useClass(InMemoryFileStorageAdapter),
  );
  storage = app.get(MinioStorageAdapter) as InMemoryFileStorageAdapter;
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
    /* teardown flake */
  } finally {
    app = undefined;
    storage = undefined;
  }
  try {
    if (container) {
      await container.stop();
    }
  } catch {
    /* non-fatal */
  } finally {
    container = undefined;
  }
});

test("POST /api/v2/tours finalizes stagingTourId instead of inserting a parallel row", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }

  const ds = app.get(DataSource);
  const tourRepo = ds.getRepository(TourEntity);

  const shellBody = {
    title: "StagingShell TenCharMinimum Tour Title",
    total_capacity: 4,
    lifecycle_status: "Draft",
    transportModes: [] as string[],
    metadata: { vertical: "staging_shell", isStagingShell: true },
  };

  const shell = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(shellBody)
    .expect(201);

  const countAfterShell = await tourRepo.count({ where: { tenantId: TENANT_ID } });

  const finalizeBody = {
    title: "FinalizedTour TenCharMinimum Tour Title",
    total_capacity: 12,
    lifecycle_status: "Draft",
    transportModes: ["bus"],
    stagingTourId: shell.body.id,
    description: "Finalized from gallery staging shell",
    tripDetails: {
      overview: { denaliTourKind: "mountain_day", shortIntro: "Staging finalize e2e" },
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
        cancellationPolicy: "E2E cancellation policy for staging finalize.",
      },
    },
  };

  const finalized = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(finalizeBody)
    .expect(201);

  assert.equal(finalized.body.id, shell.body.id);
  assert.equal(finalized.body.title, finalizeBody.title);
  assert.equal(finalized.body.description, finalizeBody.description);

  const countAfterFinalize = await tourRepo.count({ where: { tenantId: TENANT_ID } });
  assert.equal(countAfterFinalize, countAfterShell);

  const row = await tourRepo.findOne({ where: { id: shell.body.id } });
  assert.ok(row);
  assert.equal(row!.title, finalizeBody.title);
  assert.equal((row!.metadata as { isStagingShell?: boolean } | null)?.isStagingShell, undefined);
});

test("DELETE /api/v2/tours/:tourId/photos/:photoId evicts object storage and tripDetails ref", async () => {
  if (e2eUnavailableReason || !app || !storage) {
    return;
  }

  const ds = app.get(DataSource);
  const photoId = randomUUID();
  const filename = "cover.webp";

  const createBody = {
    title: "PhotoDeleteFlow TenCharMinimum Title",
    total_capacity: 6,
    lifecycle_status: "Draft",
    transportModes: ["bus"],
    tripDetails: {
      overview: { denaliTourKind: "mountain_day", shortIntro: "Photo delete e2e" },
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
        cancellationPolicy: "E2E cancellation policy for photo delete.",
      },
      photos: [
        {
          id: photoId,
          filename,
          size: 1024,
          mimeType: "image/webp",
          uploadedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
  };

  const created = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send(createBody)
    .expect(201);

  const objectKey = tourPhotoStorageKey(TENANT_ID, created.body.id, photoId, filename);
  await storage.upload({
    workspaceId: TENANT_ID,
    relativePath: `tours/${created.body.id}/photos/${photoId}-${filename}`,
    body: Buffer.from("fake-image"),
    contentType: "image/webp",
  });
  await storage.getSignedUrl(objectKey, 60);

  const afterCreate = await ds.getRepository(TourEntity).findOne({
    where: { id: created.body.id },
    relations: ["details"],
  });
  const storedPhoto = (
    afterCreate?.details?.tripDetails as { photos?: Array<Record<string, unknown>> } | undefined
  )?.photos?.[0];
  assert.ok(storedPhoto);
  assert.equal(storedPhoto!.id, photoId);
  assert.equal("url" in storedPhoto!, false);

  const urlRes = await request(app.getHttpServer())
    .get(
      `/api/v2/workspaces/${TENANT_ID}/tours/${created.body.id}/photos/${photoId}/url`,
    )
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .expect(200);

  assert.equal(typeof urlRes.body.url, "string");
  assert.equal(urlRes.body.expiresInSeconds, 900);

  await request(app.getHttpServer())
    .delete(`/api/v2/tours/${created.body.id}/photos/${photoId}`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .expect(200);

  await assert.rejects(() => storage!.getSignedUrl(objectKey, 60));

  const reloaded = await ds.getRepository(TourEntity).findOne({
    where: { id: created.body.id },
    relations: ["details"],
  });
  const photos = (reloaded?.details?.tripDetails as { photos?: Array<{ id: string }> } | undefined)
    ?.photos;
  assert.notEqual(photos?.some((p) => p.id === photoId), true);
});

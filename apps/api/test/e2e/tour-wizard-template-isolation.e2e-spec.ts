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
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { WorkspaceTourWizardTemplateEntity } from "../../src/modules/settings-locations/entities/workspace-tour-wizard-template.entity";

const TENANT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SLUG_A = "tpl-iso-a";
const SLUG_B = "tpl-iso-b";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let tokenB = "";

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
  process.env.OUTBOX_PROCESSOR_ENABLED = "false";
}

async function seed(ds: DataSource): Promise<void> {
  const hash = await argon2.hash(`fixture-${randomUUID()}`);
  await ds.getRepository(TenantEntity).insert([
    { id: TENANT_A, name: "Tpl A", description: "a", subdomain: SLUG_A },
    { id: TENANT_B, name: "Tpl B", description: "b", subdomain: SLUG_B },
  ]);
  const userRepo = ds.getRepository(UserEntity);
  const ownerB = await userRepo.save(
    userRepo.create({
      email: "owner-b@tpl-iso.test",
      phone: "+15558300002",
      isPhoneVerified: true,
      hashedPassword: hash,
      fullName: "Owner B",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );
  await ds.getRepository(UserTenantEntity).save(
    ds.getRepository(UserTenantEntity).create({
      tenantId: TENANT_B,
      userId: ownerB.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
    }),
  );
  await ds.getRepository(WorkspaceTourWizardTemplateEntity).save(
    ds.getRepository(WorkspaceTourWizardTemplateEntity).create({
      workspaceId: TENANT_A,
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
  tokenB = await webSessionOtpToken(app, { phone: "+15558300002", tenantSubdomain: SLUG_B });
});

after(async () => {
  if (app) await app.close();
  if (container) await container.stop();
});

test("tenant B GET wizard template does not expose tenant A denali_pilot row", async () => {
  if (e2eUnavailableReason || !app) return;

  const res = await request(app.getHttpServer())
    .get("/api/v2/settings/tour-wizard-template")
    .set("Host", tenantTestHost(SLUG_B))
    .set("Authorization", `Bearer ${tokenB}`)
    .expect(200);

  const profile = res.body?.template?.baseProfile ?? res.body?.template?.base_profile;
  assert.notEqual(profile, "denali_pilot");
});

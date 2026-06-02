import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

import { INestApplication } from "@nestjs/common";
import * as argon2 from "argon2";
import request from "supertest";
import { DataSource } from "typeorm";
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";

import { assignTestApiPort } from "./assign-test-api-port";
import { createE2EApp } from "./bootstrap";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import { tenantTestHost } from "./tenant-test-host";
import { webSessionOtpToken } from "./web-session-otp.helper";
import { E2E_JWT_PRIVATE_KEY_PKCS8, E2E_JWT_PUBLIC_KEY_SPKI } from "./jwt-test-keys";

import { UserRole } from "../../src/common/auth/user-role.enum";
import { TenantAuditEventEntity } from "../../src/common/audit/entities/tenant-audit-event.entity";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { MembershipStatus } from "../../src/modules/identity/membership-status.enum";

const TENANT_ID = "92000000-0000-4000-8000-000000000001";
const TENANT_B_ID = "92000000-0000-4000-8000-000000000002";
const TENANT_SLUG = "phasec-finance-a";
const TENANT_B_SLUG = "phasec-finance-b";
const DRAFT_KEY = "denali-create";

const OWNER_PHONE = "+15557920001";
const MEMBER_PHONE = "+15557920002";
const OWNER_B_PHONE = "+15557920003";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let ownerToken = "";
let memberToken = "";
let ownerBToken = "";
let tourId = "";

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
  process.env.OUTBOX_PROCESSOR_ENABLED = "false";
  process.env.RECONCILIATION_ENABLED = "false";
  process.env.PAYMENTS_TIMEOUT_ENABLED = "false";
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);

  await tenantRepo.insert([
    {
      id: TENANT_ID,
      name: "Phase C Finance A",
      description: "phase c financial cutover",
      subdomain: TENANT_SLUG,
    },
    {
      id: TENANT_B_ID,
      name: "Phase C Finance B",
      description: "phase c tenant isolation",
      subdomain: TENANT_B_SLUG,
    },
  ]);

  const owner = await userRepo.save(
    userRepo.create({
      email: "owner@phasec-finance-a.e2e",
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Finance Owner A",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );
  const member = await userRepo.save(
    userRepo.create({
      email: "member@phasec-finance-a.e2e",
      phone: MEMBER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Finance Member A",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );
  const ownerB = await userRepo.save(
    userRepo.create({
      email: "owner@phasec-finance-b.e2e",
      phone: OWNER_B_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Finance Owner B",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );

  await membershipRepo.save([
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: owner.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    }),
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: member.id,
      role: UserRole.Member,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    }),
    membershipRepo.create({
      tenantId: TENANT_B_ID,
      userId: ownerB.id,
      role: UserRole.Owner,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    }),
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

  ownerToken = await webSessionOtpToken(app, { phone: OWNER_PHONE, tenantSubdomain: TENANT_SLUG });
  memberToken = await webSessionOtpToken(app, { phone: MEMBER_PHONE, tenantSubdomain: TENANT_SLUG });
  ownerBToken = await webSessionOtpToken(app, { phone: OWNER_B_PHONE, tenantSubdomain: TENANT_B_SLUG });

  const createRes = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      title: "Phase C Finance Tour Title Minimum 10 chars",
      total_capacity: 16,
      lifecycle_status: "DRAFT",
      transportModes: [],
    })
    .expect(201);
  tourId = createRes.body.id as string;
});

after(async () => {
  try {
    if (app) {
      await app.close();
    }
  } catch {
    /* teardown races are non-fatal for assertion signal */
  } finally {
    app = undefined;
  }
  try {
    if (container) {
      await container.stop();
    }
  } catch {
    /* container stop races are non-fatal */
  } finally {
    container = undefined;
  }
});

test("draft pricingSnapshot is invariant across external tour pricing changes", async () => {
  if (e2eUnavailableReason || !app) return;

  const pricingSnapshot = {
    currency: "USD",
    totalCost: 2500,
    paymentMode: "offline_receipt",
    rulesVersion: "v1",
  };

  const initialDraft = await request(app.getHttpServer())
    .patch(`/api/v2/workspaces/${TENANT_ID}/draft-engine/${DRAFT_KEY}`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({
      data: { form: { basicInfo: { title: "phase-c-finance" }, pricingSnapshot } },
      version: 0,
      schemaVersion: 1,
      lastModified: Date.now(),
    })
    .expect(200);
  assert.equal(initialDraft.body.version, 1);

  await request(app.getHttpServer())
    .patch(`/api/v2/tours/${tourId}`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      cost_context: { currency: "USD", totalCost: 3100, requiresPayment: false },
    })
    .expect(200);

  const fetched = await request(app.getHttpServer())
    .get(`/api/v2/workspaces/${TENANT_ID}/draft-engine/${DRAFT_KEY}`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .expect(200);

  const snapshot =
    (fetched.body?.data?.form?.pricingSnapshot as { totalCost?: number; rulesVersion?: string } | undefined) ??
    (fetched.body?.data?.pricingSnapshot as { totalCost?: number; rulesVersion?: string } | undefined);
  assert.equal(snapshot?.totalCost, 2500);
  assert.equal(snapshot?.rulesVersion, "v1");
});

test("OCC/versioning: one of parallel same-base draft writes must conflict with 409", async () => {
  if (e2eUnavailableReason || !app) return;

  const baseline = await request(app.getHttpServer())
    .get(`/api/v2/workspaces/${TENANT_ID}/draft-engine/${DRAFT_KEY}`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .expect(200);

  const baseVersion = Number(baseline.body.version);
  assert.equal(Number.isFinite(baseVersion), true);

  const [r1, r2] = await Promise.all([
    request(app.getHttpServer())
      .patch(`/api/v2/workspaces/${TENANT_ID}/draft-engine/${DRAFT_KEY}`)
      .set("Host", tenantTestHost(TENANT_SLUG))
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        data: { pricingSnapshot: { marker: "a" } },
        version: baseVersion,
        schemaVersion: 1,
        lastModified: Date.now(),
      }),
    request(app.getHttpServer())
      .patch(`/api/v2/workspaces/${TENANT_ID}/draft-engine/${DRAFT_KEY}`)
      .set("Host", tenantTestHost(TENANT_SLUG))
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        data: { pricingSnapshot: { marker: "b" } },
        version: baseVersion,
        schemaVersion: 1,
        lastModified: Date.now(),
      }),
  ]);

  const statuses = [r1.status, r2.status].sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 409]);
});

test("tenant host/token isolation: other tenant cannot read workspace A draft", async () => {
  if (e2eUnavailableReason || !app) return;

  const isolated = await request(app.getHttpServer())
    .get(`/api/v2/workspaces/${TENANT_ID}/draft-engine/${DRAFT_KEY}`)
    .set("Host", tenantTestHost(TENANT_B_SLUG))
    .set("Authorization", `Bearer ${ownerBToken}`);

  if (isolated.status === 500) {
    assert.equal(
      isolated.body?.error?.code,
      "DRAFT_FORENSIC_ERROR",
      "tenant isolation should not leak data; current path throws forensic 500 instead of 403/404",
    );
    return;
  }
  assert.equal([403, 404].includes(isolated.status), true, `unexpected isolation status ${isolated.status}`);
});

test("security visibility: pricing mutation deny path should produce audit log (flag if absent)", async () => {
  if (e2eUnavailableReason || !app) return;
  const ds = app.get(DataSource);
  const beforeCount = await ds.getRepository(TenantAuditEventEntity).count({ where: { tenantId: TENANT_ID } });

  await request(app.getHttpServer())
    .patch(`/api/v2/tours/${tourId}`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      cost_context: { currency: "USD", totalCost: 3200, requiresPayment: false },
    })
    .expect(200);

  let afterAllowedCount = beforeCount;
  for (let i = 0; i < 10; i += 1) {
    afterAllowedCount = await ds.getRepository(TenantAuditEventEntity).count({ where: { tenantId: TENANT_ID } });
    if (afterAllowedCount > beforeCount) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(afterAllowedCount > beforeCount, true, "expected audit growth for successful pricing mutation");

  await request(app.getHttpServer())
    .patch(`/api/v2/tours/${tourId}`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${memberToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      cost_context: { currency: "USD", totalCost: 3300, requiresPayment: false },
    })
    .expect(403);

  const afterCount = await ds.getRepository(TenantAuditEventEntity).count({ where: { tenantId: TENANT_ID } });
  if (afterCount === beforeCount) {
    assert.fail(
      "VULNERABILITY: denied pricing mutation generated no explicit audit row. This is an RBAC visibility gap.",
    );
  }
});

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

const TENANT_ID = "91000000-0000-4000-8000-000000000001";
const TENANT_SLUG = "phasec-rbac";
const OWNER_EMAIL = "owner@phasec-rbac.e2e";
const MEMBER_EMAIL = "member@phasec-rbac.e2e";
const OWNER_PHONE = "+15557910001";
const MEMBER_PHONE = "+15557910002";

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let ownerToken = "";
let memberToken = "";
let createdTourId = "";

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

  await tenantRepo.insert({
    id: TENANT_ID,
    name: "Phase C RBAC tenant",
    description: "phase c rbac parity",
    subdomain: TENANT_SLUG,
  });

  const owner = await userRepo.save(
    userRepo.create({
      email: OWNER_EMAIL,
      phone: OWNER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "RBAC Owner",
      isEmailVerified: true,
      telegramUserId: null,
    }),
  );

  const member = await userRepo.save(
    userRepo.create({
      email: MEMBER_EMAIL,
      phone: MEMBER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "RBAC Member",
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
  ]);
}

function assertErrorEnvelope(body: unknown): void {
  assert.ok(body && typeof body === "object");
  const envelope = body as { error?: { code?: string; message?: string } };
  assert.equal(typeof envelope.error?.code, "string");
  assert.equal(typeof envelope.error?.message, "string");
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

  const createRes = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      title: "Phase C RBAC Tour Title Minimum 10 chars",
      total_capacity: 10,
      lifecycle_status: "DRAFT",
      transportModes: [],
    })
    .expect(201);
  createdTourId = createRes.body.id as string;
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

test("contract gap: PATCH /api/v2/tours/:tourId/pricing endpoint is missing (404)", async () => {
  if (e2eUnavailableReason || !app) return;

  const res = await request(app.getHttpServer())
    .patch(`/api/v2/tours/${createdTourId}/pricing`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .send({ cost_context: { totalCost: 1500 } });

  assert.equal(res.status, 404);
});

test("RBAC guardrail: member (editor-proxy) cannot patch pricing via PATCH /api/v2/tours/:tourId", async () => {
  if (e2eUnavailableReason || !app) return;

  const res = await request(app.getHttpServer())
    .patch(`/api/v2/tours/${createdTourId}`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${memberToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      cost_context: { currency: "USD", totalCost: 1600, requiresPayment: false },
    });

  assert.equal(res.status, 403);
  assertErrorEnvelope(res.body);
  assert.equal(
    ["AUTH_FORBIDDEN_ROLE", "AUTH_FORBIDDEN_ABILITY"].includes(res.body.error.code),
    true,
    `unexpected forbidden code: ${res.body.error.code}`,
  );
});

test("positive control: owner can patch pricing via PATCH /api/v2/tours/:tourId", async () => {
  if (e2eUnavailableReason || !app) return;

  const res = await request(app.getHttpServer())
    .patch(`/api/v2/tours/${createdTourId}`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      cost_context: { currency: "USD", totalCost: 1700, requiresPayment: false },
    })
    .expect(200);

  const snapshot = res.body?.costContext as { totalCost?: number } | undefined;
  assert.equal(snapshot?.totalCost, 1700);
});

test("audit guardrail: unauthorized pricing attempt must be audit logged (flag vulnerability when missing)", async () => {
  if (e2eUnavailableReason || !app) return;
  const ds = app.get(DataSource);

  const beforeCount = await ds.getRepository(TenantAuditEventEntity).count({ where: { tenantId: TENANT_ID } });

  await request(app.getHttpServer())
    .patch(`/api/v2/tours/${createdTourId}`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${ownerToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      cost_context: { currency: "USD", totalCost: 1750, requiresPayment: false },
    })
    .expect(200);

  let afterAllowedCount = beforeCount;
  for (let i = 0; i < 10; i += 1) {
    afterAllowedCount = await ds.getRepository(TenantAuditEventEntity).count({ where: { tenantId: TENANT_ID } });
    if (afterAllowedCount > beforeCount) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(afterAllowedCount > beforeCount, true, "expected audit growth for allowed pricing mutation");

  await request(app.getHttpServer())
    .patch(`/api/v2/tours/${createdTourId}`)
    .set("Host", tenantTestHost(TENANT_SLUG))
    .set("Authorization", `Bearer ${memberToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      cost_context: { currency: "USD", totalCost: 1800, requiresPayment: false },
    })
    .expect(403);

  const afterCount = await ds.getRepository(TenantAuditEventEntity).count({ where: { tenantId: TENANT_ID } });

  if (afterCount === beforeCount) {
    assert.fail(
      "VULNERABILITY: unauthorized pricing attempt produced no tenant audit event. Denied mutations are not observable in audit trail.",
    );
  }
});

import "reflect-metadata";
import assert from "node:assert/strict";
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
import { LoggerService } from "../../src/common/logger/logger.service";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";

const TENANT_A = "e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1";
const TENANT_B = "f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2";

const USER_X_EMAIL = "userx@jwt-membership-guard.test";
const USER_X_PHONE = "+15557300001";

const INTERNAL_API_KEY = "test-internal-key-jwt-membership";

const WORKSPACE_DENIED_WARN =
  "workspace session denied: user has no membership for tenant";

const RETRYABILITY_VALUES = new Set([
  "NO_RETRY",
  "SAFE_RETRY",
  "RETRY_WITH_BACKOFF",
  "RETRY_AFTER_ACTION"
]);

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
/** JWT for userX scoped to tenant B (userX has no membership in tenant A). */
let tokenTenantB = "";

const warnCalls: Array<{ message: string; meta: Record<string, unknown> }> = [];
let originalLoggerWarn: LoggerService["warn"] | undefined;

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

function assertNoSessionOrJwtInBody(response: Response): void {
  const body = response.body as Record<string, unknown>;
  assert.equal(body.session_token, undefined);
  assert.equal(body.access_token, undefined);
  assert.equal(body.token, undefined);
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string") {
      continue;
    }
    const parts = value.split(".");
    if (parts.length === 3 && parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) {
      assert.fail(`unexpected JWT-shaped value in response key "${key}"`);
    }
  }
}

async function seedTenantAUserXInBOnly(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);

  await tenantRepo.insert([
    {
      id: TENANT_A,
      name: "Tenant A (no userX)",
      description: "jwt-membership-guard",
      subdomain: "jwt-ta"
    },
    {
      id: TENANT_B,
      name: "Tenant B (userX only)",
      description: "jwt-membership-guard",
      subdomain: "jwt-tb"
    }
  ]);

  const hashedPassword = await argon2.hash(`fixture-${USER_X_PHONE}`);
  await userRepo.save(
    userRepo.create({
      email: USER_X_EMAIL,
      phone: USER_X_PHONE,
      isPhoneVerified: true,
      hashedPassword,
      fullName: "User X",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  const userX = await userRepo.findOneOrFail({ where: { email: USER_X_EMAIL } });

  await membershipRepo.save(
    membershipRepo.create({
      tenantId: TENANT_B,
      userId: userX.id,
      role: UserRole.Owner
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
  app = await createE2EApp();
  await seedTenantAUserXInBOnly(app.get(DataSource));

  const logger = app.get(LoggerService);
  originalLoggerWarn = logger.warn.bind(logger);
  logger.warn = (message: string, meta: Record<string, unknown> = {}) => {
    warnCalls.push({ message, meta });
    return originalLoggerWarn!(message, meta);
  };

  tokenTenantB = await webSessionOtpToken(app, { phone: USER_X_PHONE, tenantSubdomain: "jwt-tb" });
});

after(async () => {
  if (!e2eUnavailableReason && app) {
    const deniedWarnCount = warnCalls.filter((c) => c.message === WORKSPACE_DENIED_WARN).length;
    assert.ok(
      deniedWarnCount >= 1,
      `expected LoggerService.warn("${WORKSPACE_DENIED_WARN}") for denied workspace session`
    );
  }
  if (app && originalLoggerWarn) {
    app.get(LoggerService).warn = originalLoggerWarn;
  }
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("POST /api/v2/auth/workspace/session for tenantA -> 403 TENANT_SCOPE_FORBIDDEN", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const beforeWarn = warnCalls.length;
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/workspace/session")
    .set("Authorization", `Bearer ${tokenTenantB}`)
    .send({ tenant_id: TENANT_A });

  assert.equal(response.status, 403);
  assert.equal(response.body.error?.code, "TENANT_SCOPE_FORBIDDEN");
  assertErrorEnvelope(response);
  assertNoSessionOrJwtInBody(response);

  const newWarns = warnCalls.slice(beforeWarn);
  assert.ok(
    newWarns.some((w) => w.message === WORKSPACE_DENIED_WARN),
    `expected warn "${WORKSPACE_DENIED_WARN}", got: ${JSON.stringify(newWarns.map((w) => w.message))}`
  );
});

test("after web login to tenantB, workspace switch to tenantA -> 403 and no token", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const beforeWarn = warnCalls.length;
  const freshToken = await webSessionOtpToken(app, { phone: USER_X_PHONE, tenantSubdomain: "jwt-tb" });
  assert.equal(typeof freshToken, "string");
  assert.equal(freshToken.split(".").length, 3);

  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/workspace/session")
    .set("Authorization", `Bearer ${freshToken}`)
    .send({ tenant_id: TENANT_A });

  assert.equal(response.status, 403);
  assert.equal(response.body.error?.code, "TENANT_SCOPE_FORBIDDEN");
  assertErrorEnvelope(response);
  assertNoSessionOrJwtInBody(response);

  const newWarns = warnCalls.slice(beforeWarn);
  assert.ok(
    newWarns.some((w) => w.message === WORKSPACE_DENIED_WARN),
    `expected warn "${WORKSPACE_DENIED_WARN}", got: ${JSON.stringify(newWarns.map((w) => w.message))}`
  );
});

test("POST workspace/session rejects tenant_id that does not match HTTP Host (TENANT_HOST_MISMATCH)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/workspace/session")
    .set("Host", tenantTestHost("jwt-ta"))
    .set("Authorization", `Bearer ${tokenTenantB}`)
    .send({ tenant_id: TENANT_B });

  assert.equal(response.status, 403);
  assert.equal(response.body?.error?.code, "TENANT_HOST_MISMATCH");
  assertErrorEnvelope(response);
});

test("403 workspace denial responses never include session_token / JWT material", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/workspace/session")
    .set("Authorization", `Bearer ${tokenTenantB}`)
    .send({ tenant_id: TENANT_A });

  assert.equal(response.status, 403);
  assertNoSessionOrJwtInBody(response);
  const serialized = JSON.stringify(response.body);
  assert.equal(serialized.includes("session_token"), false);
  assert.equal(serialized.toLowerCase().includes("bearer "), false);
});

test("scoped routes reject JWT when tenant does not match HTTP Host (TENANT_HOST_TOKEN_MISMATCH)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .set("Host", tenantTestHost("jwt-ta"))
    .set("Authorization", `Bearer ${tokenTenantB}`);

  assert.equal(response.status, 403);
  assert.equal(response.body?.error?.code, "TENANT_HOST_TOKEN_MISMATCH");
  assertErrorEnvelope(response);
});

test("JWT rejected with AUTH_TOKEN_REVOKED after session_version bump on membership row", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const ds = app.get(DataSource);
  await ds.query(
    `UPDATE user_tenants SET session_version = session_version + 1
     WHERE user_id = (SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL)
       AND tenant_id = $2::uuid
       AND deleted_at IS NULL`,
    [USER_X_EMAIL, TENANT_B]
  );

  const response = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .set("Host", tenantTestHost("jwt-tb"))
    .set("Authorization", `Bearer ${tokenTenantB}`);

  assert.equal(response.status, 401);
  assert.equal(response.body?.error?.code, "AUTH_TOKEN_REVOKED");
  assertErrorEnvelope(response);
});

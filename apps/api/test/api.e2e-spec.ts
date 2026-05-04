import "reflect-metadata";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { INestApplication } from "@nestjs/common";
import * as argon2 from "argon2";
import request, { type Response } from "supertest";
import { DataSource } from "typeorm";
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer
} from "@testcontainers/postgresql";
import { createE2EApp } from "./e2e/bootstrap";
import { resetTestDatabaseWithMigrations } from "./e2e/reset-test-database";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./e2e/jwt-test-keys";
import { Role } from "../src/modules/auth/roles.enum";
import { TenantEntity } from "../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../src/modules/identity/entities/user-tenant.entity";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const INTERNAL_API_KEY = "test-internal-key";
const LEADER_EMAIL = "leader@example.com";
const LEADER_PASSWORD = "Passw0rd!";

const RETRYABILITY_VALUES = new Set([
  "NO_RETRY",
  "SAFE_RETRY",
  "RETRY_WITH_BACKOFF",
  "RETRY_AFTER_ACTION"
]);

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;
let sessionToken = "";
let createdTourId = "";

function applyEnvForContainer(db: StartedPostgreSqlContainer): void {
  process.env.NODE_ENV = "test";
  process.env.PORT = "3000";
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
}

async function seedLeaderUser(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);

  await tenantRepo.insert({
    id: TENANT_ID,
    name: "API E2E Tenant",
    description: "Seeded for test/api.e2e-spec.ts"
  });

  const hashedPassword = await argon2.hash(LEADER_PASSWORD);
  const user = await userRepo.save(
    userRepo.create({
      email: LEADER_EMAIL,
      hashedPassword,
      fullName: "E2E Leader",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  await membershipRepo.save(
    membershipRepo.create({
      tenantId: TENANT_ID,
      userId: user.id,
      role: Role.OWNER
    })
  );
}

function buildTelegramInitPayload(botToken: string, telegramUserId: number): string {
  const user = JSON.stringify({ id: telegramUserId, username: "linked_user" });
  const params = new URLSearchParams();
  params.set("auth_date", "1714521600");
  params.set("query_id", "AAEAAQ");
  params.set("user", user);

  const dataEntries: string[] = [];
  for (const [key, value] of params.entries()) {
    dataEntries.push(`${key}=${value}`);
  }
  dataEntries.sort();
  const dataCheckString = dataEntries.join("\n");
  const secretKey = createHash("sha256").update(botToken, "utf8").digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString, "utf8").digest("hex");
  params.set("hash", hash);
  return params.toString();
}

function assertErrorEnvelope(response: Response): void {
  assert.equal(typeof response.body, "object");
  assert.equal(typeof response.body.requestId, "string");
  assert.equal(typeof response.body.error, "object");
  assert.equal(typeof response.body.error.code, "string");
  assert.equal(typeof response.body.error.message, "string");
  assert.equal(typeof response.body.error.details, "object");
  assert.equal(typeof response.body.error.retryability, "string");
  assert.equal(RETRYABILITY_VALUES.has(response.body.error.retryability), true);
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
  await seedLeaderUser(app.get(DataSource));
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("GET /health -> 200 with requestId", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer()).get("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(typeof response.body.requestId, "string");
});

test("GET /health/live -> 200", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer()).get("/health/live");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "live");
});

test("GET /health/ready -> 200|503 (contract on failure)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer()).get("/health/ready");
  assert.equal([200, 503].includes(response.status), true);
  if (response.status === 503) {
    assertErrorEnvelope(response);
  } else {
    assert.equal(response.body.status, "ready");
  }
});

test("GET /health/readiness -> 200|503 (contract on failure)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer()).get("/health/readiness");
  assert.equal([200, 503].includes(response.status), true);
  if (response.status === 503) {
    assertErrorEnvelope(response);
  } else {
    assert.equal(response.body.status, "ready");
  }
});

test("POST /api/v2/auth/web/session -> 200 with JWT", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session")
    .send({
      entry_mode: "web",
      credential: {
        email: LEADER_EMAIL,
        password: LEADER_PASSWORD
      },
      asserted_tenant_id: TENANT_ID
    });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.session_token, "string");
  assert.equal(response.body.session_token.split(".").length, 3);
  assert.equal(response.body.entry_mode, "web");
  sessionToken = response.body.session_token;
});

test("POST /api/v2/auth/web/session invalid body -> 400 envelope", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session")
    .send({});
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "VALIDATION_FAILED");
  assertErrorEnvelope(response);
});

test("POST /api/v2/auth/telegram/session invalid body -> 400 envelope", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/telegram/session")
    .send({});
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "VALIDATION_FAILED");
  assertErrorEnvelope(response);
});

test("POST /api/v2/auth/link-telegram without auth -> 401 envelope", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/link-telegram")
    .send({ telegram_init_payload: "invalid" });
  assert.equal(response.status, 401);
  assertErrorEnvelope(response);
});

test("GET /api/v2/tours without auth -> 401 envelope", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer()).get("/api/v2/tours");
  assert.equal(response.status, 401);
  assertErrorEnvelope(response);
});

test("GET /api/v2/tours with auth -> 200", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.body.items), true);
  assert.equal(typeof response.body.total, "number");
  assert.equal(typeof response.body.page, "number");
  assert.equal(typeof response.body.limit, "number");
  if (response.body.items.length > 0) {
    assert.equal(typeof response.body.items[0].totalCapacity, "number");
    assert.equal(typeof response.body.items[0].acceptedCount, "number");
    assert.equal(typeof response.body.items[0].lifecycleStatus, "string");
  }
});

test("GET /api/v2/tours?status=active with auth -> 200; items are DRAFT only", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .query({ page: 1, limit: 10, status: "active" })
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(response.status, 200);
  for (const row of response.body.items as { lifecycleStatus?: string }[]) {
    assert.equal(row.lifecycleStatus, "DRAFT");
  }
});

test("POST /api/v2/tours with auth -> create tour", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      title: `E2E Tour ${Date.now()}`,
      total_capacity: 5,
      lifecycle_status: "Draft"
    });

  assert.equal(response.status, 201);
  assert.equal(typeof response.body.id, "string");
  assert.equal(typeof response.body.totalCapacity, "number");
  assert.equal(typeof response.body.acceptedCount, "number");
  assert.equal(typeof response.body.lifecycleStatus, "string");
  createdTourId = response.body.id;
});

test("PATCH /api/v2/tours/:tourId with auth -> 200", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .patch(`/api/v2/tours/${createdTourId}`)
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      title: `E2E Tour Updated ${Date.now()}`
    });
  assert.equal(response.status, 200);
  assert.equal(typeof response.body.id, "string");
});

test("GET /api/v2/tours/:tourId with auth -> 200", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .get(`/api/v2/tours/${createdTourId}`)
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.id, createdTourId);
});

test("POST /api/v2/auth/link-telegram with auth invalid payload -> envelope, no 500", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/link-telegram")
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({ telegram_init_payload: "invalid", link_reason: "e2e" });

  assert.equal(response.status >= 400 && response.status < 500, true);
  assertErrorEnvelope(response);
});

test("POST /api/v2/auth/link-telegram with auth valid payload -> 200", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const telegramInitPayload = buildTelegramInitPayload("test-token", 987654321);
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/link-telegram")
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({ telegram_init_payload: telegramInitPayload });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.user_id, "string");
  assert.equal(response.body.linked_telegram_user_id, "987654321");
  assert.equal(response.body.link_status, "Linked");
  assert.equal(typeof response.body.linked_at, "string");
});

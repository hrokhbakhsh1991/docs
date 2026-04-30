import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request, { type Response } from "supertest";
import { AppModule } from "../src/app.module";
import { GlobalExceptionFilter } from "../src/common/errors/global-exception.filter";
import { LoggerService } from "../src/common/logger/logger.service";
import { AuthMiddleware } from "../src/common/middleware/auth.middleware";
import { RequestContextMiddleware } from "../src/common/request-context/request-context.middleware";
import { RequestContextService } from "../src/common/request-context/request-context.service";
import { TenantMiddleware } from "../src/common/tenant/tenant.middleware";

const RETRYABILITY_VALUES = new Set([
  "NO_RETRY",
  "SAFE_RETRY",
  "RETRY_WITH_BACKOFF",
  "RETRY_AFTER_ACTION"
]);

let app: INestApplication;
let sessionToken = "";
let createdTourId = "";

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

test("bootstrap test app", async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  app = moduleRef.createNestApplication();

  const requestContextMiddleware = app.get(RequestContextMiddleware);
  app.use(requestContextMiddleware.use.bind(requestContextMiddleware));
  const authMiddleware = app.get(AuthMiddleware);
  app.use(authMiddleware.use.bind(authMiddleware));
  const tenantMiddleware = app.get(TenantMiddleware);
  app.use(tenantMiddleware.use.bind(tenantMiddleware));

  const loggerService = app.get(LoggerService);
  const requestContextService = app.get(RequestContextService);
  app.useGlobalFilters(
    new GlobalExceptionFilter(loggerService, requestContextService)
  );

  await app.init();
});

test("GET /health -> 200 with requestId", async () => {
  const response = await request(app.getHttpServer()).get("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(typeof response.body.requestId, "string");
});

test("GET /health/live -> 200", async () => {
  const response = await request(app.getHttpServer()).get("/health/live");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "live");
});

test("GET /health/ready -> 200|503 (contract on failure)", async () => {
  const response = await request(app.getHttpServer()).get("/health/ready");
  assert.equal([200, 503].includes(response.status), true);
  if (response.status === 503) {
    assertErrorEnvelope(response);
  } else {
    assert.equal(response.body.status, "ready");
  }
});

test("GET /health/readiness -> 200|503 (contract on failure)", async () => {
  const response = await request(app.getHttpServer()).get("/health/readiness");
  assert.equal([200, 503].includes(response.status), true);
  if (response.status === 503) {
    assertErrorEnvelope(response);
  } else {
    assert.equal(response.body.status, "ready");
  }
});

test("POST /api/v2/auth/web/session -> 200 with JWT", async () => {
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session")
    .send({
      entry_mode: "web",
      credential: {
        email: "leader@example.com",
        password: "Passw0rd!"
      },
      asserted_tenant_id: "11111111-1111-4111-8111-111111111111"
    });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.session_token, "string");
  assert.equal(response.body.session_token.split(".").length, 3);
  assert.equal(response.body.entry_mode, "web");
  sessionToken = response.body.session_token;
});

test("POST /api/v2/auth/web/session invalid body -> 400 envelope", async () => {
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session")
    .send({});
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "VALIDATION_FAILED");
  assertErrorEnvelope(response);
});

test("POST /api/v2/auth/telegram/session invalid body -> 400 envelope", async () => {
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/telegram/session")
    .send({});
  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "VALIDATION_FAILED");
  assertErrorEnvelope(response);
});

test("POST /api/v2/auth/link-telegram without auth -> 401 envelope", async () => {
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/link-telegram")
    .send({ telegram_init_payload: "invalid" });
  assert.equal(response.status, 401);
  assertErrorEnvelope(response);
});

test("GET /api/v2/tours without auth -> 401 envelope", async () => {
  const response = await request(app.getHttpServer()).get("/api/v2/tours");
  assert.equal(response.status, 401);
  assertErrorEnvelope(response);
});

test("GET /api/v2/tours with auth -> 200", async () => {
  const response = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.body), true);
  if (response.body.length > 0) {
    assert.equal(typeof response.body[0].totalCapacity, "number");
    assert.equal(typeof response.body[0].acceptedCount, "number");
    assert.equal(typeof response.body[0].lifecycleStatus, "string");
  }
});

test("POST /api/v2/tours with auth -> create tour", async () => {
  const response = await request(app.getHttpServer())
    .post("/api/v2/tours")
    .set("Authorization", `Bearer ${sessionToken}`)
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
  const response = await request(app.getHttpServer())
    .patch(`/api/v2/tours/${createdTourId}`)
    .set("Authorization", `Bearer ${sessionToken}`)
    .send({
      title: `E2E Tour Updated ${Date.now()}`
    });
  assert.equal(response.status, 200);
  assert.equal(typeof response.body.id, "string");
});

test("GET /api/v2/tours/:tourId with auth -> 200", async () => {
  const response = await request(app.getHttpServer())
    .get(`/api/v2/tours/${createdTourId}`)
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.id, createdTourId);
});

test("POST /api/v2/auth/link-telegram with auth invalid payload -> envelope, no 500", async () => {
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/link-telegram")
    .set("Authorization", `Bearer ${sessionToken}`)
    .send({ telegram_init_payload: "invalid", link_reason: "e2e" });

  assert.equal(response.status >= 400 && response.status < 500, true);
  assertErrorEnvelope(response);
});

test("close test app", async () => {
  await app.close();
});

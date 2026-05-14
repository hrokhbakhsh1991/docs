import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
import { tenantTestHost } from "./tenant-test-host";
import { resetTestDatabaseWithMigrations } from "./reset-test-database";
import { E2E_DEV_OTP } from "./web-session-otp.helper";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI
} from "./jwt-test-keys";
import { UserRole } from "../../src/common/auth/user-role.enum";
import { TenantEntity } from "../../src/modules/identity/entities/tenant.entity";
import { UserEntity } from "../../src/modules/identity/entities/user.entity";
import { UserTenantEntity } from "../../src/modules/identity/entities/user-tenant.entity";
import { TourEntity, TourLifecycleStatus } from "../../src/modules/tours/entities/tour.entity";

/** Stable UUIDs for deterministic JWT / DB assertions. */
const TENANT_1 = "c1111111-1111-4111-8111-111111111111";
const TENANT_2 = "c2222222-2222-4222-8222-222222222222";
const TOUR_IN_T1 = "c3111111-1111-4111-8111-111111111111";
const TOUR_IN_T2 = "c3222222-2222-4222-8222-222222222222";

const DUAL_MEMBER_EMAIL = "dual-member@subdomain-comprehensive.test";
const TENANT1_ONLY_EMAIL = "tenant1-only@subdomain-comprehensive.test";
const DUAL_MEMBER_PHONE = "+15557500001";
const TENANT1_ONLY_PHONE = "+15557500002";

const INTERNAL_API_KEY = "test-internal-key-subdomain-comprehensive";

const RETRYABILITY_VALUES = new Set([
  "NO_RETRY",
  "SAFE_RETRY",
  "RETRY_WITH_BACKOFF",
  "RETRY_AFTER_ACTION"
]);

let container: StartedPostgreSqlContainer | undefined;
let app: INestApplication | undefined;
let e2eUnavailableReason: string | null = null;

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

/** Decode JWT payload (middle segment); API is trusted as signer in this suite. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  assert.equal(parts.length, 3);
  const json = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

function normalizeTenantId(value: unknown): string {
  assert.equal(typeof value, "string");
  return (value as string).trim().toLowerCase();
}

async function seed(ds: DataSource): Promise<void> {
  const tenantRepo = ds.getRepository(TenantEntity);
  const userRepo = ds.getRepository(UserEntity);
  const membershipRepo = ds.getRepository(UserTenantEntity);
  const tourRepo = ds.getRepository(TourEntity);

  await tenantRepo.insert([
    {
      id: TENANT_1,
      name: "Comprehensive T1",
      description: "subdomain-comprehensive e2e",
      subdomain: "tenant1"
    },
    {
      id: TENANT_2,
      name: "Comprehensive T2",
      description: "subdomain-comprehensive e2e",
      subdomain: "tenant2"
    }
  ]);

  const fixtureHash = await argon2.hash(`fixture-${randomUUID()}`);

  await userRepo.save(
    userRepo.create({
      email: DUAL_MEMBER_EMAIL,
      phone: DUAL_MEMBER_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Dual Member",
      isEmailVerified: true,
      telegramUserId: null
    })
  );
  await userRepo.save(
    userRepo.create({
      email: TENANT1_ONLY_EMAIL,
      phone: TENANT1_ONLY_PHONE,
      isPhoneVerified: true,
      hashedPassword: fixtureHash,
      fullName: "Tenant1 Only",
      isEmailVerified: true,
      telegramUserId: null
    })
  );

  const dual = await userRepo.findOneOrFail({ where: { email: DUAL_MEMBER_EMAIL } });
  const t1Only = await userRepo.findOneOrFail({ where: { email: TENANT1_ONLY_EMAIL } });

  await membershipRepo.save([
    membershipRepo.create({
      tenantId: TENANT_1,
      userId: dual.id,
      role: UserRole.Owner
    }),
    membershipRepo.create({
      tenantId: TENANT_2,
      userId: dual.id,
      role: UserRole.Owner
    }),
    membershipRepo.create({
      tenantId: TENANT_1,
      userId: t1Only.id,
      role: UserRole.Member
    })
  ]);

  await tourRepo.save(
    tourRepo.create({
      id: TOUR_IN_T1,
      tenantId: TENANT_1,
      title: "Tour tenant1 only",
      totalCapacity: 10,
      acceptedCount: 0,
      lifecycleStatus: TourLifecycleStatus.DRAFT
    })
  );
  await tourRepo.save(
    tourRepo.create({
      id: TOUR_IN_T2,
      tenantId: TENANT_2,
      title: "Tour tenant2 only",
      totalCapacity: 5,
      acceptedCount: 0,
      lifecycleStatus: TourLifecycleStatus.DRAFT
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
  await seed(app.get(DataSource));
});

after(async () => {
  if (app) {
    await app.close();
  }
  if (container) {
    await container.stop();
  }
});

test("login tenant1.localhost — response tenant_id and JWT tenant_id claim match TENANT_1", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost("tenant1"))
    .send({
      phone: DUAL_MEMBER_PHONE,
      otp: E2E_DEV_OTP
    });

  assert.equal(res.status, 200);
  const bodyTid = normalizeTenantId(res.body.tenant_id);
  assert.equal(bodyTid, TENANT_1);

  const token = res.body.session_token as string;
  const claims = decodeJwtPayload(token);
  assert.equal(normalizeTenantId(claims.tenant_id), TENANT_1);
  assert.equal(typeof claims.sub, "string");
  assert.equal(typeof claims.sess_ver, "number");
});

test("login tenant2.localhost — response tenant_id and JWT tenant_id claim match TENANT_2", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost("tenant2"))
    .send({
      phone: DUAL_MEMBER_PHONE,
      otp: E2E_DEV_OTP
    });

  assert.equal(res.status, 200);
  assert.equal(normalizeTenantId(res.body.tenant_id), TENANT_2);

  const claims = decodeJwtPayload(res.body.session_token as string);
  assert.equal(normalizeTenantId(claims.tenant_id), TENANT_2);
});

test("authenticated request on matching Host succeeds (JWT aligns with resolved tenant)", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const login = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost("tenant1"))
    .send({
      phone: DUAL_MEMBER_PHONE,
      otp: E2E_DEV_OTP
    });
  assert.equal(login.status, 200);
  const token = login.body.session_token as string;

  const tours = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .set("Host", tenantTestHost("tenant1"))
    .set("Authorization", `Bearer ${token}`);

  assert.equal(tours.status, 200);
  assert.equal(tours.body.total, 1);
  assert.equal(tours.body.items[0].id, TOUR_IN_T1);
});

test("unknown.localhost login → 404 TENANT_HOST_UNKNOWN", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost("unknown"))
    .send({
      phone: DUAL_MEMBER_PHONE,
      otp: E2E_DEV_OTP
    });

  assert.equal(res.status, 404);
  assert.equal(res.body.error?.code, "TENANT_HOST_UNKNOWN");
  assertErrorEnvelope(res);
});

test("Host/JWT mismatch — token for tenant1 used on tenant2 Host → TENANT_HOST_TOKEN_MISMATCH", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const login = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost("tenant1"))
    .send({
      phone: DUAL_MEMBER_PHONE,
      otp: E2E_DEV_OTP
    });
  assert.equal(login.status, 200);
  const token = login.body.session_token as string;
  assert.equal(normalizeTenantId(decodeJwtPayload(token).tenant_id), TENANT_1);

  const res = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .set("Host", tenantTestHost("tenant2"))
    .set("Authorization", `Bearer ${token}`);

  assert.equal(res.status, 403);
  assert.equal(res.body?.error?.code, "TENANT_HOST_TOKEN_MISMATCH");
  assertErrorEnvelope(res);
});

test("workspace switch — login on tenant1 then exchange session on tenant2 Host updates JWT tenant_id", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const login = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost("tenant1"))
    .send({
      phone: DUAL_MEMBER_PHONE,
      otp: E2E_DEV_OTP
    });
  assert.equal(login.status, 200);
  const token1 = login.body.session_token as string;
  assert.equal(normalizeTenantId(decodeJwtPayload(token1).tenant_id), TENANT_1);

  const switchRes = await request(app.getHttpServer())
    .post("/api/v2/auth/workspace/session")
    .set("Host", tenantTestHost("tenant2"))
    .set("Authorization", `Bearer ${token1}`)
    .send({ tenant_id: TENANT_2 });

  assert.equal(switchRes.status, 200);
  assert.equal(normalizeTenantId(switchRes.body.tenant_id), TENANT_2);
  const token2 = switchRes.body.session_token as string;
  assert.notEqual(token2, token1);
  assert.equal(normalizeTenantId(decodeJwtPayload(token2).tenant_id), TENANT_2);

  const tours = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .set("Host", tenantTestHost("tenant2"))
    .set("Authorization", `Bearer ${token2}`);

  assert.equal(tours.status, 200);
  assert.equal(tours.body.total, 1);
  assert.equal(tours.body.items[0].id, TOUR_IN_T2);
});

test("membership enforcement — user only in tenant1 cannot login on tenant2 → TENANT_SCOPE_FORBIDDEN", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const res = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost("tenant2"))
    .send({
      phone: TENANT1_ONLY_PHONE,
      otp: E2E_DEV_OTP
    });

  assert.equal(res.status, 403);
  assert.equal(res.body.error?.code, "TENANT_SCOPE_FORBIDDEN");
  assertErrorEnvelope(res);
});

test("cross-tenant resource access — cannot read other tenant tour by id under own Host", async () => {
  if (e2eUnavailableReason || !app) {
    return;
  }
  const login = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost("tenant1"))
    .send({
      phone: DUAL_MEMBER_PHONE,
      otp: E2E_DEV_OTP
    });
  assert.equal(login.status, 200);
  const token = login.body.session_token as string;

  const leak = await request(app.getHttpServer())
    .get(`/api/v2/tours/${TOUR_IN_T2}`)
    .set("Host", tenantTestHost("tenant1"))
    .set("Authorization", `Bearer ${token}`);

  assert.equal(leak.status, 404);
  assert.equal(leak.body.error?.code, "RESOURCE_NOT_FOUND");
  assertErrorEnvelope(leak);
});

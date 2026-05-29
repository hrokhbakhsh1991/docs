import "reflect-metadata";
import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import request from "supertest";
import { assertApiErrorEnvelope } from "@repo/testing-infra";

import { UserRole } from "../src/common/auth/user-role.enum";
import { seedAuthPersona } from "./helpers/auth-test-personas";
import {
  createAuthE2eHarness,
  teardownAuthE2eHarness,
  type AuthE2eHarnessContext,
} from "./e2e/auth/auth-e2e-harness";
import { E2E_DEV_OTP } from "./e2e/auth/auth-session.factory";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI,
} from "./e2e/jwt-test-keys";
import { tenantTestHost } from "./e2e/tenant-test-host";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT_ID = "22222222-2222-4222-8222-222222222222";
const SUBDOMAIN_PRIMARY = "e2e-primary";
const SUBDOMAIN_OTHER = "e2e-other";
const INTERNAL_API_KEY = "test-internal-key";
const LEADER_EMAIL = "leader@example.com";
const LEADER_PHONE = "+15550000001";
const OTHER_OWNER_PHONE = "+15550000002";
const E2E_INVITE_ACCEPT_TOKEN = "e2eaccept0123456789abcdef0123456789abcdef";

let ctx: AuthE2eHarnessContext;
let sessionToken = "";
let otherWorkspaceSessionToken = "";
let createdTourId = "";

function skip(): boolean {
  return Boolean(ctx.unavailableReason) || !ctx.app || !ctx.auth || !ctx.db;
}

function errorCode(body: Record<string, unknown>): string | undefined {
  const error = body.error;
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return undefined;
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

before(async () => {
  ctx = await createAuthE2eHarness({
    jwtKeys: {
      privatePem: E2E_JWT_PRIVATE_KEY_PKCS8,
      publicPem: E2E_JWT_PUBLIC_KEY_SPKI,
    },
    internalApiKey: INTERNAL_API_KEY,
    seed: async (ds) => {
      await seedAuthPersona(ds, {
        phone: LEADER_PHONE,
        email: LEADER_EMAIL,
        subdomain: SUBDOMAIN_PRIMARY,
        tenantId: TENANT_ID,
        tenantName: "API E2E Tenant",
        tenantDescription: "Seeded for test/api.e2e-spec.ts",
        role: UserRole.Owner,
        fullName: "E2E Leader",
      });
      await seedAuthPersona(ds, {
        phone: OTHER_OWNER_PHONE,
        email: "other-owner@example.com",
        subdomain: SUBDOMAIN_OTHER,
        tenantId: OTHER_TENANT_ID,
        tenantName: "API E2E Other Tenant",
        tenantDescription: "Seeded non-member tenant for workspace authz tests",
        role: UserRole.Owner,
        fullName: "E2E Other Workspace Owner",
      });
    },
  });
});

after(async () => {
  await teardownAuthE2eHarness(ctx);
});

test("GET /health -> 200 with requestId", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer()).get("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "ok");
  assert.equal(typeof response.body.requestId, "string");
});

test("GET /health/live -> 200", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer()).get("/health/live");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "live");
});

test("GET /health/ready -> 200|503 (contract on failure)", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer()).get("/health/ready");
  assert.equal([200, 503].includes(response.status), true);
  if (response.status === 503) {
    assertApiErrorEnvelope(response.body);
  } else {
    assert.equal(response.body.status, "ready");
  }
});

test("GET /health/readiness -> 200|503 (contract on failure)", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer()).get("/health/readiness");
  assert.equal([200, 503].includes(response.status), true);
  if (response.status === 503) {
    assertApiErrorEnvelope(response.body);
  } else {
    assert.equal(response.body.status, "ready");
  }
});

test("POST /api/v2/auth/web/session/otp missing phone -> 400 envelope", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.postWebSessionOtpRaw({
    tenantSubdomain: SUBDOMAIN_PRIMARY,
    body: { otp: E2E_DEV_OTP },
  });

  assert.equal(response.status, 400);
  assert.equal(errorCode(response.body), "VALIDATION_FAILED");
  assertApiErrorEnvelope(response.body);
});

test("POST /api/v2/auth/web/session/otp missing otp -> 400 envelope", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.postWebSessionOtpRaw({
    tenantSubdomain: SUBDOMAIN_PRIMARY,
    body: { phone: LEADER_PHONE },
  });

  assert.equal(response.status, 400);
  assert.equal(errorCode(response.body), "VALIDATION_FAILED");
  assertApiErrorEnvelope(response.body);
});

test("POST /api/v2/auth/web/session/otp wrong otp -> 401 envelope", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.postWebSessionOtpRaw({
    tenantSubdomain: SUBDOMAIN_PRIMARY,
    body: { phone: LEADER_PHONE, otp: "0000" },
  });

  assert.equal(response.status, 401);
  assert.equal(errorCode(response.body), "AUTH_OTP_INVALID");
  assertApiErrorEnvelope(response.body);
});

test("POST /api/v2/auth/web/session/otp correct otp -> 200 with JWT", async () => {
  if (skip()) {
    return;
  }
  sessionToken = await ctx.auth!.loginOtp({
    phone: LEADER_PHONE,
    tenantSubdomain: SUBDOMAIN_PRIMARY,
    otp: E2E_DEV_OTP,
  });
  assert.equal(sessionToken.split(".").length, 3);
});

test("POST /api/v2/auth/web/session/otp normalizes phone formatting -> 200", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.postWebSessionOtpRaw({
    tenantSubdomain: SUBDOMAIN_PRIMARY,
    body: { phone: " +1 (555) 000-0001 ", otp: E2E_DEV_OTP },
  });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.session_token, "string");
  assert.equal(response.body.entry_mode, "web");
});

test("POST /api/v2/auth/workspace/session for tenant without membership -> 403 envelope", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.postWorkspaceSessionRaw({
    bearer: sessionToken,
    targetTenantId: OTHER_TENANT_ID,
    hostSubdomain: SUBDOMAIN_OTHER,
  });

  assert.equal(response.status, 403);
  assert.equal(errorCode(response.body), "TENANT_SCOPE_FORBIDDEN");
  assertApiErrorEnvelope(response.body);
});

test("POST /api/v2/invites/:token/accept without auth -> 401 envelope", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer()).post(
    `/api/v2/invites/${E2E_INVITE_ACCEPT_TOKEN}/accept`,
  );
  assert.equal(response.status, 401);
  assertApiErrorEnvelope(response.body);
});

test("POST /api/v2/invites/:token/accept unknown token -> 404 envelope", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer())
    .post("/api/v2/invites/000000000000000000000000000000000000000000000000/accept")
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(response.status, 404);
  assertApiErrorEnvelope(response.body);
});

test("POST /api/v2/invites/:token/accept valid invite -> 200, membership, invite removed", async () => {
  if (skip()) {
    return;
  }
  const leaderId = await ctx.db!.findUserIdByEmail(LEADER_EMAIL);
  await ctx.db!.insertPendingWorkspaceInvite({
    tenantId: OTHER_TENANT_ID,
    email: LEADER_EMAIL,
    role: UserRole.Member,
    inviteToken: E2E_INVITE_ACCEPT_TOKEN,
    invitedByUserId: leaderId,
  });

  const response = await request(ctx.app!.getHttpServer())
    .post(`/api/v2/invites/${E2E_INVITE_ACCEPT_TOKEN}/accept`)
    .set("Authorization", `Bearer ${sessionToken}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.tenant_id, OTHER_TENANT_ID);
  assert.equal(response.body.role, UserRole.Member);

  assert.equal(
    await ctx.db!.hasActiveMembership({ userId: leaderId, tenantId: OTHER_TENANT_ID }),
    true,
  );
  assert.equal(await ctx.db!.countWorkspaceInvitesByToken(E2E_INVITE_ACCEPT_TOKEN), 0);

  const again = await request(ctx.app!.getHttpServer())
    .post(`/api/v2/invites/${E2E_INVITE_ACCEPT_TOKEN}/accept`)
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(again.status, 404);
  assertApiErrorEnvelope(again.body);
});

test("POST /api/v2/auth/workspace/session for tenant after invite membership -> 200 with JWT", async () => {
  if (skip()) {
    return;
  }
  const switched = await ctx.auth!.switchWorkspace({
    bearer: sessionToken,
    targetTenantId: OTHER_TENANT_ID,
    tenantSubdomain: SUBDOMAIN_OTHER,
  });

  assert.equal(typeof switched.token, "string");
  assert.equal(switched.tenantId, OTHER_TENANT_ID.toLowerCase());
  otherWorkspaceSessionToken = switched.token;
});

test("GET /api/v2/auth/workspaces with OTHER tenant member session -> 200", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer())
    .get("/api/v2/auth/workspaces")
    .set("Authorization", `Bearer ${otherWorkspaceSessionToken}`);

  assert.equal(response.status, 200);
  assert.equal(Array.isArray(response.body), true);
});

test("PATCH /api/v2/users/:id with member-only OTHER tenant session -> 403", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer())
    .patch(`/api/v2/users/${randomUUID()}`)
    .set("Authorization", `Bearer ${otherWorkspaceSessionToken}`)
    .send({
      role: "member",
    });

  assert.equal(response.status, 403);
});

test("POST /api/v2/auth/web/session/otp unknown tenant slug host -> 404 TENANT_HOST_UNKNOWN", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.postWebSessionOtpRaw({
    tenantSubdomain: "no-such-tenant-slug",
    body: { phone: LEADER_PHONE, otp: E2E_DEV_OTP },
  });
  assert.equal(response.status, 404);
  assert.equal(errorCode(response.body), "TENANT_HOST_UNKNOWN");
  assertApiErrorEnvelope(response.body);
});

test("POST /api/v2/auth/web/session/otp apex Host -> 400 TENANT_HOST_INVALID", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.postWebSessionOtpRaw({
    host: "localhost",
    body: { phone: LEADER_PHONE, otp: E2E_DEV_OTP },
  });
  assert.equal(response.status, 400);
  assert.equal(errorCode(response.body), "TENANT_HOST_INVALID");
  assertApiErrorEnvelope(response.body);
});

test("POST /api/v2/auth/web/session/otp invalid body (no Host) -> 400 envelope", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.postWebSessionOtpRaw({
    tenantSubdomain: SUBDOMAIN_PRIMARY,
    body: {},
  });
  assert.equal(response.status, 400);
  assert.equal(errorCode(response.body), "VALIDATION_FAILED");
  assertApiErrorEnvelope(response.body);
});

test("POST /api/v2/auth/telegram/session invalid body (no Host) -> 400 envelope", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer())
    .post("/api/v2/auth/telegram/session")
    .set("Host", tenantTestHost(SUBDOMAIN_PRIMARY))
    .send({});
  assert.equal(response.status, 400);
  assert.equal(errorCode(response.body), "VALIDATION_FAILED");
  assertApiErrorEnvelope(response.body);
});

test("POST /api/v2/auth/link-telegram without auth -> 401 envelope", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer())
    .post("/api/v2/auth/link-telegram")
    .send({ telegram_init_payload: "invalid" });
  assert.equal(response.status, 401);
  assertApiErrorEnvelope(response.body);
});

test("GET /api/v2/tours without auth -> 401 envelope", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer()).get("/api/v2/tours");
  assert.equal(response.status, 401);
  assertApiErrorEnvelope(response.body);
});

test("GET /api/v2/tours with auth -> 200", async () => {
  if (skip()) {
    return;
  }
  const response = await ctx.auth!.getToursRaw({
    bearer: sessionToken,
    tenantSubdomain: SUBDOMAIN_PRIMARY,
  });
  assert.equal(response.status, 200);
  const items = response.body.items;
  assert.equal(Array.isArray(items), true);
  assert.equal(typeof response.body.total, "number");
  assert.equal(typeof response.body.page, "number");
  assert.equal(typeof response.body.limit, "number");
  if (Array.isArray(items) && items.length > 0) {
    const row = items[0] as Record<string, unknown>;
    assert.equal(typeof row.totalCapacity, "number");
    assert.equal(typeof row.acceptedCount, "number");
    assert.equal(typeof row.lifecycleStatus, "string");
  }
});

test("GET /api/v2/tours?status=active with auth -> 200; items are DRAFT only", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer())
    .get("/api/v2/tours")
    .set("Host", tenantTestHost(SUBDOMAIN_PRIMARY))
    .query({ page: 1, limit: 10, status: "active" })
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(response.status, 200);
  for (const row of response.body.items as { lifecycleStatus?: string }[]) {
    assert.equal(row.lifecycleStatus, "DRAFT");
  }
});

test("POST /api/v2/tours with auth -> create tour", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer())
    .post("/api/v2/tours")
    .set("Host", tenantTestHost(SUBDOMAIN_PRIMARY))
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      title: `E2E Tour ${Date.now()}`,
      total_capacity: 5,
      lifecycle_status: "Draft",
    });

  assert.equal(response.status, 201);
  assert.equal(typeof response.body.id, "string");
  assert.equal(typeof response.body.totalCapacity, "number");
  assert.equal(typeof response.body.acceptedCount, "number");
  assert.equal(typeof response.body.lifecycleStatus, "string");
  createdTourId = response.body.id;
});

test("PATCH /api/v2/tours/:tourId with auth -> 200", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer())
    .patch(`/api/v2/tours/${createdTourId}`)
    .set("Host", tenantTestHost(SUBDOMAIN_PRIMARY))
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({
      title: `E2E Tour Updated ${Date.now()}`,
    });
  assert.equal(response.status, 200);
  assert.equal(typeof response.body.id, "string");
});

test("GET /api/v2/tours/:tourId with auth -> 200", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer())
    .get(`/api/v2/tours/${createdTourId}`)
    .set("Host", tenantTestHost(SUBDOMAIN_PRIMARY))
    .set("Authorization", `Bearer ${sessionToken}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.id, createdTourId);
});

test("POST /api/v2/auth/link-telegram with auth invalid payload -> envelope, no 500", async () => {
  if (skip()) {
    return;
  }
  const response = await request(ctx.app!.getHttpServer())
    .post("/api/v2/auth/link-telegram")
    .set("Host", tenantTestHost(SUBDOMAIN_PRIMARY))
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({ telegram_init_payload: "invalid", link_reason: "e2e" });

  assert.equal(response.status >= 400 && response.status < 500, true);
  assertApiErrorEnvelope(response.body);
});

test("POST /api/v2/auth/link-telegram with auth valid payload -> 200", async () => {
  if (skip()) {
    return;
  }
  const telegramInitPayload = buildTelegramInitPayload("test-token", 987654321);
  const response = await request(ctx.app!.getHttpServer())
    .post("/api/v2/auth/link-telegram")
    .set("Host", tenantTestHost(SUBDOMAIN_PRIMARY))
    .set("Authorization", `Bearer ${sessionToken}`)
    .set("Idempotency-Key", randomUUID())
    .send({ telegram_init_payload: telegramInitPayload });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.user_id, "string");
  assert.equal(response.body.linked_telegram_user_id, "987654321");
  assert.equal(response.body.link_status, "Linked");
  assert.equal(typeof response.body.linked_at, "string");
});

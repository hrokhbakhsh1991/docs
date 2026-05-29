import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import request from "supertest";
import { assertApiErrorEnvelope } from "@repo/testing-infra";

import { UserRole } from "../../src/common/auth/user-role.enum";
import { seedAuthPersona, seedTwoTenantPersonas } from "../helpers/auth-test-personas";
import { seedTourCatalogRows } from "../helpers/tours-test-fixtures";
import {
  createAuthE2eHarness,
  teardownAuthE2eHarness,
  type AuthE2eHarnessContext,
} from "./auth/auth-e2e-harness";
import { E2E_DEV_OTP } from "./auth/auth-session.factory";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI,
} from "./jwt-test-keys";
import { tenantTestHost } from "./tenant-test-host";

/** Stable UUIDs for deterministic JWT / DB assertions. */
const TENANT_1 = "c1111111-1111-4111-8111-111111111111";
const TENANT_2 = "c2222222-2222-4222-8222-222222222222";
const TOUR_IN_T1 = "c3111111-1111-4111-8111-111111111111";
const TOUR_IN_T2 = "c3222222-2222-4222-8222-222222222222";

const SUBDOMAIN_T1 = "tenant1";
const SUBDOMAIN_T2 = "tenant2";

const DUAL_MEMBER_EMAIL = "dual-member@subdomain-comprehensive.test";
const TENANT1_ONLY_EMAIL = "tenant1-only@subdomain-comprehensive.test";
const DUAL_MEMBER_PHONE = "+15557500001";
const TENANT1_ONLY_PHONE = "+15557500002";

const INTERNAL_API_KEY = "test-internal-key-subdomain-comprehensive";

let ctx: AuthE2eHarnessContext;

function skip(): boolean {
  return Boolean(ctx.unavailableReason) || !ctx.app || !ctx.auth;
}

function normalizeTenantId(value: unknown): string {
  assert.equal(typeof value, "string");
  return (value as string).trim().toLowerCase();
}

before(async () => {
  ctx = await createAuthE2eHarness({
    jwtKeys: {
      privatePem: E2E_JWT_PRIVATE_KEY_PKCS8,
      publicPem: E2E_JWT_PUBLIC_KEY_SPKI,
    },
    internalApiKey: INTERNAL_API_KEY,
    seed: async (ds) => {
      await seedTwoTenantPersonas(ds, {
        tenantA: {
          id: TENANT_1,
          subdomain: SUBDOMAIN_T1,
          name: "Comprehensive T1",
          description: "subdomain-comprehensive e2e",
        },
        tenantB: {
          id: TENANT_2,
          subdomain: SUBDOMAIN_T2,
          name: "Comprehensive T2",
          description: "subdomain-comprehensive e2e",
        },
        dualMember: {
          phone: DUAL_MEMBER_PHONE,
          email: DUAL_MEMBER_EMAIL,
          subdomain: SUBDOMAIN_T1,
          role: UserRole.Owner,
          fullName: "Dual Member",
        },
      });

      // After dualMember (owner on both tenants) — userInAOnly in seedTwoTenantPersonas runs first and violates owner constraint.
      await seedAuthPersona(ds, {
        phone: TENANT1_ONLY_PHONE,
        email: TENANT1_ONLY_EMAIL,
        tenantId: TENANT_1,
        subdomain: SUBDOMAIN_T1,
        role: UserRole.Member,
        fullName: "Tenant1 Only",
      });

      await seedTourCatalogRows(ds, [
        { id: TOUR_IN_T1, tenantId: TENANT_1, title: "Tour tenant1 only" },
        { id: TOUR_IN_T2, tenantId: TENANT_2, title: "Tour tenant2 only", totalCapacity: 5 },
      ]);
    },
  });
});

after(async () => {
  await teardownAuthE2eHarness(ctx);
});

test("login tenant1.localhost — response tenant_id and JWT tenant_id claim match TENANT_1", async () => {
  if (skip()) {
    return;
  }

  const session = await ctx.auth!.loginOtpOrRegistration({
    phone: DUAL_MEMBER_PHONE,
    tenantSubdomain: SUBDOMAIN_T1,
    otp: E2E_DEV_OTP,
  });
  assert.equal(session.kind, "session");
  assert.equal(session.tenantId, normalizeTenantId(TENANT_1));
  assert.equal(ctx.auth!.decodeSessionTenantId(session.token), normalizeTenantId(TENANT_1));
  const claims = ctx.auth!.decodeJwtPayload(session.token);
  assert.equal(typeof claims.sub, "string");
  assert.equal(typeof claims.sess_ver, "number");
});

test("login tenant2.localhost — response tenant_id and JWT tenant_id claim match TENANT_2", async () => {
  if (skip()) {
    return;
  }

  const session = await ctx.auth!.loginOtpOrRegistration({
    phone: DUAL_MEMBER_PHONE,
    tenantSubdomain: SUBDOMAIN_T2,
    otp: E2E_DEV_OTP,
  });
  assert.equal(session.kind, "session");
  assert.equal(session.tenantId, normalizeTenantId(TENANT_2));
  assert.equal(ctx.auth!.decodeSessionTenantId(session.token), normalizeTenantId(TENANT_2));
});

test("authenticated request on matching Host succeeds (JWT aligns with resolved tenant)", async () => {
  if (skip()) {
    return;
  }

  const token = await ctx.auth!.loginOtp({
    phone: DUAL_MEMBER_PHONE,
    tenantSubdomain: SUBDOMAIN_T1,
    otp: E2E_DEV_OTP,
  });

  const tours = await ctx.auth!.getToursRaw({
    bearer: token,
    tenantSubdomain: SUBDOMAIN_T1,
  });

  assert.equal(tours.status, 200);
  assert.equal(tours.body.total, 1);
  const items = tours.body.items as Array<{ id: string }>;
  assert.equal(items[0].id, TOUR_IN_T1);
});

test("unknown.localhost login → 404 TENANT_HOST_UNKNOWN", async () => {
  if (skip()) {
    return;
  }

  const res = await ctx.auth!.postWebSessionOtpRaw({
    tenantSubdomain: "unknown",
    body: { phone: DUAL_MEMBER_PHONE, otp: E2E_DEV_OTP },
  });

  assert.equal(res.status, 404);
  assert.equal(res.body.error?.code, "TENANT_HOST_UNKNOWN");
  assertApiErrorEnvelope(res.body);
});

test("Host/JWT mismatch — token for tenant1 used on tenant2 Host → TENANT_HOST_TOKEN_MISMATCH", async () => {
  if (skip()) {
    return;
  }

  const token = await ctx.auth!.loginOtp({
    phone: DUAL_MEMBER_PHONE,
    tenantSubdomain: SUBDOMAIN_T1,
    otp: E2E_DEV_OTP,
  });
  assert.equal(ctx.auth!.decodeSessionTenantId(token), normalizeTenantId(TENANT_1));

  const res = await ctx.auth!.getToursRaw({
    bearer: token,
    tenantSubdomain: SUBDOMAIN_T2,
  });

  assert.equal(res.status, 403);
  assert.equal(res.body.error?.code, "TENANT_HOST_TOKEN_MISMATCH");
  assertApiErrorEnvelope(res.body);
});

test("workspace switch — login on tenant1 then exchange session on tenant2 Host updates JWT tenant_id", async () => {
  if (skip()) {
    return;
  }

  const token1 = await ctx.auth!.loginOtp({
    phone: DUAL_MEMBER_PHONE,
    tenantSubdomain: SUBDOMAIN_T1,
    otp: E2E_DEV_OTP,
  });
  assert.equal(ctx.auth!.decodeSessionTenantId(token1), normalizeTenantId(TENANT_1));

  const switched = await ctx.auth!.switchWorkspace({
    bearer: token1,
    targetTenantId: TENANT_2,
    tenantSubdomain: SUBDOMAIN_T2,
  });

  assert.equal(switched.tenantId, normalizeTenantId(TENANT_2));
  assert.notEqual(switched.token, token1);
  assert.equal(ctx.auth!.decodeSessionTenantId(switched.token), normalizeTenantId(TENANT_2));

  const tours = await ctx.auth!.getToursRaw({
    bearer: switched.token,
    tenantSubdomain: SUBDOMAIN_T2,
  });

  assert.equal(tours.status, 200);
  assert.equal(tours.body.total, 1);
  const items = tours.body.items as Array<{ id: string }>;
  assert.equal(items[0].id, TOUR_IN_T2);
});

test("membership enforcement — user only in tenant1 cannot obtain tenant2 session via OTP", async () => {
  if (skip()) {
    return;
  }

  const res = await ctx.auth!.postWebSessionOtpRaw({
    tenantSubdomain: SUBDOMAIN_T2,
    body: { phone: TENANT1_ONLY_PHONE, otp: E2E_DEV_OTP },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.requires_registration, true);
  assert.equal(typeof res.body.onboarding_token, "string");
  assert.equal(
    (res.body.tenant_id as string).trim().toLowerCase(),
    normalizeTenantId(TENANT_2),
  );
  assert.ok(!res.body.session_token);
});

test("cross-tenant resource access — cannot read other tenant tour by id under own Host", async () => {
  if (skip()) {
    return;
  }

  const token = await ctx.auth!.loginOtp({
    phone: DUAL_MEMBER_PHONE,
    tenantSubdomain: SUBDOMAIN_T1,
    otp: E2E_DEV_OTP,
  });

  const leak = await request(ctx.app!.getHttpServer())
    .get(`/api/v2/tours/${TOUR_IN_T2}`)
    .set("Host", tenantTestHost(SUBDOMAIN_T1))
    .set("Authorization", `Bearer ${token}`);

  assert.equal(leak.status, 404);
  assert.equal(leak.body.error?.code, "RESOURCE_NOT_FOUND");
  assertApiErrorEnvelope(leak.body);
});

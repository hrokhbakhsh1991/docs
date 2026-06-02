import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import request from "supertest";
import { assertApiErrorEnvelope } from "@repo/testing-infra";

import {
  allocateAuthTestPhone,
  authTestEmailForPhone,
} from "../../helpers/auth-test-ids";
import { seedTwoTenantPersonas } from "../../helpers/auth-test-personas";
import { UserRole } from "../../../src/common/auth/user-role.enum";
import {
  createAuthE2eHarness,
  teardownAuthE2eHarness,
  type AuthE2eHarnessContext,
} from "./auth-e2e-harness";
import { E2E_DEV_OTP } from "./auth-session.factory";
import {
  E2E_JWT_PRIVATE_KEY_PKCS8,
  E2E_JWT_PUBLIC_KEY_SPKI,
} from "../jwt-test-keys";
import { tenantTestHost } from "../tenant-test-host";

const TENANT_A = "c3c3c3c3-c3c3-43c3-83c3-c3c3c3c3c3c3";
const TENANT_B = "d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d4";
const SUBDOMAIN_A = "reg-flow-a";
const SUBDOMAIN_B = "reg-flow-b";
const INTERNAL_API_KEY = "test-internal-key-registration-flow";
const TENANT_A_OWNER_PHONE = "+15559100001";
const TENANT_B_OWNER_PHONE = "+15559100002";

let ctx: AuthE2eHarnessContext;

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
          id: TENANT_A,
          subdomain: SUBDOMAIN_A,
          name: "Registration flow tenant A",
          description: "registration-flow.e2e-spec.ts",
        },
        tenantB: {
          id: TENANT_B,
          subdomain: SUBDOMAIN_B,
          name: "Registration flow tenant B",
          description: "registration-flow.e2e-spec.ts",
        },
        userInAOnly: {
          phone: TENANT_A_OWNER_PHONE,
          email: "reg-flow-owner-a@auth-e2e.test",
          subdomain: SUBDOMAIN_A,
          role: UserRole.Owner,
          fullName: "Reg flow tenant A owner",
        },
        userInBOnly: {
          phone: TENANT_B_OWNER_PHONE,
          email: "reg-flow-owner-b@auth-e2e.test",
          subdomain: SUBDOMAIN_B,
          role: UserRole.Owner,
          fullName: "Reg flow tenant B owner",
        },
      });
    },
  });
});

after(async () => {
  await teardownAuthE2eHarness(ctx);
});

test("web registration flow: OTP request → registration onboarding → complete → session + membership", async () => {
  if (skip()) {
    return;
  }

  const phone = allocateAuthTestPhone();
  const email = authTestEmailForPhone(phone);
  const fullName = "Registration Flow E2E";

  const otpRequest = await request(ctx.app!.getHttpServer())
    .post("/api/v2/auth/web/otp/request")
    .set("Host", tenantTestHost(SUBDOMAIN_A))
    .send({ phone });
  assert.equal(otpRequest.status, 200);
  assert.equal(otpRequest.body.otp_requested, true);

  const onboarding = await ctx.auth!.loginOtpOrRegistration({
    phone,
    tenantSubdomain: SUBDOMAIN_A,
    otp: E2E_DEV_OTP,
  });
  assert.equal(onboarding.kind, "registration");
  assert.equal(onboarding.phone, phone);
  assert.equal(onboarding.tenantId, TENANT_A.toLowerCase());

  const completed = await ctx.auth!.completeRegistration({
    onboardingToken: onboarding.onboardingToken,
    fullName,
    email,
    tenantSubdomain: SUBDOMAIN_A,
  });

  assert.equal(completed.tenantId, TENANT_A.toLowerCase());
  assert.equal(completed.token.split(".").length, 3);
  assert.equal(ctx.auth!.decodeSessionTenantId(completed.token), TENANT_A.toLowerCase());

  const claims = ctx.auth!.decodeJwtPayload(completed.token);
  assert.equal(claims.sub, completed.userId);
  assert.equal(typeof claims.role, "string");

  assert.equal(
    await ctx.db!.hasActiveMembership({ userId: completed.userId, tenantId: TENANT_A }),
    true,
  );
});

test("complete registration rejects Host tenant mismatching onboarding token tenant (403 TENANT_HOST_MISMATCH)", async () => {
  if (skip()) {
    return;
  }

  const phone = allocateAuthTestPhone();

  const onboarding = await ctx.auth!.loginOtpOrRegistration({
    phone,
    tenantSubdomain: SUBDOMAIN_A,
    otp: E2E_DEV_OTP,
  });
  assert.equal(onboarding.kind, "registration");

  const response = await ctx.auth!.postCompleteRegistrationRaw({
    onboardingToken: onboarding.onboardingToken,
    fullName: "Host Mismatch User",
    tenantSubdomain: SUBDOMAIN_B,
  });

  assert.equal(response.status, 403);
  assert.equal(errorCode(response.body), "TENANT_HOST_MISMATCH");
  assertApiErrorEnvelope(response.body);
});

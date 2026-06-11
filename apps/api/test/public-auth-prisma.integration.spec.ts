/**
 * Public catalog OTP — Postgres persistence (M17)
 * @see docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { after, before, describe, it } from "node:test";

import { resetIdentityRepositorySingletonForTests } from "../src/identity/create-identity-repository";
import {
  resetOnboardingTokenKeyCacheForTests,
} from "../src/identity/onboarding-token";
import { resetSessionTokenKeyCacheForTests } from "../src/identity/sign-session-token";
import { disconnectPrisma, getPrisma } from "../src/db/prisma";
import { withTenantRls } from "../src/db/with-tenant-rls";
import { createRequestListener } from "../src/app";
import { createTestToursService } from "./test-helpers";
import { installHttpTestClient } from "./http-test-client";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const NEW_MOBILE = "+15550007771";

function publicAuthHeaders(tenantId: string): Record<string, string> {
  return {
    "x-tenant-id": tenantId,
    "x-authenticated-tenant-id": tenantId,
    "x-user-id": "00000000-0000-4000-8000-000000000099",
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-public-prisma",
  };
}

describe(
  "public-auth-prisma.integration.spec.ts — M17",
  { skip: !hasDatabase, concurrency: false },
  () => {
    const tenantId = randomUUID();
    const priorDriver = process.env.STORAGE_DRIVER;
    const client = installHttpTestClient(() =>
      createRequestListener({ toursService: createTestToursService() })
    );

    before(async () => {
      process.env.STORAGE_DRIVER = "prisma";
      process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
      const pair = await generateKeyPair("RS256", { extractable: true });
      process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
      process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
      process.env.AUTH_JWT_ISSUER = "tour-ops";
      process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
      resetSessionTokenKeyCacheForTests();
      resetOnboardingTokenKeyCacheForTests();
      resetIdentityRepositorySingletonForTests();

      await getPrisma().tenant.create({
        data: {
          id: tenantId,
          subdomain: `pub-auth-${tenantId.slice(0, 8)}`,
          workspaceType: "denali",
          theme: {},
        },
      });
    });

    after(async () => {
      process.env.STORAGE_DRIVER = priorDriver;
      resetSessionTokenKeyCacheForTests();
      resetOnboardingTokenKeyCacheForTests();
      resetIdentityRepositorySingletonForTests();
      await disconnectPrisma();
    });

    it("PUB-AUTH-PRISMA-01 register/complete persists member membership on Postgres", async () => {
      const issued = await client.requestJson("POST", "/public/auth/request-otp", {
        headers: publicAuthHeaders(tenantId),
        body: { mobile: NEW_MOBILE },
      });
      assert.equal(issued.status, 200);

      const verified = await client.requestJson("POST", "/public/auth/verify-otp", {
        headers: publicAuthHeaders(tenantId),
        body: { challengeId: issued.body.challengeId, code: "1234" },
      });
      assert.equal(verified.status, 200);
      assert.equal(verified.body.requiresRegistration, true);

      const completed = await client.requestJson("POST", "/public/auth/register/complete", {
        headers: publicAuthHeaders(tenantId),
        body: {
          onboardingToken: verified.body.onboardingToken,
          displayName: "Prisma Guest",
          email: "prisma.guest@example.com",
        },
      });
      assert.equal(completed.status, 200);
      assert.equal(completed.body.role, "member");
      assert.equal(typeof completed.body.userId, "string");

      const userId = String(completed.body.userId);
      const userRow = await getPrisma().user.findUnique({ where: { mobile: NEW_MOBILE } });
      assert.notEqual(userRow, null);
      assert.equal(userRow?.id, userId);

      const membership = await withTenantRls(tenantId, (tx) =>
        tx.userTenant.findUnique({
          where: { userId_tenantId: { userId, tenantId } },
        })
      );
      assert.notEqual(membership, null);
      assert.equal(membership?.role, "member");
      assert.equal(membership?.status, "ACTIVE");
      const metadata = membership?.membershipMetadata as { email?: string; displayName?: string };
      assert.equal(metadata.displayName, "Prisma Guest");
      assert.equal(metadata.email, "prisma.guest@example.com");
    });
  }
);

/**
 * Public catalog registration — phone OTP (M17)
 * Authority: docs/workspaces/denali/public-catalog.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import {
  getIdentityRepository,
  resetIdentityRepositoryForTests,
} from "../src/identity/create-identity-repository";
import {
  resetOnboardingTokenKeyCacheForTests,
} from "../src/identity/onboarding-token";
import { resetSessionTokenKeyCacheForTests } from "../src/identity/sign-session-token";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const NEW_PUBLIC_MOBILE = "+15550009901";

const ENV_SNAPSHOT = {
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_PRIVATE_KEY: process.env.AUTH_JWT_PRIVATE_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  AUTH_ALLOW_DEV_STATIC_OTP: process.env.AUTH_ALLOW_DEV_STATIC_OTP,
};

installMemoryStorageDriverForDescribe();

function publicAuthHeaders(): Record<string, string> {
  return {
    "x-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-authenticated-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-user-id": "00000000-0000-4000-8000-000000000099",
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-public-dev",
  };
}

async function httpJson(
  method: "POST",
  path: string,
  options?: { headers?: Record<string, string>; body?: unknown }
): Promise<{ status: number; body: Record<string, unknown> }> {
  const listener = createRequestListener({ toursService: createTestToursService() });
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("no listen address"));
        return;
      }
      const payload = options?.body === undefined ? undefined : JSON.stringify(options.body);
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port: addr.port,
          path,
          method,
          headers: {
            ...options?.headers,
            ...(payload
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": String(Buffer.byteLength(payload)),
                }
              : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk as Buffer));
          res.on("end", () => {
            server.close();
            const text = Buffer.concat(chunks).toString("utf8");
            resolve({
              status: res.statusCode ?? 0,
              body: text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : {},
            });
          });
        }
      );
      req.on("error", (error) => {
        server.close();
        reject(error);
      });
      if (payload !== undefined) req.write(payload);
      req.end();
    });
  });
}

describe("public-auth.spec.ts — M17 public catalog OTP", () => {
  before(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
    process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
    resetSessionTokenKeyCacheForTests();
    resetOnboardingTokenKeyCacheForTests();
  });

  beforeEach(() => {
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
    resetSessionTokenKeyCacheForTests();
    resetOnboardingTokenKeyCacheForTests();
    const repo = resetIdentityRepositoryForTests();
    repo.seedUser({ id: OPERATOR_SMOKE.memberUserId, mobile: OPERATOR_SMOKE.memberMobile });
    repo.seedMembership({
      userId: OPERATOR_SMOKE.memberUserId,
      tenantId: OPERATOR_SMOKE.tenantId,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-member-smoke",
      displayName: "Smoke Member",
    });
  });

  afterEach(() => {
    resetSessionTokenKeyCacheForTests();
    resetOnboardingTokenKeyCacheForTests();
  });

  after(() => {
    process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
    process.env.AUTH_JWT_PRIVATE_KEY = ENV_SNAPSHOT.AUTH_JWT_PRIVATE_KEY;
    process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
    process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = ENV_SNAPSHOT.AUTH_ALLOW_DEV_STATIC_OTP;
  });

  it("PUB-AUTH-01 phone-preflight returns exists for seeded member", async () => {
    const response = await httpJson("POST", "/public/auth/phone-preflight", {
      headers: publicAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.memberMobile },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.exists, true);
  });

  it("PUB-AUTH-02 phone-preflight returns exists false for unknown mobile", async () => {
    const response = await httpJson("POST", "/public/auth/phone-preflight", {
      headers: publicAuthHeaders(),
      body: { mobile: NEW_PUBLIC_MOBILE },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.exists, false);
  });

  it("PUB-AUTH-03 existing member verify-otp returns session", async () => {
    const issued = await httpJson("POST", "/public/auth/request-otp", {
      headers: publicAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.memberMobile },
    });
    assert.equal(issued.status, 200);

    const verified = await httpJson("POST", "/public/auth/verify-otp", {
      headers: publicAuthHeaders(),
      body: {
        challengeId: issued.body.challengeId,
        code: "1234",
      },
    });
    assert.equal(verified.status, 200);
    assert.equal(typeof verified.body.sessionToken, "string");
    assert.equal(verified.body.role, "member");
    assert.equal(verified.body.requiresRegistration, undefined);
  });

  it("PUB-AUTH-04 new mobile verify-otp then register/complete returns session", async () => {
    const issued = await httpJson("POST", "/public/auth/request-otp", {
      headers: publicAuthHeaders(),
      body: { mobile: NEW_PUBLIC_MOBILE },
    });
    assert.equal(issued.status, 200);

    const verified = await httpJson("POST", "/public/auth/verify-otp", {
      headers: publicAuthHeaders(),
      body: {
        challengeId: issued.body.challengeId,
        code: "1234",
      },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.requiresRegistration, true);
    assert.equal(typeof verified.body.onboardingToken, "string");

    const completed = await httpJson("POST", "/public/auth/register/complete", {
      headers: publicAuthHeaders(),
      body: {
        onboardingToken: verified.body.onboardingToken,
        displayName: "New Guest",
        email: "guest@example.com",
      },
    });
    assert.equal(completed.status, 200);
    assert.equal(typeof completed.body.sessionToken, "string");
    assert.equal(completed.body.role, "member");
  });

  it("PUB-AUTH-06 global user without tenant membership requires profile after OTP", async () => {
    const repo = resetIdentityRepositoryForTests();
    const orphanUserId = "00000000-0000-4000-8000-000000000299";
    repo.seedUser({ id: orphanUserId, mobile: "+15550008888" });

    const issued = await httpJson("POST", "/public/auth/request-otp", {
      headers: publicAuthHeaders(),
      body: { mobile: "+15550008888" },
    });
    assert.equal(issued.status, 200);

    const verified = await httpJson("POST", "/public/auth/verify-otp", {
      headers: publicAuthHeaders(),
      body: { challengeId: issued.body.challengeId, code: "1234" },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.requiresRegistration, true);
    assert.equal(typeof verified.body.onboardingToken, "string");
  });

  it("PUB-AUTH-07 register/complete persists optional email on membership", async () => {
    const issued = await httpJson("POST", "/public/auth/request-otp", {
      headers: publicAuthHeaders(),
      body: { mobile: "+15550009903" },
    });
    const verified = await httpJson("POST", "/public/auth/verify-otp", {
      headers: publicAuthHeaders(),
      body: { challengeId: issued.body.challengeId, code: "1234" },
    });
    const completed = await httpJson("POST", "/public/auth/register/complete", {
      headers: publicAuthHeaders(),
      body: {
        onboardingToken: verified.body.onboardingToken,
        displayName: "Email Guest",
        email: "profile.guest@example.com",
      },
    });
    assert.equal(completed.status, 200);

    const repo = getIdentityRepository();
    const user = await repo.findUserByMobile("+15550009903");
    assert.notEqual(user, null);
    const membership = await repo.findMembership(user!.id, OPERATOR_SMOKE.tenantId);
    assert.notEqual(membership, null);
    assert.equal(membership?.email, "profile.guest@example.com");
  });

  it("PUB-AUTH-05 register/complete rejects missing displayName", async () => {
    const issued = await httpJson("POST", "/public/auth/request-otp", {
      headers: publicAuthHeaders(),
      body: { mobile: "+15550009902" },
    });
    const verified = await httpJson("POST", "/public/auth/verify-otp", {
      headers: publicAuthHeaders(),
      body: { challengeId: issued.body.challengeId, code: "1234" },
    });
    const completed = await httpJson("POST", "/public/auth/register/complete", {
      headers: publicAuthHeaders(),
      body: { onboardingToken: verified.body.onboardingToken, displayName: "" },
    });
    assert.equal(completed.status, 400);
    assert.equal(completed.body.code, "DISPLAY_NAME_REQUIRED");
  });
});

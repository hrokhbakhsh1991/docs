/**
 * Phase 9.1 — session hydrate + fail-closed
 * Authority: docs/phase-9/appendices/CASL-OPERATOR-SPEC.md
 */
import assert from "node:assert/strict";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { afterEach, before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { resetSessionTokenKeyCacheForTests } from "../src/identity/sign-session-token";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

function createSessionTestListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

describe("identity-session.spec.ts — Phase 9.1", () => {
  const client = installHttpTestClient(createSessionTestListener);

  before(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
    process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
    resetSessionTokenKeyCacheForTests();
    seedOperatorIdentityFixture();
  });

  beforeEach(() => {
    resetSessionTokenKeyCacheForTests();
    seedOperatorIdentityFixture();
  });

  afterEach(() => {
    resetSessionTokenKeyCacheForTests();
  });

  async function loginSessionToken(): Promise<string> {
    const issued = await client.requestJson<Record<string, unknown>>("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.ownerMobile },
    });
    const verified = await client.requestJson<Record<string, unknown>>("POST", "/auth/verify-otp", {
      headers: operatorAuthHeaders(),
      body: {
        challengeId: issued.body.challengeId,
        code: "1234",
      },
    });
    assert.equal(verified.status, 200);
    return verified.body.sessionToken as string;
  }

  it("ID-9.1-03 GET /auth/session valid cookie returns role from DB", async () => {
    const sessionToken = await loginSessionToken();
    const response = await client.requestJson<Record<string, unknown>>("GET", "/auth/session", {
      headers: {
        ...operatorAuthHeaders(),
        Authorization: `Bearer ${sessionToken}`,
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.role, "owner");
    assert.equal(response.body.userId, OPERATOR_SMOKE.ownerUserId);
  });

  it("ID-9.1-05 GET /auth/session Bearer-only (no x-* shim) returns 200 (R6 · SMK-P9-03)", async () => {
    const sessionToken = await loginSessionToken();
    const response = await client.requestJson<Record<string, unknown>>("GET", "/auth/session", {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.role, "owner");
    assert.equal(response.body.userId, OPERATOR_SMOKE.ownerUserId);
  });

  it("API-9.1-04 GET /tours without session returns 401 IDENTITY_REQUIRED", async () => {
    const response = await client.requestJson<Record<string, unknown>>("GET", "/tours");
    assert.equal(response.status, 401);
    assert.equal(response.body.code, "IDENTITY_REQUIRED");
  });
});

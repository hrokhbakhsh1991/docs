/**
 * Operator login — full HTTP integration chain
 * @see docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md §10 CP-9.1-06..07
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

function createLoginIntegrationListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

describe("identity-login-integration.spec.ts", () => {
  const client = installHttpTestClient(createLoginIntegrationListener);

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

  it("AUTH-E2E-01 request-otp → verify-otp → session → ability-context", async () => {
    const issued = await client.requestJson("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.ownerMobile },
    });
    assert.equal(issued.status, 200);
    assert.equal(typeof issued.body.challengeId, "string");

    const verified = await client.requestJson("POST", "/auth/verify-otp", {
      headers: operatorAuthHeaders(),
      body: {
        challengeId: issued.body.challengeId,
        code: "1234",
      },
    });
    assert.equal(verified.status, 200);
    assert.equal(typeof verified.body.sessionToken, "string");

    const session = await client.requestJson("GET", "/auth/session", {
      headers: {
        Authorization: `Bearer ${verified.body.sessionToken as string}`,
      },
    });
    assert.equal(session.status, 200);
    assert.equal(session.body.role, "owner");
    assert.equal(session.body.userId, OPERATOR_SMOKE.ownerUserId);

    const ability = await client.requestJson("GET", "/auth/ability-context", {
      headers: {
        Authorization: `Bearer ${verified.body.sessionToken as string}`,
      },
    });
    assert.equal(ability.status, 200);
    assert.equal(ability.body.role, "owner");
    assert.equal(
      (ability.body.capabilities as { canManageTenant?: boolean })?.canManageTenant,
      true
    );
  });

  it("AUTH-E2E-02 concurrent preflight keeps authorized/unauthorized isolated", async () => {
    const mobiles = [
      OPERATOR_SMOKE.ownerMobile,
      "+15559999999",
      OPERATOR_SMOKE.ownerMobile,
      "+15558888888",
    ] as const;

    const results = await Promise.all(
      mobiles.map((mobile) =>
        client.requestJson("POST", "/auth/phone-preflight", {
          headers: operatorAuthHeaders(),
          body: { mobile },
        })
      )
    );

    assert.deepEqual(
      results.map((row) => row.body.authorized),
      [true, false, true, false]
    );
    for (const row of results) {
      assert.equal(row.status, 200);
    }
  });

  it("AUTH-E2E-03 verify-otp rejects reused challenge after success", async () => {
    const issued = await client.requestJson("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.ownerMobile },
    });
    const challengeId = issued.body.challengeId as string;

    const first = await client.requestJson("POST", "/auth/verify-otp", {
      headers: operatorAuthHeaders(),
      body: { challengeId, code: "1234" },
    });
    assert.equal(first.status, 200);

    const second = await client.requestJson("POST", "/auth/verify-otp", {
      headers: operatorAuthHeaders(),
      body: { challengeId, code: "1234" },
    });
    assert.equal(second.status, 401);
    assert.ok(
      second.body.code === "OTP_INVALID" || second.body.code === "OTP_EXPIRED",
      `expected OTP_INVALID or OTP_EXPIRED, got ${String(second.body.code)}`
    );
  });
});

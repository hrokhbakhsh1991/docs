/**
 * Operator login — latency + heap stability probes
 * @see docs/dev/tiered-testing.md (fast-track; no full gate)
 */
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { afterEach, before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { resetOtpRateLimitForTests } from "../src/identity/otp-rate-limit";
import { resetSessionTokenKeyCacheForTests } from "../src/identity/sign-session-token";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { installHttpTestClient, type HttpTestClient } from "./http-test-client";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx] ?? 0;
}

function createLoginPerfListener() {
  return createRequestListener({ toursService: createTestToursService() });
}

async function fullLoginRoundTrip(client: HttpTestClient): Promise<void> {
  resetOtpRateLimitForTests();
  const issued = await client.requestJson("POST", "/auth/request-otp", {
    headers: operatorAuthHeaders(),
    body: { mobile: OPERATOR_SMOKE.ownerMobile },
  });
  assert.equal(issued.status, 200);
  const verified = await client.requestJson("POST", "/auth/verify-otp", {
    headers: operatorAuthHeaders(),
    body: {
      challengeId: issued.body.challengeId,
      code: "1234",
    },
  });
  assert.equal(verified.status, 200);
}

describe("identity-login-performance.spec.ts", () => {
  const client = installHttpTestClient(createLoginPerfListener);

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
    resetOtpRateLimitForTests();
    seedOperatorIdentityFixture();
  });

  afterEach(() => {
    resetSessionTokenKeyCacheForTests();
  });

  it("PERF-LOGIN-01 phone-preflight p95 stays under 120ms (100 samples)", async () => {
    const samples: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      const start = performance.now();
      const response = await client.requestJson("POST", "/auth/phone-preflight", {
        headers: operatorAuthHeaders(),
        body: { mobile: OPERATOR_SMOKE.ownerMobile },
      });
      samples.push(performance.now() - start);
      assert.equal(response.status, 200);
      assert.equal(response.body.authorized, true);
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = percentile(sorted, 95);
    console.info(`PERF-LOGIN-01 phone-preflight p95=${p95.toFixed(2)}ms`);
    assert.ok(p95 < 120, `phone-preflight p95 ${p95.toFixed(2)}ms exceeded 120ms budget`);
  });

  it("PERF-LOGIN-02 full login round-trip p95 stays under 600ms (24 samples)", async () => {
    const samples: number[] = [];
    for (let i = 0; i < 24; i += 1) {
      const start = performance.now();
      await fullLoginRoundTrip(client);
      samples.push(performance.now() - start);
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = percentile(sorted, 95);
    console.info(`PERF-LOGIN-02 login round-trip p95=${p95.toFixed(2)}ms`);
    assert.ok(p95 < 600, `login round-trip p95 ${p95.toFixed(2)}ms exceeded 600ms budget`);
  });

  it("PERF-LOGIN-03 repeated request-otp cycles do not grow heap beyond 12MB", async () => {
    if (global.gc) {
      global.gc();
    }
    const baseline = process.memoryUsage().heapUsed;

    for (let i = 0; i < 200; i += 1) {
      if (i % 8 === 0) {
        resetOtpRateLimitForTests();
      }
      const response = await client.requestJson("POST", "/auth/request-otp", {
        headers: operatorAuthHeaders(),
        body: { mobile: OPERATOR_SMOKE.ownerMobile },
      });
      assert.equal(response.status, 200);
    }

    if (global.gc) {
      global.gc();
    }
    const after = process.memoryUsage().heapUsed;
    const growthMb = (after - baseline) / (1024 * 1024);
    console.info(`PERF-LOGIN-03 heap growth=${growthMb.toFixed(2)}MB after 200 OTP requests`);
    assert.ok(
      growthMb < 12,
      `heap grew ${growthMb.toFixed(2)}MB after 200 request-otp cycles (budget 12MB)`
    );
  });
});

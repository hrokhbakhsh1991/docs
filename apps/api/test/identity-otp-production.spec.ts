/**
 * Phase 9.1 / 1C.2 — production OTP verify (hash-bound, no dev static bypass)
 * Authority: docs/phase-9/appendices/IDENTITY-PORT-SCOPE.md § OTP production path
 */
import assert from "node:assert/strict";
import http from "node:http";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { after, before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { resetSessionTokenKeyCacheForTests } from "../src/identity/sign-session-token";
import { resetOtpRateLimitForTests } from "../src/identity/otp-rate-limit";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const ENV_SNAPSHOT = {
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_PRIVATE_KEY: process.env.AUTH_JWT_PRIVATE_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  AUTH_ALLOW_DEV_STATIC_OTP: process.env.AUTH_ALLOW_DEV_STATIC_OTP,
  OTP_FIXTURE_CODE: process.env.OTP_FIXTURE_CODE,
};

installMemoryStorageDriverForDescribe();

async function httpJson(
  method: "GET" | "POST",
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

describe("identity-otp-production.spec.ts — 1C.2", () => {
  before(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
    process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "false";
    process.env.OTP_FIXTURE_CODE = "882211";
    resetSessionTokenKeyCacheForTests();
    seedOperatorIdentityFixture();
  });

  beforeEach(() => {
    resetOtpRateLimitForTests();
    resetSessionTokenKeyCacheForTests();
    seedOperatorIdentityFixture();
  });

  after(() => {
    process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
    process.env.AUTH_JWT_PRIVATE_KEY = ENV_SNAPSHOT.AUTH_JWT_PRIVATE_KEY;
    process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
    process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = ENV_SNAPSHOT.AUTH_ALLOW_DEV_STATIC_OTP;
    process.env.OTP_FIXTURE_CODE = ENV_SNAPSHOT.OTP_FIXTURE_CODE;
    resetOtpRateLimitForTests();
    resetSessionTokenKeyCacheForTests();
  });

  it("ID-1C.2-01 verify accepts OTP_FIXTURE_CODE when dev static bypass disabled", async () => {
    const issued = await httpJson("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.ownerMobile },
    });
    assert.equal(issued.status, 200);

    const verified = await httpJson("POST", "/auth/verify-otp", {
      headers: operatorAuthHeaders(),
      body: {
        challengeId: issued.body.challengeId,
        code: "882211",
      },
    });
    assert.equal(verified.status, 200);
    assert.equal(typeof verified.body.sessionToken, "string");
  });

  it("ID-1C.2-02 dev static 1234 rejected when AUTH_ALLOW_DEV_STATIC_OTP=false", async () => {
    const issued = await httpJson("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.ownerMobile },
    });
    assert.equal(issued.status, 200);

    const verified = await httpJson("POST", "/auth/verify-otp", {
      headers: operatorAuthHeaders(),
      body: {
        challengeId: issued.body.challengeId,
        code: "1234",
      },
    });
    assert.equal(verified.status, 401);
    assert.equal(verified.body.code, "OTP_INVALID");
  });

  it("ID-1C.2-03 request-otp rate limits after 10 attempts per mobile", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await httpJson("POST", "/auth/request-otp", {
        headers: operatorAuthHeaders(),
        body: { mobile: OPERATOR_SMOKE.ownerMobile },
      });
      assert.equal(response.status, 200);
    }
    const limited = await httpJson("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.ownerMobile },
    });
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, "OTP_RATE_LIMITED");
  });
});

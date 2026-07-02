/**
 * Identity mobile change — authenticated OTP flow
 * @see docs/workspaces/denali/portal-member-profile.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { after, before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import {
  getIdentityRepository,
  resetIdentityRepositoryForTests,
} from "../src/identity/create-identity-repository";
import { resetSessionTokenKeyCacheForTests } from "../src/identity/sign-session-token";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

const ORIGINAL_MOBILE = "+15550008801";
const NEW_MOBILE = "+15550008802";

const ENV_SNAPSHOT = {
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_PRIVATE_KEY: process.env.AUTH_JWT_PRIVATE_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  AUTH_ALLOW_DEV_STATIC_OTP: process.env.AUTH_ALLOW_DEV_STATIC_OTP,
};

installMemoryStorageDriverForDescribe();

function memberAuthHeaders(userId: string): Record<string, string> {
  return {
    "x-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-authenticated-tenant-id": OPERATOR_SMOKE.tenantId,
    "x-user-id": userId,
    "x-actor-role": "member",
    "x-membership-status": "ACTIVE",
    "x-workspace-id": "ws-public-dev",
  };
}

async function httpJson(
  method: "POST" | "GET" | "PATCH",
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
      if (payload !== undefined) {
        req.write(payload);
      }
      req.end();
    });
  });
}

describe("identity-me-mobile-change.spec.ts", () => {
  let memberUserId = "";

  before(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
    process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
    process.env.AUTH_JWT_ISSUER = "test-issuer";
    process.env.AUTH_JWT_AUDIENCE = "test-audience";
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = "true";
    resetSessionTokenKeyCacheForTests();
  });

  after(() => {
    process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
    process.env.AUTH_JWT_PRIVATE_KEY = ENV_SNAPSHOT.AUTH_JWT_PRIVATE_KEY;
    process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
    process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
    process.env.AUTH_ALLOW_DEV_STATIC_OTP = ENV_SNAPSHOT.AUTH_ALLOW_DEV_STATIC_OTP;
    resetSessionTokenKeyCacheForTests();
  });

  beforeEach(async () => {
    resetIdentityRepositoryForTests();
    const repo = getIdentityRepository();
    const { user } = await repo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: ORIGINAL_MOBILE,
      displayName: "Mobile Change Member",
    });
    memberUserId = user.id;
  });

  it("API-ME-MOB-01 request-otp requires session", async () => {
    const response = await httpJson("POST", "/identity/me/mobile/request-otp", {
      body: { mobile: NEW_MOBILE },
    });
    assert.equal(response.status, 401);
  });

  it("API-ME-MOB-02 request-otp rejects unchanged mobile", async () => {
    const response = await httpJson("POST", "/identity/me/mobile/request-otp", {
      headers: memberAuthHeaders(memberUserId),
      body: { mobile: ORIGINAL_MOBILE },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "MOBILE_UNCHANGED");
  });

  it("API-ME-MOB-03 verify commits new mobile and returns sessionToken", async () => {
    const request = await httpJson("POST", "/identity/me/mobile/request-otp", {
      headers: memberAuthHeaders(memberUserId),
      body: { mobile: NEW_MOBILE },
    });
    assert.equal(request.status, 200);
    const challengeId = request.body.challengeId;
    assert.equal(typeof challengeId, "string");

    const verify = await httpJson("POST", "/identity/me/mobile/verify", {
      headers: memberAuthHeaders(memberUserId),
      body: { mobile: NEW_MOBILE, challengeId, code: "1234" },
    });
    assert.equal(verify.status, 200);
    assert.equal(typeof verify.body.sessionToken, "string");
    const profile = verify.body.profile as { mobile?: string };
    assert.equal(profile.mobile, NEW_MOBILE);

    const reread = await httpJson("GET", "/identity/me", {
      headers: memberAuthHeaders(memberUserId),
    });
    assert.equal(reread.status, 200);
    assert.equal(reread.body.mobile, NEW_MOBILE);
  });

  it("API-ME-MOB-04 rejects mobile already registered to another user", async () => {
    const repo = getIdentityRepository();
    await repo.registerPublicGuest({
      tenantId: OPERATOR_SMOKE.tenantId,
      mobile: NEW_MOBILE,
      displayName: "Other Member",
    });

    const response = await httpJson("POST", "/identity/me/mobile/request-otp", {
      headers: memberAuthHeaders(memberUserId),
      body: { mobile: NEW_MOBILE },
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "MOBILE_ALREADY_REGISTERED");
  });
});

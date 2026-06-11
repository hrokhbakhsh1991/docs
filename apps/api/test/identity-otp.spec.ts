/**
 * Phase 9.1 — OTP request/verify
 * Authority: docs/phase-9/appendices/AGENT-STATE-MAP-9.1.yaml · IDENTITY-PORT-SCOPE.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";
import { afterEach, before, beforeEach, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { resetSessionTokenKeyCacheForTests } from "../src/identity/sign-session-token";
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

describe("identity-otp.spec.ts — Phase 9.1", () => {
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

  it("ID-9.1-01 POST /auth/request-otp valid mobile returns 200 + challengeId", async () => {
    const response = await httpJson("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.ownerMobile },
    });
    assert.equal(response.status, 200);
    assert.equal(typeof response.body.challengeId, "string");
    assert.ok((response.body.challengeId as string).length > 0);
  });

  it("ID-9.1-03 invitee verify-otp with pending invite returns session (R6 · SMK-P9-03)", async () => {
    const listener = createRequestListener({ toursService: createTestToursService() });
    const invite = await new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
      const server = http.createServer(listener);
      server.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          server.close();
          reject(new Error("no listen address"));
          return;
        }
        const payload = JSON.stringify({ phone: OPERATOR_SMOKE.inviteMobile, role: "member" });
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port: addr.port,
            path: "/users/invite",
            method: "POST",
            headers: {
              ...operatorAuthHeaders(),
              "Content-Type": "application/json",
              "Content-Length": String(Buffer.byteLength(payload)),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk) => chunks.push(chunk as Buffer));
            res.on("end", () => {
              server.close();
              resolve({
                status: res.statusCode ?? 0,
                body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>,
              });
            });
          }
        );
        req.on("error", reject);
        req.write(payload);
        req.end();
      });
    });
    assert.equal(invite.status, 201);

    const issued = await httpJson("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.inviteMobile },
    });
    const verified = await httpJson("POST", "/auth/verify-otp", {
      headers: operatorAuthHeaders(),
      body: {
        challengeId: issued.body.challengeId,
        code: "1234",
      },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.pendingInvite, true);
    assert.equal(typeof verified.body.sessionToken, "string");

    const ability = await httpJson("GET", "/auth/ability-context", {
      headers: {
        Authorization: `Bearer ${verified.body.sessionToken as string}`,
      },
    });
    assert.equal(ability.status, 200);
    assert.equal(ability.body.role, "member");
    assert.equal(
      (ability.body.capabilities as { canManageTenant?: boolean })?.canManageTenant,
      false
    );
  });

  it("ID-9.1-02 POST /auth/verify-otp wrong code returns 401 OTP_INVALID", async () => {
    const issued = await httpJson("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.ownerMobile },
    });
    const response = await httpJson("POST", "/auth/verify-otp", {
      headers: operatorAuthHeaders(),
      body: {
        challengeId: issued.body.challengeId,
        code: "0000",
      },
    });
    assert.equal(response.status, 401);
    assert.equal(response.body.code, "OTP_INVALID");
  });
});

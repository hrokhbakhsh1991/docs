/**
 * Operator login preflight + gated request-otp
 * @see docs/phase-9/appendices/OPERATOR-LOGIN-FLOW.md
 */
import assert from "node:assert/strict";
import http from "node:http";
import { before, describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { getIdentityRepository } from "../src/identity/create-identity-repository";
import { resetOtpRateLimitForTests } from "../src/identity/otp-rate-limit";
import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import {
  operatorAuthHeaders,
  seedOperatorIdentityFixture,
} from "./fixtures/operator-identity-fixture";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

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

describe("identity-login-preflight.spec.ts", () => {
  before(() => {
    seedOperatorIdentityFixture();
  });

  it("AUTH-PF-01 phone-preflight owner mobile authorized", async () => {
    const response = await httpJson("POST", "/auth/phone-preflight", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.ownerMobile },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.authorized, true);
  });

  it("AUTH-PF-02 phone-preflight unknown mobile not authorized", async () => {
    const response = await httpJson("POST", "/auth/phone-preflight", {
      headers: operatorAuthHeaders(),
      body: { mobile: "+15559999999" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.authorized, false);
  });

  it("AUTH-PF-03 request-otp rejects unauthorized mobile before challenge", async () => {
    const response = await httpJson("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: "+15559999999" },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.code, "AUTH_PHONE_NOT_AUTHORIZED");
  });

  it("AUTH-PF-04 request-otp owner still receives challenge", async () => {
    const response = await httpJson("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.ownerMobile },
    });
    assert.equal(response.status, 200);
    assert.equal(typeof response.body.challengeId, "string");
  });

  it("AUTH-PF-05 pending invite mobile passes preflight and request-otp gate", async () => {
    const repo = getIdentityRepository() as {
      seedPendingInvite(record: {
        inviteId: string;
        inviteToken: string;
        tenantId: string;
        phone: string;
        role: "member";
        status: "INVITED";
        invitedByUserId: string;
      }): void;
    };
    repo.seedPendingInvite({
      inviteId: "00000000-0000-4000-8000-000000000501",
      inviteToken: "00000000-0000-4000-8000-000000000502",
      tenantId: OPERATOR_SMOKE.tenantId,
      phone: OPERATOR_SMOKE.inviteMobile,
      role: "member",
      status: "INVITED",
      invitedByUserId: OPERATOR_SMOKE.ownerUserId,
    });

    const preflight = await httpJson("POST", "/auth/phone-preflight", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.inviteMobile },
    });
    assert.equal(preflight.status, 200);
    assert.equal(preflight.body.authorized, true);

    const otp = await httpJson("POST", "/auth/request-otp", {
      headers: operatorAuthHeaders(),
      body: { mobile: OPERATOR_SMOKE.inviteMobile },
    });
    assert.equal(otp.status, 200);
    assert.equal(typeof otp.body.challengeId, "string");
  });

  it("AUTH-PF-06 request-otp rate limit returns OTP_RATE_LIMITED", async () => {
    resetOtpRateLimitForTests();
    let lastStatus = 0;
    let lastCode = "";
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await httpJson("POST", "/auth/request-otp", {
        headers: operatorAuthHeaders(),
        body: { mobile: OPERATOR_SMOKE.ownerMobile },
      });
      lastStatus = response.status;
      lastCode = typeof response.body.code === "string" ? response.body.code : "";
      if (lastStatus === 429) {
        break;
      }
    }
    assert.equal(lastStatus, 429);
    assert.equal(lastCode, "OTP_RATE_LIMITED");
  });
});

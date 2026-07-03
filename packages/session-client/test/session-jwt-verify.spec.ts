import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateSessionToken,
  validateSessionTokenAsync,
  verifySessionJwtSignature,
} from "../src/index";

describe("session-client JWT verify — PCMS-SEC-02", () => {
  const ENV_SNAPSHOT = {
    AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
    AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
    AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  };

  const restoreEnv = (): void => {
    for (const [key, value] of Object.entries(ENV_SNAPSHOT)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };

  it("PCMS-SEC-02a verifySessionJwtSignature skips when AUTH_JWT_PUBLIC_KEY unset", async () => {
    delete process.env.AUTH_JWT_PUBLIC_KEY;
    delete process.env.AUTH_JWT_ISSUER;
    delete process.env.AUTH_JWT_AUDIENCE;
    assert.equal(await verifySessionJwtSignature("hdr.payload.sig"), true);
    restoreEnv();
  });

  it("PCMS-SEC-02b validateSessionTokenAsync rejects tampered signature when configured", async () => {
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    process.env.AUTH_JWT_PUBLIC_KEY =
      ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY ??
      "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo\n4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrR0nYlWjA6B9W4WiK3Kq3T9\n1QIDAQAB\n-----END PUBLIC KEY-----";

    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "00000000-0000-4000-8000-000000000101",
        tenant_id: "00000000-0000-4000-8000-000000000014",
        role: "member",
        iss: "tour-ops",
        aud: "tour-ops-api",
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    const token = `${header}.${payload}.bad-signature`;

    assert.equal(validateSessionToken(token).status, "valid");
    const asyncResult = await validateSessionTokenAsync(token);
    assert.equal(asyncResult.status, "invalid_signature");
    restoreEnv();
  });
});

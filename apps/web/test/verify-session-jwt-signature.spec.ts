import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("verify-session-jwt-signature.spec.ts", () => {
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

  it("WEB-AUTH-01 skips verification when AUTH_JWT_PUBLIC_KEY is unset", async () => {
    delete process.env.AUTH_JWT_PUBLIC_KEY;
    delete process.env.AUTH_JWT_ISSUER;
    delete process.env.AUTH_JWT_AUDIENCE;
    const { verifySessionJwtSignature } = await import("../src/auth/verify-session-jwt-signature");
    assert.equal(await verifySessionJwtSignature("header.payload.sig"), true);
    restoreEnv();
  });

  it("WEB-AUTH-02 rejects tampered JWT when verify config is set", async () => {
    process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
    process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER ?? "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE ?? "tour-ops-api";
    const { verifySessionJwtSignature } = await import("../src/auth/verify-session-jwt-signature");
    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "00000000-0000-4000-8000-000000000101",
        tenant_id: "00000000-0000-4000-8000-000000000003",
        role: "owner",
        iss: "tour-ops",
        aud: "tour-ops-api",
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    ).toString("base64url");
    assert.equal(await verifySessionJwtSignature(`${header}.${payload}.bad-signature`), false);
    restoreEnv();
  });
});

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { exportPKCS8, exportSPKI, generateKeyPair, importSPKI, jwtVerify } from "jose";

import {
  resetPlatformImpersonationSessionTokenKeyCacheForTests,
  signPlatformImpersonationSessionToken,
} from "../src/platform/sign-platform-impersonation-session-token.ts";

const ENV_SNAPSHOT = {
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_PRIVATE_KEY: process.env.AUTH_JWT_PRIVATE_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
};

describe("signPlatformImpersonationSessionToken", () => {
  before(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
    process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    resetPlatformImpersonationSessionTokenKeyCacheForTests();
  });

  after(() => {
    process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
    process.env.AUTH_JWT_PRIVATE_KEY = ENV_SNAPSHOT.AUTH_JWT_PRIVATE_KEY;
    process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
    process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
    resetPlatformImpersonationSessionTokenKeyCacheForTests();
  });

  it("sets platform_impersonation_readonly and 30m expiry", async () => {
    const token = await signPlatformImpersonationSessionToken({
      userId: "00000000-0000-4000-8000-000000000101",
      tenantId: "00000000-0000-4000-8000-000000000014",
      sessionVersion: 2,
      platformImpersonator: "+989121234567",
    });

    const publicKey = process.env.AUTH_JWT_PUBLIC_KEY;
    assert.ok(publicKey);
    const verifyKey = await importSPKI(publicKey, "RS256");
    const verified = await jwtVerify(token, verifyKey, {
      issuer: "tour-ops",
      audience: "tour-ops-api",
    });

    assert.equal(verified.payload.platform_impersonation_readonly, true);
    const iat = typeof verified.payload.iat === "number" ? verified.payload.iat : 0;
    const exp = typeof verified.payload.exp === "number" ? verified.payload.exp : 0;
    assert.ok(exp - iat <= 1800 + 10);
  });
});

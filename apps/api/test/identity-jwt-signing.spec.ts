/**
 * Phase 9.1 / 1C.1 — RS256 session JWT sign + verify round-trip
 * Authority: docs/phase-9/appendices/IDENTITY-PORT-SCOPE.md § Dev JWT bootstrap
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { exportPKCS8, exportSPKI, generateKeyPair, importSPKI, jwtVerify } from "jose";

import {
  resetSessionTokenKeyCacheForTests,
  signSessionToken,
} from "../src/identity/sign-session-token";

const ENV_SNAPSHOT = {
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_PRIVATE_KEY: process.env.AUTH_JWT_PRIVATE_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
};

describe("identity-jwt-signing.spec.ts — 1C.1 RS256", () => {
  before(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
    process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    resetSessionTokenKeyCacheForTests();
  });

  after(() => {
    process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
    process.env.AUTH_JWT_PRIVATE_KEY = ENV_SNAPSHOT.AUTH_JWT_PRIVATE_KEY;
    process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
    process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
    resetSessionTokenKeyCacheForTests();
  });

  it("signSessionToken emits JWT verifiable with AUTH_JWT_PUBLIC_KEY", async () => {
    const token = await signSessionToken({
      userId: "00000000-0000-4000-8000-000000000101",
      tenantId: "00000000-0000-4000-8000-000000000014",
      role: "owner",
      sessionVersion: 1,
    });
    assert.match(token, /^eyJ/);

    const publicKey = process.env.AUTH_JWT_PUBLIC_KEY;
    assert.ok(publicKey);
    const verifyKey = await importSPKI(publicKey, "RS256");
    const verified = await jwtVerify(token, verifyKey, {
      issuer: "tour-ops",
      audience: "tour-ops-api",
    });
    assert.equal(verified.payload.sub, "00000000-0000-4000-8000-000000000101");
    assert.equal(verified.payload.tenant_id, "00000000-0000-4000-8000-000000000014");
    assert.equal(verified.payload.sess_ver, "1");
  });

  it("signSessionToken accepts AUTH_JWT_PRIVATE_KEY with literal \\n (bootstrap:dev-jwt env line)", async () => {
    const privatePem = process.env.AUTH_JWT_PRIVATE_KEY;
    assert.ok(privatePem);
    process.env.AUTH_JWT_PRIVATE_KEY = privatePem.replace(/\n/g, "\\n");
    resetSessionTokenKeyCacheForTests();

    const token = await signSessionToken({
      userId: "00000000-0000-4000-8000-000000000101",
      tenantId: "00000000-0000-4000-8000-000000000003",
      role: "owner",
      sessionVersion: 1,
    });
    assert.match(token, /^eyJ/);
  });
});

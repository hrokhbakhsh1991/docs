import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { exportPKCS8, exportSPKI, generateKeyPair } from "jose";

import { PlatformValidation } from "../src/platform/platform.errors.ts";
import { PlatformTenantRepository } from "../src/platform/platform-tenant.repository.ts";
import { startPlatformImpersonation } from "../src/platform/start-platform-impersonation.ts";
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

describe("startPlatformImpersonation", () => {
  let originalGetById: PlatformTenantRepository["getById"];

  before(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    process.env.AUTH_JWT_PUBLIC_KEY = await exportSPKI(pair.publicKey);
    process.env.AUTH_JWT_PRIVATE_KEY = await exportPKCS8(pair.privateKey);
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    resetPlatformImpersonationSessionTokenKeyCacheForTests();
    originalGetById = PlatformTenantRepository.prototype.getById;
  });

  after(() => {
    PlatformTenantRepository.prototype.getById = originalGetById;
    process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
    process.env.AUTH_JWT_PRIVATE_KEY = ENV_SNAPSHOT.AUTH_JWT_PRIVATE_KEY;
    process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
    process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
    resetPlatformImpersonationSessionTokenKeyCacheForTests();
  });

  it("throws PlatformValidation when tenant is missing", async () => {
    PlatformTenantRepository.prototype.getById = async () => null;
    await assert.rejects(
      () =>
        startPlatformImpersonation({
          tenantId: "00000000-0000-4000-8000-000000000014",
          actorId: "+989121234567",
        }),
      PlatformValidation
    );
  });

  it("returns sessionToken, exchangePath, and expiresAt fields", async () => {
    const sessionToken = await signPlatformImpersonationSessionToken({
      userId: "00000000-0000-4000-8000-000000000101",
      tenantId: "00000000-0000-4000-8000-000000000014",
      sessionVersion: 1,
      platformImpersonator: "+989121234567",
    });
    const result = {
      sessionToken,
      exchangePath: "/auth/platform-impersonate",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    assert.ok(typeof result.sessionToken === "string");
    assert.equal(result.exchangePath, "/auth/platform-impersonate");
    assert.ok(typeof result.expiresAt === "string");
  });
});

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH_ALLOW_DEV_BEARER: process.env.AUTH_ALLOW_DEV_BEARER,
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
};

afterEach(() => {
  process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
  process.env.AUTH_ALLOW_DEV_BEARER = ENV_SNAPSHOT.AUTH_ALLOW_DEV_BEARER;
  process.env.AUTH_JWT_PUBLIC_KEY = ENV_SNAPSHOT.AUTH_JWT_PUBLIC_KEY;
  process.env.AUTH_JWT_ISSUER = ENV_SNAPSHOT.AUTH_JWT_ISSUER;
  process.env.AUTH_JWT_AUDIENCE = ENV_SNAPSHOT.AUTH_JWT_AUDIENCE;
});

describe("auth environment integrity (P0-03)", () => {
  it("rejects AUTH_ALLOW_DEV_BEARER outside NODE_ENV=test", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    const { assertAuthEnvironmentIntegrity } = await import("./auth-env.js");
    assert.throws(() => assertAuthEnvironmentIntegrity(), /AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST/);
  });

  it("allows dev bearer only when NODE_ENV=test and flag true", async () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    const { isDevBearerAllowed } = await import("./auth-env.js");
    assert.equal(isDevBearerAllowed(), true);
  });

  it("disallows dev bearer in development even when flag is true", async () => {
    process.env.NODE_ENV = "development";
    process.env.AUTH_ALLOW_DEV_BEARER = "true";
    const mod = await import("./auth-env.js");
    assert.throws(() => mod.isDevBearerAllowed(), /AUTH_DEV_BEARER_FORBIDDEN_OUTSIDE_TEST/);
  });

  it("requires AUTH_JWT_* in production (DEC-023)", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_ALLOW_DEV_BEARER;
    delete process.env.AUTH_JWT_PUBLIC_KEY;
    delete process.env.AUTH_JWT_ISSUER;
    delete process.env.AUTH_JWT_AUDIENCE;
    const { assertAuthEnvironmentIntegrity } = await import("./auth-env.js");
    assert.throws(() => assertAuthEnvironmentIntegrity(), /AUTH_JWT_REQUIRED_IN_PRODUCTION/);
  });

  it("allows production boot when JWT verify env is set", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_JWT_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----";
    process.env.AUTH_JWT_ISSUER = "tour-ops";
    process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
    delete process.env.OTP_FIXTURE_CODE;
    delete process.env.AUTH_ALLOW_DEV_STATIC_OTP;
    const { assertAuthEnvironmentIntegrity } = await import("./auth-env.js");
    assert.doesNotThrow(() => assertAuthEnvironmentIntegrity());
  });
});

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH_ALLOW_DEV_BEARER: process.env.AUTH_ALLOW_DEV_BEARER,
};

afterEach(() => {
  process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
  process.env.AUTH_ALLOW_DEV_BEARER = ENV_SNAPSHOT.AUTH_ALLOW_DEV_BEARER;
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
});

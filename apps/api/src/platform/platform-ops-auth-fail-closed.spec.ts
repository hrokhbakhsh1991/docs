import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  PLATFORM_OPS_BEARER_TOKEN_REQUIRED,
  readPlatformOpsBearerToken,
} from "./read-platform-ops-bearer-token.ts";
import { resolvePlatformOpsPhoneAccess } from "./resolve-platform-ops-phone-access.ts";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  PLATFORM_OPS_BEARER_TOKEN: process.env.PLATFORM_OPS_BEARER_TOKEN,
  PLATFORM_OPS_PHONES: process.env.PLATFORM_OPS_PHONES,
  APP_RUNTIME_PROFILE: process.env.APP_RUNTIME_PROFILE,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ENV_SNAPSHOT)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("TODO-004 platform ops auth fail-closed", () => {
  it("production without PLATFORM_OPS_BEARER_TOKEN throws", () => {
    process.env.NODE_ENV = "production";
    delete process.env.PLATFORM_OPS_BEARER_TOKEN;
    assert.throws(() => readPlatformOpsBearerToken(), (err: Error) => {
      assert.equal(err.message, PLATFORM_OPS_BEARER_TOKEN_REQUIRED);
      return true;
    });
  });

  it("test may use default bearer when unset", () => {
    process.env.NODE_ENV = "test";
    delete process.env.PLATFORM_OPS_BEARER_TOKEN;
    assert.equal(readPlatformOpsBearerToken(), "platform-ops");
  });

  it("production empty PLATFORM_OPS_PHONES denies any phone", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.PLATFORM_OPS_PHONES;
    const access = await resolvePlatformOpsPhoneAccess("+15551234567", {
      repository: {
        findByPhone: async () => null,
      } as never,
    });
    assert.equal(access, null);
  });

  it("prodlike empty whitelist denies", async () => {
    process.env.NODE_ENV = "development";
    process.env.APP_RUNTIME_PROFILE = "prodlike";
    delete process.env.PLATFORM_OPS_PHONES;
    const access = await resolvePlatformOpsPhoneAccess("+15551234567", {
      repository: {
        findByPhone: async () => null,
      } as never,
    });
    assert.equal(access, null);
  });
});

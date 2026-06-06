import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  PRODLIKE_DATABASE_URL_REQUIRED_FOR_REGISTRY,
  assertStaticTenantRegistryRuntime,
  isStaticTenantRegistryAllowed,
} from "./tenant-registry";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
};

afterEach(() => {
  process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
  process.env.DATABASE_URL = ENV_SNAPSHOT.DATABASE_URL;
});

describe("tenant-registry static gate (DI-REG-01 / DEC-039)", () => {
  it("isStaticTenantRegistryAllowed is true only in test or dev without DATABASE_URL", () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    assert.equal(isStaticTenantRegistryAllowed(), true);

    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    assert.equal(isStaticTenantRegistryAllowed(), true);

    process.env.DATABASE_URL = "postgresql://app/db";
    assert.equal(isStaticTenantRegistryAllowed(), false);

    process.env.NODE_ENV = "production";
    assert.equal(isStaticTenantRegistryAllowed(), false);
  });

  it("assertStaticTenantRegistryRuntime rejects prod-like env without DATABASE_URL", () => {
    process.env.NODE_ENV = "staging";
    delete process.env.DATABASE_URL;
    assert.throws(
      () => assertStaticTenantRegistryRuntime(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODLIKE_DATABASE_URL_REQUIRED_FOR_REGISTRY);
        return true;
      }
    );
  });

  it("assertStaticTenantRegistryRuntime allows test without DATABASE_URL", () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    assert.doesNotThrow(() => assertStaticTenantRegistryRuntime());
  });
});

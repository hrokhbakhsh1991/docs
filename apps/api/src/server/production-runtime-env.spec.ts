import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_ADMIN: process.env.DATABASE_URL_ADMIN,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
};

afterEach(() => {
  process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
  process.env.DATABASE_URL = ENV_SNAPSHOT.DATABASE_URL;
  process.env.DATABASE_URL_ADMIN = ENV_SNAPSHOT.DATABASE_URL_ADMIN;
  process.env.STORAGE_DRIVER = ENV_SNAPSHOT.STORAGE_DRIVER;
});

describe("assertProductionRuntimeIntegrity (DEC-GAP-03)", () => {
  it("no-op outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_ADMIN;
    const { assertProductionRuntimeIntegrity } = await import("./production-runtime-env.js");
    assert.doesNotThrow(() => assertProductionRuntimeIntegrity());
  });

  it("requires DATABASE_URL in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    process.env.DATABASE_URL_ADMIN = "postgresql://admin/db";
    process.env.STORAGE_DRIVER = "prisma";
    const { assertProductionRuntimeIntegrity, PRODUCTION_DATABASE_URL_REQUIRED } =
      await import("./production-runtime-env.js");
    assert.throws(
      () => assertProductionRuntimeIntegrity(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODUCTION_DATABASE_URL_REQUIRED);
        return true;
      }
    );
  });

  it("requires distinct DATABASE_URL_ADMIN in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://app/db";
    delete process.env.DATABASE_URL_ADMIN;
    process.env.STORAGE_DRIVER = "prisma";
    const { assertProductionRuntimeIntegrity, PRODUCTION_DATABASE_URL_ADMIN_REQUIRED } =
      await import("./production-runtime-env.js");
    assert.throws(
      () => assertProductionRuntimeIntegrity(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODUCTION_DATABASE_URL_ADMIN_REQUIRED);
        return true;
      }
    );
  });

  it("rejects equal app and admin URLs in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://same/db";
    process.env.DATABASE_URL_ADMIN = "postgresql://same/db";
    process.env.STORAGE_DRIVER = "prisma";
    const { assertProductionRuntimeIntegrity, PRODUCTION_DATABASE_URL_ADMIN_MUST_DIFFER } =
      await import("./production-runtime-env.js");
    assert.throws(
      () => assertProductionRuntimeIntegrity(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODUCTION_DATABASE_URL_ADMIN_MUST_DIFFER);
        return true;
      }
    );
  });

  it("forbids memory storage driver in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://app/db";
    process.env.DATABASE_URL_ADMIN = "postgresql://admin/db";
    process.env.STORAGE_DRIVER = "memory";
    const { assertProductionRuntimeIntegrity, PRODUCTION_STORAGE_DRIVER_FORBIDDEN } =
      await import("./production-runtime-env.js");
    assert.throws(
      () => assertProductionRuntimeIntegrity(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODUCTION_STORAGE_DRIVER_FORBIDDEN);
        return true;
      }
    );
  });

  it("passes when production env is correctly configured", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://app/db";
    process.env.DATABASE_URL_ADMIN = "postgresql://admin/db";
    process.env.STORAGE_DRIVER = "prisma";
    const { assertProductionRuntimeIntegrity } = await import("./production-runtime-env.js");
    assert.doesNotThrow(() => assertProductionRuntimeIntegrity());
  });

  it("rejects prod-like NODE_ENV without DATABASE_URL for static registry policy", async () => {
    process.env.NODE_ENV = "staging";
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_URL_ADMIN;
    const { assertProductionRuntimeIntegrity } = await import("./production-runtime-env.js");
    const { PRODLIKE_DATABASE_URL_REQUIRED_FOR_REGISTRY } =
      await import("../tenant/tenant-registry.js");
    assert.throws(
      () => assertProductionRuntimeIntegrity(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODLIKE_DATABASE_URL_REQUIRED_FOR_REGISTRY);
        return true;
      }
    );
  });
});

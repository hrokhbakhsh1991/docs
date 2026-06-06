import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
};

afterEach(() => {
  process.env.NODE_ENV = ENV_SNAPSHOT.NODE_ENV;
  process.env.DATABASE_URL = ENV_SNAPSHOT.DATABASE_URL;
  process.env.STORAGE_DRIVER = ENV_SNAPSHOT.STORAGE_DRIVER;
});

describe("forensic storage driver (AUDIT-GAP-01 / DEC-045)", () => {
  it("memory driver is non-forensic", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    process.env.STORAGE_DRIVER = "memory";

    const { isForensicStorageDriver, useAtomicCanonicalPersist } =
      await import("./create-tour-storage.js");

    assert.equal(isForensicStorageDriver(), false);
    assert.equal(useAtomicCanonicalPersist(), false);
  });

  it("prisma driver with DATABASE_URL is forensic", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://app/db";
    process.env.STORAGE_DRIVER = "prisma";

    const { isForensicStorageDriver, useAtomicCanonicalPersist } =
      await import("./create-tour-storage.js");

    assert.equal(isForensicStorageDriver(), true);
    assert.equal(useAtomicCanonicalPersist(), true);
  });

  it("production boot rejects memory before any tour write", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://app/db";
    process.env.DATABASE_URL_ADMIN = "postgresql://admin/db";
    process.env.STORAGE_DRIVER = "memory";

    const { assertProductionRuntimeIntegrity, PRODUCTION_STORAGE_DRIVER_FORBIDDEN } =
      await import("../server/production-runtime-env.js");

    assert.throws(
      () => assertProductionRuntimeIntegrity(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODUCTION_STORAGE_DRIVER_FORBIDDEN);
        return true;
      }
    );
  });
});

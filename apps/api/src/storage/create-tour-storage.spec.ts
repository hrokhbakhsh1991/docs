import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { InMemoryTourRepository } from "./in-memory-tour.repository";
import { PrismaTourRepository } from "./prisma-tour.repository";

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

describe("createTourStorageRepository (DM-CT-01 / DI-MEM-01)", () => {
  it("returns in-memory repository outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    process.env.STORAGE_DRIVER = "memory";

    const { createTourStorageRepository } = await import("./create-tour-storage.js");
    const repo = createTourStorageRepository();
    assert.ok(repo instanceof InMemoryTourRepository);
  });

  it("factory forbids memory driver in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://app/db";
    process.env.STORAGE_DRIVER = "memory";

    const {
      assertProductionStorageDriver,
      createTourStorageRepository,
      PRODUCTION_STORAGE_DRIVER_FORBIDDEN,
    } = await import("./create-tour-storage.js");

    assert.throws(
      () => assertProductionStorageDriver(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODUCTION_STORAGE_DRIVER_FORBIDDEN);
        return true;
      }
    );
    assert.throws(
      () => createTourStorageRepository(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODUCTION_STORAGE_DRIVER_FORBIDDEN);
        return true;
      }
    );
  });

  it("factory requires DATABASE_URL in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    process.env.STORAGE_DRIVER = "prisma";

    const { createTourStorageRepository, PRODUCTION_DATABASE_URL_REQUIRED } =
      await import("./create-tour-storage.js");

    assert.throws(
      () => createTourStorageRepository(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODUCTION_DATABASE_URL_REQUIRED);
        return true;
      }
    );
  });

  it("returns prisma repository when production storage is configured", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://app/db";
    process.env.STORAGE_DRIVER = "prisma";

    const { createTourStorageRepository } = await import("./create-tour-storage.js");
    const repo = createTourStorageRepository();
    assert.ok(repo instanceof PrismaTourRepository);
  });
});

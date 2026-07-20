import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { InMemoryTourRepository } from "./in-memory-tour.repository";
import { PrismaTourRepository } from "./prisma-tour.repository";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
};

function restoreEnvKey(key: keyof typeof ENV_SNAPSHOT): void {
  const value = ENV_SNAPSHOT[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

afterEach(() => {
  for (const key of Object.keys(ENV_SNAPSHOT) as (keyof typeof ENV_SNAPSHOT)[]) {
    restoreEnvKey(key);
  }
});

describe("createTourStorageRepository (DM-CT-01 / DI-MEM-01 / TODO-009)", () => {
  it("returns in-memory repository outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    process.env.STORAGE_DRIVER = "memory";

    const { createTourStorageRepository } = await import("./create-tour-storage.js");
    const repo = createTourStorageRepository();
    assert.ok(repo instanceof InMemoryTourRepository);
  });

  it("TODO-009: DATABASE_URL set + STORAGE_DRIVER unset → prisma", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://app/db";
    delete process.env.STORAGE_DRIVER;

    const { resolveStorageDriver, createTourStorageRepository } =
      await import("./create-tour-storage.js");
    assert.equal(resolveStorageDriver(), "prisma");
    assert.ok(createTourStorageRepository() instanceof PrismaTourRepository);
  });

  it("TODO-009: explicit STORAGE_DRIVER=memory wins over DATABASE_URL", async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://app/db";
    process.env.STORAGE_DRIVER = "memory";

    const { resolveStorageDriver, createTourStorageRepository } =
      await import("./create-tour-storage.js");
    assert.equal(resolveStorageDriver(), "memory");
    assert.ok(createTourStorageRepository() instanceof InMemoryTourRepository);
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

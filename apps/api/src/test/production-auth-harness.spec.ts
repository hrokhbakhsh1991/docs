import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

const ENV_SNAPSHOT = {
  NODE_ENV: process.env.NODE_ENV,
  APPS_API_PRODUCTION_AUTH_HARNESS: process.env.APPS_API_PRODUCTION_AUTH_HARNESS,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_ADMIN: process.env.DATABASE_URL_ADMIN,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  TENANT_RATE_LIMIT_ENABLED: process.env.TENANT_RATE_LIMIT_ENABLED,
  REDIS_URL: process.env.REDIS_URL,
  AUTH_JWT_PUBLIC_KEY: process.env.AUTH_JWT_PUBLIC_KEY,
  AUTH_JWT_ISSUER: process.env.AUTH_JWT_ISSUER,
  AUTH_JWT_AUDIENCE: process.env.AUTH_JWT_AUDIENCE,
  OTP_FIXTURE_CODE: process.env.OTP_FIXTURE_CODE,
  AUTH_ALLOW_DEV_STATIC_OTP: process.env.AUTH_ALLOW_DEV_STATIC_OTP,
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

function installValidProductionEnv(): void {
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = "postgresql://app/db";
  process.env.DATABASE_URL_ADMIN = "postgresql://admin/db";
  process.env.STORAGE_DRIVER = "prisma";
  process.env.TENANT_RATE_LIMIT_ENABLED = "false";
  delete process.env.REDIS_URL;
  process.env.AUTH_JWT_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A\n-----END PUBLIC KEY-----";
  process.env.AUTH_JWT_ISSUER = "tour-ops";
  process.env.AUTH_JWT_AUDIENCE = "tour-ops-api";
  delete process.env.OTP_FIXTURE_CODE;
  delete process.env.AUTH_ALLOW_DEV_STATIC_OTP;
  delete process.env.APPS_API_PRODUCTION_AUTH_HARNESS;
}

describe("production auth harness fail-closed", { concurrency: false }, () => {
  it("Case 3: harness active only when flag=1 and NODE_ENV=test", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.APPS_API_PRODUCTION_AUTH_HARNESS;
    const {
      isProductionAuthHarnessActive,
      assertProductionAuthHarnessAbsent,
    } = await import("./production-auth-harness.js");
    assert.equal(isProductionAuthHarnessActive(), false);
    assert.doesNotThrow(() => assertProductionAuthHarnessAbsent());

    process.env.APPS_API_PRODUCTION_AUTH_HARNESS = "1";
    assert.equal(isProductionAuthHarnessActive(), true);
    assert.doesNotThrow(() => assertProductionAuthHarnessAbsent());
  });

  it("Case 1: NODE_ENV=production + harness=1 → boot fails (reject, not ignore)", async () => {
    installValidProductionEnv();
    process.env.APPS_API_PRODUCTION_AUTH_HARNESS = "1";

    const { isProductionAuthHarnessActive, PRODUCTION_AUTH_HARNESS_FORBIDDEN } =
      await import("./production-auth-harness.js");
    assert.equal(isProductionAuthHarnessActive(), false);

    const { assertProductionRuntimeIntegrity } =
      await import("../server/production-runtime-env.js");
    assert.throws(
      () => assertProductionRuntimeIntegrity(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODUCTION_AUTH_HARNESS_FORBIDDEN);
        return true;
      }
    );

    const { assertAuthEnvironmentIntegrity } = await import("../tenant-kernel/auth-env.js");
    assert.throws(
      () => assertAuthEnvironmentIntegrity(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODUCTION_AUTH_HARNESS_FORBIDDEN);
        return true;
      }
    );
  });

  it("Case 2: NODE_ENV=production + STORAGE_DRIVER=memory → boot fails", async () => {
    installValidProductionEnv();
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

  it("production never opens DEV_TENANTS fallback even when harness flag is set", async () => {
    process.env.NODE_ENV = "production";
    process.env.APPS_API_PRODUCTION_AUTH_HARNESS = "1";
    const { canResolveDevTenantRegistryFallback } =
      await import("../tenant/tenant-registry.js");
    assert.equal(canResolveDevTenantRegistryFallback(), false);
  });
});

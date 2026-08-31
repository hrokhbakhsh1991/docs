import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  PRODLIKE_DATABASE_URL_REQUIRED_FOR_REGISTRY,
  DENALI_CLUB_PUBLIC_DISPLAY_NAME,
  assertStaticTenantRegistryRuntime,
  canResolveDevTenantRegistryFallback,
  findTenantById,
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

  it("DEV_TENANTS includes denali smoke tenant with workspace_type denali", () => {
    const denali = findTenantById("00000000-0000-4000-8000-000000000003");
    assert.ok(denali);
    assert.equal(denali.subdomain, "denali");
    assert.equal(denali.workspaceType, "denali");
  });

  it("GL-BRAND-02 club tenant seeds displayName; operator smoke does not", () => {
    const club = findTenantById("00000000-0000-4000-8000-000000000003");
    const operator = findTenantById("00000000-0000-4000-8000-000000000014");
    assert.ok(club);
    assert.ok(operator);
    assert.equal(club.theme.displayName, DENALI_CLUB_PUBLIC_DISPLAY_NAME);
    assert.equal(operator.theme.displayName, undefined);
    assert.equal(operator.workspaceType, "denali");
  });

  it("DEV_TENANTS includes booking-ws2 smoke tenant for B1.5 composition", () => {
    const ws2 = findTenantById("00000000-0000-4000-8000-000000000015");
    assert.ok(ws2);
    assert.equal(ws2.subdomain, "booking-ws2");
    assert.equal(ws2.workspaceType, "booking-ws2");
  });

  it("canResolveDevTenantRegistryFallback is enabled in development", () => {
    process.env.NODE_ENV = "development";
    assert.equal(canResolveDevTenantRegistryFallback(), true);
    process.env.NODE_ENV = "production";
    delete process.env.APPS_API_TEST_TIER;
    delete process.env.APPS_API_PRODUCTION_AUTH_HARNESS;
    assert.equal(canResolveDevTenantRegistryFallback(), false);
    // PREV-AUD-001: harness flag must not reopen registry fallback under production
    process.env.APPS_API_PRODUCTION_AUTH_HARNESS = "1";
    assert.equal(canResolveDevTenantRegistryFallback(), false);
  });
});

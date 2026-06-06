import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  assertAppRoleDoesNotBypassRls,
  assertProductionDatabaseIntegrity,
  assertTenantTablesHaveRls,
  PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS,
  PRODUCTION_DATABASE_RLS_NOT_APPLIED,
  TENANT_RLS_TABLES,
} from "./assert-production-database-integrity";

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

describe("assertAppRoleDoesNotBypassRls (DM-CT-02)", () => {
  it("accepts NOBYPASSRLS app role", () => {
    assert.doesNotThrow(() => assertAppRoleDoesNotBypassRls(false));
    assert.doesNotThrow(() => assertAppRoleDoesNotBypassRls(undefined));
  });

  it("rejects BYPASSRLS app role", () => {
    assert.throws(
      () => assertAppRoleDoesNotBypassRls(true),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, PRODUCTION_DATABASE_APP_ROLE_BYPASSRLS);
        return true;
      }
    );
  });
});

describe("assertTenantTablesHaveRls (DM-CT-02)", () => {
  it("accepts all tenant tables with RLS enabled and forced", () => {
    assert.doesNotThrow(() =>
      assertTenantTablesHaveRls(
        TENANT_RLS_TABLES.map((relname) => ({
          relname,
          relrowsecurity: true,
          relforcerowsecurity: true,
        }))
      )
    );
  });

  it("rejects missing or partial RLS on tenant tables", () => {
    assert.throws(
      () =>
        assertTenantTablesHaveRls([
          { relname: "tours", relrowsecurity: true, relforcerowsecurity: true },
        ]),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, `${PRODUCTION_DATABASE_RLS_NOT_APPLIED}:outbox_events`);
        return true;
      }
    );

    assert.throws(
      () =>
        assertTenantTablesHaveRls(
          TENANT_RLS_TABLES.map((relname) => ({
            relname,
            relrowsecurity: relname !== "tours",
            relforcerowsecurity: true,
          }))
        ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, `${PRODUCTION_DATABASE_RLS_NOT_APPLIED}:tours`);
        return true;
      }
    );
  });
});

describe("assertProductionDatabaseIntegrity", () => {
  it("no-op outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    await assertProductionDatabaseIntegrity();
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTenantRoute, TENANT_ROUTE_MISCONFIGURED } from "../src/resolve-tenant-route";
import { TenantConnectionRouter } from "../src/tenant-connection-router";
import type { TenantRouteRow } from "../src/tenant-route-row";

const POOL_URL = "postgresql://pool:5432/app";

describe("resolveTenantRoute (7.7)", () => {
  it("pool default when row is null", () => {
    const route = resolveTenantRoute("tenant-a", null, { poolDatabaseUrl: POOL_URL });
    assert.equal(route.tier, "pool");
    assert.equal(route.databaseUrl, POOL_URL);
    assert.equal(route.useRls, true);
    assert.equal(route.schemaName, undefined);
  });

  it("pool when row tier is pool", () => {
    const row: TenantRouteRow = { tier: "pool", databaseUrl: null, schemaName: null };
    const route = resolveTenantRoute("tenant-a", row, { poolDatabaseUrl: POOL_URL });
    assert.equal(route.tier, "pool");
    assert.equal(route.useRls, true);
  });

  it("silo with dedicated database_url disables RLS", () => {
    const row: TenantRouteRow = {
      tier: "silo",
      databaseUrl: "postgresql://silo:5432/tenant_a",
      schemaName: null,
    };
    const route = resolveTenantRoute("tenant-a", row, { poolDatabaseUrl: POOL_URL });
    assert.equal(route.tier, "silo");
    assert.equal(route.databaseUrl, "postgresql://silo:5432/tenant_a");
    assert.equal(route.useRls, false);
  });

  it("silo with schema_name only uses pool URL + RLS", () => {
    const row: TenantRouteRow = {
      tier: "silo",
      databaseUrl: null,
      schemaName: "tenant_a_schema",
    };
    const route = resolveTenantRoute("tenant-a", row, { poolDatabaseUrl: POOL_URL });
    assert.equal(route.tier, "silo");
    assert.equal(route.databaseUrl, POOL_URL);
    assert.equal(route.useRls, true);
    assert.equal(route.schemaName, "tenant_a_schema");
  });

  it("misconfigured silo fails fast", () => {
    const row: TenantRouteRow = { tier: "silo", databaseUrl: null, schemaName: null };
    assert.throws(
      () => resolveTenantRoute("tenant-a", row, { poolDatabaseUrl: POOL_URL }),
      (error: unknown) => error instanceof Error && error.message === TENANT_ROUTE_MISCONFIGURED
    );
  });
});

describe("TenantConnectionRouter", () => {
  it("delegates to lookup and resolves pool route", async () => {
    const router = new TenantConnectionRouter(async () => null, POOL_URL);
    const route = await router.resolveRoute("tenant-b");
    assert.equal(route.tier, "pool");
    assert.equal(route.useRls, true);
  });

  it("resolves silo override from lookup", async () => {
    const router = new TenantConnectionRouter(
      async () => ({
        tier: "silo",
        databaseUrl: "postgresql://dedicated:5432/db",
        schemaName: null,
      }),
      POOL_URL
    );
    const route = await router.resolveRoute("enterprise-1");
    assert.equal(route.tier, "silo");
    assert.equal(route.useRls, false);
  });
});

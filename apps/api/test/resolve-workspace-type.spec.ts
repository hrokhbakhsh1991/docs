/**
 * Phase 11.0 — operator smoke workspace type alignment (DEC-P11-001)
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { resolveWorkspaceTypeForTenant } from "../src/tenant/resolve-workspace-type";

const URBAN_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000004";

const ENV_SNAPSHOT = {
  OPERATOR_SMOKE_E2E_SEED: process.env.OPERATOR_SMOKE_E2E_SEED,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  URBAN_TEST_WORKSPACE_TYPE: process.env.URBAN_TEST_WORKSPACE_TYPE,
};

afterEach(() => {
  if (ENV_SNAPSHOT.OPERATOR_SMOKE_E2E_SEED === undefined) {
    delete process.env.OPERATOR_SMOKE_E2E_SEED;
  } else {
    process.env.OPERATOR_SMOKE_E2E_SEED = ENV_SNAPSHOT.OPERATOR_SMOKE_E2E_SEED;
  }
  if (ENV_SNAPSHOT.STORAGE_DRIVER === undefined) {
    delete process.env.STORAGE_DRIVER;
  } else {
    process.env.STORAGE_DRIVER = ENV_SNAPSHOT.STORAGE_DRIVER;
  }
  if (ENV_SNAPSHOT.URBAN_TEST_WORKSPACE_TYPE === undefined) {
    delete process.env.URBAN_TEST_WORKSPACE_TYPE;
  } else {
    process.env.URBAN_TEST_WORKSPACE_TYPE = ENV_SNAPSHOT.URBAN_TEST_WORKSPACE_TYPE;
  }
});

describe("resolve-workspace-type.spec.ts — Phase 11.0", () => {
  it("API-11.0-01 operator smoke memory resolves denali (not starter)", async () => {
    process.env.OPERATOR_SMOKE_E2E_SEED = "1";
    process.env.STORAGE_DRIVER = "memory";
    const workspaceType = await resolveWorkspaceTypeForTenant(OPERATOR_SMOKE.tenantId);
    assert.equal(workspaceType, "denali");
  });

  it("API-11.0-02 URBAN_TEST_WORKSPACE_TYPE does not override operator smoke tenant", async () => {
    process.env.NODE_ENV = "test";
    process.env.STORAGE_DRIVER = "memory";
    process.env.URBAN_TEST_WORKSPACE_TYPE = "urban";
    const operatorType = await resolveWorkspaceTypeForTenant(OPERATOR_SMOKE.tenantId);
    const urbanType = await resolveWorkspaceTypeForTenant(URBAN_SMOKE_TENANT_ID);
    assert.equal(operatorType, "denali");
    assert.equal(urbanType, "urban");
  });

  it("TODO-011 unknown tenant fails closed (no starter fallback)", async () => {
    process.env.STORAGE_DRIVER = "memory";
    await assert.rejects(
      () => resolveWorkspaceTypeForTenant("00000000-0000-4000-8000-00000000dead"),
      /WORKSPACE_TYPE_UNRESOLVED/
    );
  });
});

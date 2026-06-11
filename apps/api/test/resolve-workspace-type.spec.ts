/**
 * Phase 11.0 — operator smoke workspace type alignment (DEC-P11-001)
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { OPERATOR_SMOKE } from "./fixtures/operator-smoke-e2e-tenant";
import { resolveWorkspaceTypeForTenant } from "../src/tenant/resolve-workspace-type";

const ENV_SNAPSHOT = {
  OPERATOR_SMOKE_E2E_SEED: process.env.OPERATOR_SMOKE_E2E_SEED,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
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
});

describe("resolve-workspace-type.spec.ts — Phase 11.0", () => {
  it("API-11.0-01 operator smoke memory resolves denali (not starter)", async () => {
    process.env.OPERATOR_SMOKE_E2E_SEED = "1";
    process.env.STORAGE_DRIVER = "memory";
    const workspaceType = await resolveWorkspaceTypeForTenant(OPERATOR_SMOKE.tenantId);
    assert.equal(workspaceType, "denali");
  });
});

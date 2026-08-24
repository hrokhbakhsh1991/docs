import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  loadWorkspaceInfrastructureRegistry,
  resetWorkspaceInfrastructureRegistryForTests,
  resolveRegistryDatabaseTargets,
  resolveWorkspacePlacementFromRegistry,
} from "./workspace-infrastructure-registry";

afterEach(() => {
  resetWorkspaceInfrastructureRegistryForTests();
});

describe("workspace-infrastructure-registry (MAT-010)", () => {
  it("loads explicit workspace placements with SHARED default for denali", () => {
    const registry = loadWorkspaceInfrastructureRegistry();
    const placement = resolveWorkspacePlacementFromRegistry({
      tenantId: "tenant-a",
      workspaceType: "denali",
    });
    assert.equal(placement.mode, "SHARED");
    assert.equal(placement.region, registry.defaultRegion);
  });

  it("tenant override wins over workspace-type default", () => {
    process.env.WORKSPACE_INFRASTRUCTURE_REGISTRY_PATH = new URL(
      "../../test/fixtures/workspace-infrastructure-registry.override.json",
      import.meta.url
    ).pathname;
    resetWorkspaceInfrastructureRegistryForTests();

    const placement = resolveWorkspacePlacementFromRegistry({
      tenantId: "tenant-dedicated",
      workspaceType: "denali",
    });
    assert.equal(placement.mode, "DEDICATED_DB");
    assert.equal(placement.databaseTargetId, "db-denali-dedicated");
  });

  it("fails closed when workspace placement is unknown", () => {
    assert.throws(
      () =>
        resolveWorkspacePlacementFromRegistry({
          tenantId: "tenant-a",
          workspaceType: "unknown-workspace",
        }),
      /WORKSPACE_INFRASTRUCTURE_PLACEMENT_NOT_FOUND/
    );
  });

  it("resolves database targets from env keys without embedding secrets in registry", () => {
    process.env.DEDICATED_DB_DENALI_URL = "postgresql://dedicated:5432/app";
    const registry = loadWorkspaceInfrastructureRegistry();
    const targets = resolveRegistryDatabaseTargets(registry);
    assert.equal(targets["db-denali-dedicated"]?.databaseUrl, "postgresql://dedicated:5432/app");
    delete process.env.DEDICATED_DB_DENALI_URL;
  });
});

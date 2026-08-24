import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  createWorkspaceBindingId,
  resolveWorkspaceInfrastructure,
} from "@app-tour/tenant-kernel";

import {
  getActiveWorkspaceInfrastructure,
  runWithWorkspaceInfrastructureContext,
} from "./workspace-infrastructure-request-context";
import { resetWorkspaceInfrastructureRegistryForTests } from "./workspace-infrastructure-registry";

afterEach(() => {
  resetWorkspaceInfrastructureRegistryForTests();
  delete process.env.DATABASE_URL;
  delete process.env.WORKSPACE_INFRASTRUCTURE_REGISTRY_PATH;
});

describe("workspace-infrastructure-request-context (MAT-010)", () => {
  it("workspace A SHARED cannot receive workspace B dedicated DB handle", async () => {
    process.env.DATABASE_URL = "postgresql://shared:5432/app";
    process.env.WORKSPACE_INFRASTRUCTURE_REGISTRY_PATH = new URL(
      "../../test/fixtures/workspace-infrastructure-registry.override.json",
      import.meta.url
    ).pathname;
    process.env.DEDICATED_DB_DENALI_URL = "postgresql://dedicated-b:5432/app";
    resetWorkspaceInfrastructureRegistryForTests();

    let sharedDb: string | undefined;
    let dedicatedDb: string | undefined;

    await runWithWorkspaceInfrastructureContext({
      tenantId: "tenant-shared",
      workspaceType: "denali",
      manifestFingerprint: "fp-1",
      run: async () => {
        sharedDb = getActiveWorkspaceInfrastructure()?.endpoints.databaseUrl;
      },
    });

    await runWithWorkspaceInfrastructureContext({
      tenantId: "tenant-dedicated",
      workspaceType: "denali",
      manifestFingerprint: "fp-1",
      run: async () => {
        dedicatedDb = getActiveWorkspaceInfrastructure()?.endpoints.databaseUrl;
      },
    });

    assert.equal(sharedDb, "postgresql://shared:5432/app");
    assert.equal(dedicatedDb, "postgresql://dedicated-b:5432/app");
    assert.notEqual(sharedDb, dedicatedDb);
  });

  it("deterministic bundle fingerprint for same binding inputs", () => {
    process.env.DATABASE_URL = "postgresql://shared:5432/app";
    const bindingId = createWorkspaceBindingId("tenant-a", "denali");
    const first = resolveWorkspaceInfrastructure({
      workspaceBindingId: bindingId,
      workspaceType: "denali",
      placement: { mode: "SHARED", region: "eu-central" },
      bundle: { manifestFingerprint: "fp-1", releaseSha: "sha-1" },
      sharedDefaults: {
        poolDatabaseUrl: "postgresql://shared:5432/app",
        homeRegion: "eu-central",
      },
    });
    const second = resolveWorkspaceInfrastructure({
      workspaceBindingId: bindingId,
      workspaceType: "denali",
      placement: { mode: "SHARED", region: "eu-central" },
      bundle: { manifestFingerprint: "fp-1", releaseSha: "sha-1" },
      sharedDefaults: {
        poolDatabaseUrl: "postgresql://shared:5432/app",
        homeRegion: "eu-central",
      },
    });
    assert.equal(first.bundleFingerprint, second.bundleFingerprint);
  });
});

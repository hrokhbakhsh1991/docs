import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createWorkspaceBindingId,
  resolveWorkspaceInfrastructure,
} from "../src/resolve-workspace-infrastructure";
import {
  WORKSPACE_INFRASTRUCTURE_MISCONFIGURED,
  WORKSPACE_INFRASTRUCTURE_REGION_VIOLATION,
} from "../src/workspace-infrastructure-placement";
import { validateRegionalResourceMix } from "../src/workspace-residency-policy";

const SHARED_DEFAULTS = {
  poolDatabaseUrl: "postgresql://shared:5432/app",
  homeRegion: "eu-central",
  cacheNamespace: "shared-cache",
  storageNamespace: "shared-storage",
  queueNamespace: "shared-queue",
  secretsRef: "shared/platform",
  monitoringIdentity: "shared-stamp",
} as const;

const DATABASE_TARGETS = {
  "db-b": {
    region: "eu-central",
    databaseUrl: "postgresql://dedicated-b:5432/app",
  },
} as const;

const DEPLOYMENT_STAMPS = {
  "stamp-c": {
    region: "eu-central",
    releaseSha: "release-1",
    databaseTargetId: "db-b",
    cacheNamespace: "stamp-c:cache",
    storageNamespace: "stamp-c:storage",
    queueNamespace: "stamp-c:queue",
    secretsRef: "stamp-c/secrets",
    monitoringIdentity: "stamp-c",
    backupRegion: "eu-central",
  },
} as const;

const BASE_BUNDLE = {
  manifestFingerprint: "manifest-1",
  releaseSha: "release-1",
};

describe("resolveWorkspaceInfrastructure (MAT-010)", () => {
  it("resolves SHARED placement with shared database handle", () => {
    const resolved = resolveWorkspaceInfrastructure({
      workspaceBindingId: "tenant-a:denali",
      workspaceType: "denali",
      placement: { mode: "SHARED", region: "eu-central" },
      bundle: BASE_BUNDLE,
      sharedDefaults: SHARED_DEFAULTS,
    });

    assert.equal(resolved.endpoints.databaseUrl, SHARED_DEFAULTS.poolDatabaseUrl);
    assert.equal(resolved.useSharedDatabase, true);
    assert.equal(resolved.stampId, "shared");
  });

  it("resolves DEDICATED_DB without sharing database handle with SHARED workspaces", () => {
    const shared = resolveWorkspaceInfrastructure({
      workspaceBindingId: "tenant-a:urban",
      workspaceType: "urban",
      placement: { mode: "SHARED", region: "eu-central" },
      bundle: BASE_BUNDLE,
      sharedDefaults: SHARED_DEFAULTS,
    });
    const dedicated = resolveWorkspaceInfrastructure({
      workspaceBindingId: "tenant-b:denali",
      workspaceType: "denali",
      placement: {
        mode: "DEDICATED_DB",
        region: "eu-central",
        databaseTargetId: "db-b",
      },
      bundle: BASE_BUNDLE,
      sharedDefaults: SHARED_DEFAULTS,
      databaseTargets: DATABASE_TARGETS,
    });

    assert.notEqual(shared.endpoints.databaseUrl, dedicated.endpoints.databaseUrl);
    assert.equal(dedicated.useSharedDatabase, false);
    assert.equal(dedicated.endpoints.databaseUrl, DATABASE_TARGETS["db-b"].databaseUrl);
  });

  it("fails closed when dedicated DB target is missing", () => {
    assert.throws(
      () =>
        resolveWorkspaceInfrastructure({
          workspaceBindingId: "tenant-b:denali",
          workspaceType: "denali",
          placement: {
            mode: "DEDICATED_DB",
            region: "eu-central",
            databaseTargetId: "missing-db",
          },
          bundle: BASE_BUNDLE,
          sharedDefaults: SHARED_DEFAULTS,
          databaseTargets: DATABASE_TARGETS,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, WORKSPACE_INFRASTRUCTURE_MISCONFIGURED);
        return true;
      }
    );
  });

  it("resolves DEDICATED_STAMP with deterministic stamp identity", () => {
    const first = resolveWorkspaceInfrastructure({
      workspaceBindingId: "tenant-c:denali",
      workspaceType: "denali",
      placement: { mode: "DEDICATED_STAMP", region: "eu-central", stampId: "stamp-c" },
      bundle: BASE_BUNDLE,
      sharedDefaults: SHARED_DEFAULTS,
      databaseTargets: DATABASE_TARGETS,
      deploymentStamps: DEPLOYMENT_STAMPS,
    });
    const second = resolveWorkspaceInfrastructure({
      workspaceBindingId: "tenant-c:denali",
      workspaceType: "denali",
      placement: { mode: "DEDICATED_STAMP", region: "eu-central", stampId: "stamp-c" },
      bundle: BASE_BUNDLE,
      sharedDefaults: SHARED_DEFAULTS,
      databaseTargets: DATABASE_TARGETS,
      deploymentStamps: DEPLOYMENT_STAMPS,
    });

    assert.equal(first.stampId, "stamp-c");
    assert.equal(first.bundleFingerprint, second.bundleFingerprint);
    assert.equal(first.endpoints.cacheNamespace, "stamp-c:cache");
    assert.equal(first.useSharedDatabase, false);
  });

  it("creates stable workspace binding ids", () => {
    assert.equal(createWorkspaceBindingId("tenant-1", "Denali"), "tenant-1:denali");
  });
});

describe("workspace residency policy (MAT-013)", () => {
  it("rejects forbidden cross-region resource mix", () => {
    const violations = validateRegionalResourceMix({
      placement: {
        mode: "REGIONAL_STAMP",
        region: "eu-central",
        residencyPolicy: "HOME_REGION_ONLY",
        stampId: "stamp-c",
      },
      homeRegion: "eu-central",
      resources: [
        { kind: "database", region: "eu-central", resourceId: "db-b" },
        { kind: "storage", region: "me-central", resourceId: "storage-1" },
      ],
    });
    assert.deepEqual(violations, ["storage:storage-1:region-mismatch"]);
  });

  it("rejects backup outside home region when replication forbidden", () => {
    const violations = validateRegionalResourceMix({
      placement: {
        mode: "REGIONAL_STAMP",
        region: "eu-central",
        residencyPolicy: "NO_CROSS_REGION_REPLICATION",
        stampId: "stamp-c",
      },
      homeRegion: "eu-central",
      resources: [
        { kind: "database", region: "eu-central", resourceId: "db-b" },
        { kind: "backup", region: "us-east", resourceId: "backup-1" },
      ],
    });
    assert.ok(violations.includes("backup:cross-region-replication-forbidden"));
  });

  it("fails closed on region assertion mismatch", () => {
    assert.throws(
      () =>
        resolveWorkspaceInfrastructure({
          workspaceBindingId: "tenant-c:denali",
          workspaceType: "denali",
          placement: {
            mode: "REGIONAL_STAMP",
            region: "me-central",
            residencyPolicy: "HOME_REGION_ONLY",
            stampId: "stamp-c",
          },
          bundle: BASE_BUNDLE,
          sharedDefaults: SHARED_DEFAULTS,
          databaseTargets: DATABASE_TARGETS,
          deploymentStamps: DEPLOYMENT_STAMPS,
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, WORKSPACE_INFRASTRUCTURE_REGION_VIOLATION);
        return true;
      }
    );
  });
});

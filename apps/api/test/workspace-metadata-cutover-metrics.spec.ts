/**
 * P5-A-N-006 — metadata cutover validation error metrics
 * @see docs/phase-18/platform-metadata-cutover-pilot.mdoc (MET-01..02)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  metricsRegistry,
  recordWorkspaceMetadataValidationError,
  resetMetricsRegistryForTests,
  TENANT_SCOPED_METRIC_NAMES,
} from "../src/observability/metrics.ts";
import {
  isWorkspaceMetadataValidationPathActive,
  resolveWorkspaceMetadataValidationPathActive,
} from "../src/workspace-metadata/is-workspace-metadata-validation-path-active.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (relativePath: string): string =>
  readFileSync(join(repoRoot, relativePath), "utf8");

const env = process.env as Record<string, string | undefined>;
const envSnapshot = {
  WORKSPACE_METADATA_ENABLED: env.WORKSPACE_METADATA_ENABLED,
  WORKSPACE_METADATA_TENANT_ALLOWLIST: env.WORKSPACE_METADATA_TENANT_ALLOWLIST,
};

afterEach(() => {
  resetMetricsRegistryForTests();
  for (const [key, value] of Object.entries(envSnapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
});

describe("workspace-metadata-cutover-metrics (P5-A MET)", () => {
  it("MET-01 registers tenant-scoped counter with workspace_type label", () => {
    assert.ok(TENANT_SCOPED_METRIC_NAMES.has("workspace_metadata_validation_errors_total"));
    const tenantId = "00000000-0000-4000-8000-000000000030";
    recordWorkspaceMetadataValidationError(tenantId, "starter");
    assert.equal(
      metricsRegistry.getMetric("workspace_metadata_validation_errors_total", {
        tenant_id: tenantId,
        workspace_type: "starter",
      }),
      1
    );
  });

  it("MET-02 async validation path records metric on ValidationFailure", () => {
    const source = readSource("src/tours/canonical-validation-sync.ts");
    assert.match(source, /recordWorkspaceMetadataValidationError/);
    assert.match(source, /resolveWorkspaceMetadataValidationPathActive/);
    assert.match(source, /metadataPathActive && isValidationFailure\(error\)/);
    assert.match(source, /recordWorkspaceMetadataValidationError\(input\.tenantId, input\.workspaceType\)/);
  });

  it("MET-02b path helper gates metric to metadata binding + allowlist", async () => {
    delete env.WORKSPACE_METADATA_ENABLED;
    assert.equal(
      isWorkspaceMetadataValidationPathActive({
        tenantId: "tenant-a",
        metadataBinding: { definitionId: "denali-v1" },
      }),
      false
    );

    env.WORKSPACE_METADATA_ENABLED = "true";
    assert.equal(
      isWorkspaceMetadataValidationPathActive({
        tenantId: "tenant-a",
        metadataBinding: null,
      }),
      false
    );

    env.WORKSPACE_METADATA_TENANT_ALLOWLIST = "tenant-b";
    assert.equal(
      isWorkspaceMetadataValidationPathActive({
        tenantId: "tenant-a",
        metadataBinding: { definitionId: "denali-v1" },
      }),
      false
    );

    assert.equal(
      isWorkspaceMetadataValidationPathActive({
        tenantId: "tenant-b",
        metadataBinding: { definitionId: "denali-v1" },
      }),
      true
    );

    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;
    assert.equal(
      await resolveWorkspaceMetadataValidationPathActive("00000000-0000-4000-8000-000000000099", {
        tenantRepository: {
          getById: async () => ({
            id: "00000000-0000-4000-8000-000000000099",
            subdomain: "live-club",
            workspaceType: "denali",
            status: "active",
            createdAt: new Date("2026-06-22T12:00:00.000Z"),
            offboardingStartedAt: null,
            scheduledDeletionAt: null,
            workspaceDefinitionId: "denali-v1",
            workspaceDefinitionVersion: 1,
          }),
        } as never,
      }),
      true
    );
  });
});

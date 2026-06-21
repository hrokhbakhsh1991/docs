/**
 * P5-A-N-003 — metadataCutoverStage derivation
 * @see docs/phase-18/platform-metadata-cutover-pilot.mdoc
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { deriveMetadataCutoverStage } from "../src/workspace-metadata/derive-metadata-cutover-stage.ts";

const env = process.env as Record<string, string | undefined>;
const snapshot = {
  WORKSPACE_METADATA_ENABLED: env.WORKSPACE_METADATA_ENABLED,
  WORKSPACE_METADATA_TENANT_ALLOWLIST: env.WORKSPACE_METADATA_TENANT_ALLOWLIST,
};

afterEach(() => {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value !== undefined) {
      env[key] = value;
    } else {
      delete env[key];
    }
  }
});

describe("platform-tenant-metadata-cutover (P5-A CO)", () => {
  it("CO-01 off when flag false even with binding", () => {
    delete env.WORKSPACE_METADATA_ENABLED;
    assert.equal(
      deriveMetadataCutoverStage({
        tenantId: "tenant-a",
        workspaceDefinitionId: "denali-v1",
      }),
      "off"
    );
  });

  it("CO-02 off when binding null even with flag true", () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;
    assert.equal(
      deriveMetadataCutoverStage({
        tenantId: "tenant-a",
        workspaceDefinitionId: null,
      }),
      "off"
    );
  });

  it("CO-03 pilot when allowlist contains tenant", () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    env.WORKSPACE_METADATA_TENANT_ALLOWLIST = "tenant-a,tenant-b";
    assert.equal(
      deriveMetadataCutoverStage({
        tenantId: "tenant-a",
        workspaceDefinitionId: "denali-v1",
      }),
      "pilot"
    );
  });

  it("CO-04 off when allowlist excludes tenant", () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    env.WORKSPACE_METADATA_TENANT_ALLOWLIST = "tenant-b";
    assert.equal(
      deriveMetadataCutoverStage({
        tenantId: "tenant-a",
        workspaceDefinitionId: "denali-v1",
      }),
      "off"
    );
  });

  it("CO-05 live when flag true + binding + empty allowlist", () => {
    env.WORKSPACE_METADATA_ENABLED = "true";
    delete env.WORKSPACE_METADATA_TENANT_ALLOWLIST;
    assert.equal(
      deriveMetadataCutoverStage({
        tenantId: "tenant-a",
        workspaceDefinitionId: "denali-v1",
      }),
      "live"
    );
  });
});

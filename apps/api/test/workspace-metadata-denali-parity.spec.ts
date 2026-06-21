import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";
import { denaliPluginForWizardEngine } from "@app-tour/workspace-denali";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import { adaptMetadataPayloadToWorkspacePlugin } from "../src/workspace-metadata/metadata-plugin-adapter.ts";
import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin.ts";
import {
  buildLiveDenaliExport,
  listFieldIds,
  loadDenaliSeedExport,
  stripDataSurfaces,
  stripDataSurfacesFromPayload,
} from "./lib/workspace-metadata-parity-helpers.ts";

const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/workspaces/denali/test/fixtures/golden"
);

function buildDenaliCanonicalShell(roots: readonly string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const root of roots) {
    data[root] = {};
  }
  return data;
}

describe("workspace-metadata-denali-parity", () => {
  it("DP-01 live export checksum matches denali-v1.json", () => {
    const seed = loadDenaliSeedExport();
    const live = buildLiveDenaliExport();
    assert.equal(live.checksum, seed.checksum);
  });

  it("DP-02 fieldRegistry field ids match package strip vs seed payload", () => {
    const seed = loadDenaliSeedExport();
    const packagePlugin = resolveWorkspacePluginForType("denali");
    assert.deepEqual(listFieldIds(stripDataSurfaces(packagePlugin)), listFieldIds(seed.payload));
  });

  it("DP-03 ruleSet matches package strip vs seed payload", () => {
    const seed = loadDenaliSeedExport();
    const packagePlugin = resolveWorkspacePluginForType("denali");
    assert.deepEqual(stripDataSurfaces(packagePlugin).ruleSet, stripDataSurfacesFromPayload(seed.payload).ruleSet);
  });

  it("DP-04 wizard roots railId wizardMode match package strip vs seed", () => {
    const seed = loadDenaliSeedExport();
    const packagePlugin = resolveWorkspacePluginForType("denali");
    const packageWizard = stripDataSurfaces(packagePlugin).wizard;
    const seedWizard = stripDataSurfacesFromPayload(seed.payload).wizard;
    assert.equal(seedWizard.railId, packageWizard.railId);
    assert.equal(seedWizard.wizardMode, packageWizard.wizardMode);
    assert.deepEqual(seedWizard.roots, packageWizard.roots);
  });

  it("DP-05 golden tour-publish-ready validates same violation field ids", () => {
    const packagePlugin = resolveWorkspacePluginForType("denali");
    const seed = loadDenaliSeedExport();
    const metadataPlugin = adaptMetadataPayloadToWorkspacePlugin(seed.payload, packagePlugin);

    const roots = packagePlugin.wizard.roots;
    const data = buildDenaliCanonicalShell(roots);
    data.title = "Publish ready metadata parity";
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: [...roots],
      data,
    });
    const context = {
      tenantId: "parity-tenant",
      dimensions: { category: "mountain", duration: "single_day" },
    };

    const packageEngine = PlatformWizardEngine.create(denaliPluginForWizardEngine(packagePlugin));
    const metadataEngine = PlatformWizardEngine.create(denaliPluginForWizardEngine(metadataPlugin));
    const packageResult = packageEngine.validateCanonical(document, context);
    const metadataResult = metadataEngine.validateCanonical(document, context);

    assert.equal(packageResult.ok, metadataResult.ok);
    const packageFieldIds = packageResult.ok
      ? []
      : [...packageResult.violations].map((violation) => violation.fieldId).sort();
    const metadataFieldIds = metadataResult.ok
      ? []
      : [...metadataResult.violations].map((violation) => violation.fieldId).sort();
    assert.deepEqual(metadataFieldIds, packageFieldIds);
  });

  it("DP-06 adaptMetadataPayloadToWorkspacePlugin preserves overlay.validation reference", () => {
    const packagePlugin = resolveWorkspacePluginForType("denali");
    const seed = loadDenaliSeedExport();
    const adapted = adaptMetadataPayloadToWorkspacePlugin(seed.payload, packagePlugin);
    assert.equal(adapted.validation, packagePlugin.validation);
  });

  it("DP-07 wizard.inactiveFieldGroups match package strip vs seed payload", () => {
    const seed = loadDenaliSeedExport();
    const packagePlugin = resolveWorkspacePluginForType("denali");
    assert.deepEqual(
      stripDataSurfaces(packagePlugin).wizard.inactiveFieldGroups,
      stripDataSurfacesFromPayload(seed.payload).wizard.inactiveFieldGroups
    );
  });

  it("loads tour-publish-ready golden fixture for smoke reference", () => {
    const raw = readFileSync(join(GOLDEN_DIR, "tour-publish-ready.json"), "utf8");
    assert.ok(raw.includes("basicInfo"));
  });
});

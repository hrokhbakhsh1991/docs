import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { getUrbanWorkspacePlugin } from "@app-tour/workspace-urban";
import {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  getStarterWorkspacePlugin,
  resolveWorkspacePluginIdForType,
} from "@app-tour/workspace-sdk";

import {
  getOrCreateValidationEngine,
  resetValidationEngineCacheForTests,
  validateCanonicalBeforePersistSync,
} from "../src/tours/canonical-validation-sync";
import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin";

const URBAN_GOLDEN = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/workspaces/urban/test/fixtures/golden/urban-tour-minimal.json"
);

describe("urban-workspace-plugin.spec.ts (REQ-P7-009, REQ-P7-010, REQ-P7-011)", () => {
  it('REQ-P7-009: resolveWorkspacePluginIdForType("urban") === "urban"', async () => {
    assert.equal(
      resolveWorkspacePluginIdForType("urban", DEFAULT_WORKSPACE_TYPE_BINDINGS),
      "urban"
    );
  });

  it("REQ-P7-009: await resolveWorkspacePluginForType(urban) returns urban plugin", async () => {
    const plugin = await resolveWorkspacePluginForType("urban");
    assert.equal(plugin.id, "urban");
    assert.equal(plugin.id, getUrbanWorkspacePlugin().id);
    assert.notEqual(plugin.id, getStarterWorkspacePlugin().id);
  });

  it("REQ-P7-009: starter workspace_type still resolves starter plugin", async () => {
    const plugin = await resolveWorkspacePluginForType("starter");
    assert.equal(plugin.id, getStarterWorkspacePlugin().id);
  });

  it("REQ-P7-012: validateCanonicalBeforePersistSync accepts urban golden minimal", async () => {
    resetValidationEngineCacheForTests();
    const golden = JSON.parse(readFileSync(URBAN_GOLDEN, "utf8")) as {
      roots: string[];
      data: Record<string, unknown>;
      schemaVersion: number;
    };
    const tenantId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await getOrCreateValidationEngine(tenantId, "urban");
    const document = await validateCanonicalBeforePersistSync({
      body: {
        roots: golden.roots,
        data: golden.data,
        schemaVersion: golden.schemaVersion,
      },
      tenantId,
      workspaceType: "urban",
    });
    assert.equal(document.schemaVersion, golden.schemaVersion);
    assert.equal((document.data.tour as { title?: string }).title, "Berlin city highlights");
  });

  it("REQ-P7-011: urban plugin rail is urban_base not denali", async () => {
    const plugin = getUrbanWorkspacePlugin();
    assert.equal(plugin.wizard.railId, "urban_base");
    assert.notEqual(plugin.wizard.railId, "denali_base");
  });

  it("P15-15-03: urban plugin exposes tourList.extractTourListProjection", async () => {
    const plugin = await resolveWorkspacePluginForType("urban");
    assert.equal(typeof plugin.tourList?.extractTourListProjection, "function");
  });
});

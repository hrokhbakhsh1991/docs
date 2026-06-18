import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-sdk";

import { resolveValidationDimensions } from "../src/tours/canonical-validation-sync";
import { resolveWorkspacePluginForType } from "../src/workspace/resolve-workspace-plugin";

const SYNC_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/tours/canonical-validation-sync.ts"),
  "utf8"
);

describe("canonical-validation-dimensions.spec.ts (P13-3)", () => {
  it("P13-3-01 denali uses wizardHost.resolveMatrixDimensionsFromDraft", () => {
    const plugin = resolveWorkspacePluginForType("denali");
    assert.equal(plugin.id, getDenaliWorkspacePlugin().id);
    assert.deepEqual(resolveValidationDimensions(plugin, "default", {}), {
      category: "mountain",
      duration: "single_day",
    });
    assert.deepEqual(
      resolveValidationDimensions(plugin, "default", { category: "mountain_day" }),
      { category: "mountain", duration: "single_day" }
    );
  });

  it("P13-3-02 starter uses validation variant matrix", () => {
    const plugin = getStarterWorkspacePlugin();
    assert.deepEqual(resolveValidationDimensions(plugin, "default", {}), { variant: "default" });
    assert.deepEqual(resolveValidationDimensions(plugin, "basic", {}), { variant: "basic" });
  });

  it("P13-3-03 urban resolves tourType from wizardHost hook", () => {
    const plugin = resolveWorkspacePluginForType("urban");
    assert.deepEqual(resolveValidationDimensions(plugin, "default", {}), { tourType: "city" });
  });

  it("P13-3-04 sync module has no denali product branch", () => {
    assert.equal(/plugin\.id === ["']denali["']/.test(SYNC_SOURCE), false);
    assert.equal(/@app-tour\/workspace-denali/.test(SYNC_SOURCE), false);
  });
});
